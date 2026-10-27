import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { demoData } from '../src/demo';
import { bundle } from '../src/domain';

async function navigate(page: Page, label: string) {
  const mobile = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await mobile.isVisible()) await mobile.click();
  const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
  if (['Event settings', 'Backups & sharing'].includes(label)) {
    const menu = sidebar.locator('.manage-menu');
    if (!(await menu.evaluate((el) => (el as HTMLDetailsElement).open)))
      await menu.locator('summary').click();
  }
  await sidebar.getByRole('button', { name: label, exact: true }).click();
}
async function setup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create an event' });
  await dialog.getByLabel('Event name', { exact: true }).fill('Practice');
  await dialog
    .getByLabel(/^Team roster/)
    .fill('6901, Knights Robotics\n254, The Cheesy Poofs\n118, Robonauts');
  await dialog.getByRole('button', { name: 'Create event', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function current(page: Page) {
  return page.evaluate(
    () =>
      new Promise<
        | {
            backup: { data: { matches: unknown[]; events: unknown[] } };
            drafts: Record<string, { strengths?: string; notes?: string }>;
          }
        | undefined
      >((resolve, reject) => {
        const request = indexedDB.open('alliancelab', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction('workspace').objectStore('workspace').get('current');
          read.onsuccess = () => {
            db.close();
            resolve(read.result);
          };
          read.onerror = () => reject(read.error);
        };
      }),
  );
}

test('pit drafts survive changing teams, immediate navigation, and reload', async ({ page }) => {
  await setup(page);
  await navigate(page, 'Scout');
  await page.getByRole('button', { name: 'Pit scouting', exact: true }).click();
  await page.getByLabel('Scout name', { exact: true }).fill('Pit scout');
  await page.getByLabel('Strengths', { exact: true }).fill('Team one draft');
  await page.getByLabel('Pit team', { exact: true }).selectOption('254');
  await page.getByLabel('Strengths', { exact: true }).fill('Team two draft');
  await page.getByLabel('Pit team', { exact: true }).selectOption('6901');
  await expect(page.getByLabel('Strengths', { exact: true })).toHaveValue('Team one draft');
  await navigate(page, 'Home');
  await navigate(page, 'Scout');
  await page.getByRole('button', { name: 'Pit scouting', exact: true }).click();
  await expect(page.getByLabel('Strengths', { exact: true })).toHaveValue('Team one draft');
  await expect
    .poll(async () =>
      Object.values((await current(page))?.drafts || {}).some(
        (draft) => draft.strengths === 'Team two draft',
      ),
    )
    .toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Pit scouting', exact: true }).click();
  await page.getByLabel('Pit team', { exact: true }).selectOption('254');
  await expect(page.getByLabel('Strengths', { exact: true })).toHaveValue('Team two draft');
});

test('reviewed schedule import fills the station queue and advances to the next team', async ({
  page,
}) => {
  await setup(page);
  await navigate(page, 'Event settings');
  await page.getByLabel('Import schedule CSV', { exact: true }).setInputFiles({
    name: 'bad.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('match,team,alliance,station\n1,99999,red,1'),
  });
  await expect(page.getByRole('alert')).toContainText('roster');
  await page.getByLabel('Import schedule CSV', { exact: true }).setInputFiles({
    name: 'schedule.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('match,team,alliance,station\n1,6901,blue,1\n2,254,blue,1\n1,118,red,1'),
  });
  await expect(page.getByRole('heading', { name: 'Review 3 assignments' })).toBeVisible();
  await page.getByRole('button', { name: 'Save schedule', exact: true }).click();
  await navigate(page, 'Scout');
  await page.getByLabel('Scout name', { exact: true }).fill('Schedule scout');
  await page.getByLabel('Scouting station', { exact: true }).selectOption('blue-1');
  await expect(page.getByLabel('Match team', { exact: true })).toHaveValue('6901');
  await page.getByRole('button', { name: 'Save observation', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Match Q1 saved');
  await expect(page.getByLabel('Match team', { exact: true })).toHaveValue('254');
  await expect(page.getByLabel('Qualification match', { exact: true })).toHaveValue('2');
  await navigate(page, 'Home');
  await expect(page.getByRole('heading', { name: 'Q2 · Team 254' })).toBeVisible();
  await navigate(page, 'Scout');
  await expect(page.getByLabel('Match team', { exact: true })).toHaveValue('254');
  await expect(page.getByLabel('Qualification match', { exact: true })).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'Blue', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(async () =>
      Object.values((await current(page))?.drafts || {}).some(
        (draft) => (draft as { match?: number }).match === 2,
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByLabel('Match team', { exact: true })).toHaveValue('254');
  await expect(page.getByLabel('Qualification match', { exact: true })).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'Blue', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('legacy v1 workspace migrates intact and retains the original browser copy', async ({
  page,
}) => {
  const source = demoData();
  const original = JSON.stringify({
    backup: { ...bundle(source), schemaVersion: 1 },
    preferences: { selectedEvent: 'demo-event', scout: 'Legacy scout', homeTeam: '6901' },
    drafts: {},
  });
  await page.addInitScript((raw) => {
    if (!localStorage.getItem('alliancelab.workspace.v1'))
      localStorage.setItem('alliancelab.workspace.v1', raw);
  }, original);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lone Star Practice' })).toBeVisible();
  await expect.poll(async () => (await current(page))?.backup.data.matches.length).toBe(30);
  expect(await page.evaluate(() => localStorage.getItem('alliancelab.workspace.v1'))).toBe(
    original,
  );
  await page.reload();
  await navigate(page, 'Scout');
  await expect(page.getByLabel('Scout name', { exact: true })).toHaveValue('Legacy scout');
});

test('workspace backups restore local drafts only after explicit replacement', async ({ page }) => {
  await setup(page);
  await navigate(page, 'Scout');
  await page.getByLabel('Scout name', { exact: true }).fill('Draft scout');
  await page.getByRole('button', { name: 'Increase Auto pieces scored', exact: true }).click();
  await navigate(page, 'Backups & sharing');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download workspace backup', exact: true }).click();
  const downloaded = await pending;
  const buffer = await readFile((await downloaded.path())!);
  expect(Object.keys(JSON.parse(buffer.toString()).localDrafts)).toHaveLength(1);
  await navigate(page, 'Event settings');
  await page.locator('.danger-zone > summary').click();
  await page.getByRole('button', { name: 'Reset workspace', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Reset workspace', exact: true })
    .click();
  await navigate(page, 'Backups & sharing');
  await page
    .getByLabel('Import JSON backup', { exact: true })
    .setInputFiles({ name: 'restore.json', mimeType: 'application/json', buffer });
  const review = page.getByRole('dialog', { name: 'Review your import' });
  await review.getByRole('radio', { name: /Replace workspace from backup/ }).check();
  await review.getByRole('button', { name: 'Replace workspace', exact: true }).click();
  await navigate(page, 'Scout');
  await expect(page.getByLabel('Scout name', { exact: true })).toHaveValue('Draft scout');
  await expect(page.getByLabel('Auto pieces scored', { exact: true })).toHaveValue('1');
});

test('failed browser writes show a recovery path and retain the current draft', async ({
  page,
}) => {
  await setup(page);
  await navigate(page, 'Scout');
  await expect.poll(async () => (await current(page))?.backup.data.events.length).toBe(1);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as unknown as { restoreWrite: () => void }).restoreWrite = () => {
      IDBObjectStore.prototype.put = original;
    };
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    };
  });
  await page.getByLabel('Scout name', { exact: true }).fill('Keep this draft');
  await expect(page.getByRole('alert')).toContainText('could not save');
  await expect(page.getByLabel('Scout name', { exact: true })).toHaveValue('Keep this draft');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download current backup', exact: true }).click();
  const downloaded = await pending;
  const backup = JSON.parse(await readFile((await downloaded.path())!, 'utf8'));
  expect(
    Object.values(backup.localDrafts).some(
      (draft: unknown) => (draft as { scout?: string }).scout === 'Keep this draft',
    ),
  ).toBe(true);
  await page.evaluate(() => (window as unknown as { restoreWrite: () => void }).restoreWrite());
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Scout name', { exact: true })).toHaveValue('Keep this draft');
});

test('a paused save keeps the form and never reports a saved observation', async ({
  page,
  context,
}) => {
  await setup(page);
  await navigate(page, 'Scout');
  await page.getByLabel('Scout name', { exact: true }).fill('Original scout');
  const other = await context.newPage();
  await other.goto('/');
  await navigate(other, 'Scout');
  await other.getByLabel('Scout name', { exact: true }).fill('Other scout');
  await expect(page.locator('.storage-banner')).toContainText('Another tab changed');
  await page.getByRole('button', { name: 'Save observation', exact: true }).click();
  await expect(page.getByLabel('Scout name', { exact: true })).toHaveValue('Original scout');
  await expect(page.locator('.scout-layout .error')).toContainText('not saved');
  await expect(page.getByRole('status')).not.toContainText('Match Q1 saved');
  await expect(page.locator('.summary-count')).toHaveText('0');
  await other.close();
});

test('metric changes preserve the original draft until the scout reviews it', async ({ page }) => {
  await setup(page);
  await navigate(page, 'Scout');
  await page.getByLabel('Scout name', { exact: true }).fill('Metric scout');
  await page.getByRole('button', { name: 'Increase Teleop pieces scored', exact: true }).click();
  await navigate(page, 'Event settings');
  await page.getByRole('button', { name: 'Edit event Practice', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit event' });
  await editor.getByText('Customize scouting metrics', { exact: true }).click();
  await editor.getByRole('button', { name: 'Remove metric 2', exact: true }).click();
  await editor.getByRole('button', { name: 'Save event', exact: true }).click();
  await navigate(page, 'Scout');
  await expect(page.getByText('The event metrics changed.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save observation', exact: true }).click();
  await expect(page.locator('.scout-layout .error')).toContainText('event metrics changed');
  await expect(page.getByLabel('Scout name', { exact: true })).toHaveValue('Metric scout');
  await page.getByRole('button', { name: 'Update draft metrics', exact: true }).click();
  await page.getByRole('button', { name: 'Save observation', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Match Q1 saved');
});

test('expanded optional controls and dialogs remain accessible', async ({ page }) => {
  await setup(page);
  await navigate(page, 'Scout');
  await page.getByText('Notes, defense & reliability', { exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await navigate(page, 'Plan');
  await page.getByRole('button', { name: 'Set priorities', exact: true }).click();
  await page.getByRole('button', { name: 'Compare another alliance', exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await navigate(page, 'Event settings');
  await page.getByRole('button', { name: 'Edit event Practice', exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
