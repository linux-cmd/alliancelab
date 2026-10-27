import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

async function navigate(page: import('@playwright/test').Page, name: string) {
  const labels: Record<string, string> = {
    Overview: 'Home',
    'Scout a match': 'Scout',
    'Teams & insights': 'Teams',
    'Alliance lab': 'Plan',
    'Transfer center': 'Backups & sharing',
  };
  name = labels[name] || name;
  const open = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await open.isVisible()) await open.click();
  const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
  if (['Backups & sharing', 'Event settings'].includes(name)) {
    const manage = sidebar.locator('.manage-menu');
    if (!(await manage.getAttribute('open'))) {
      if (!(await manage.evaluate((el) => (el as HTMLDetailsElement).open)))
        await manage.locator('summary').click();
    }
  }
  await sidebar.getByRole('button', { name, exact: true }).click();
}
async function demo(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lone Star Practice' })).toBeVisible();
}
async function createEvent(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create an event' });
  await dialog.getByLabel('Event name', { exact: true }).fill('Test Regional');
  await dialog.getByLabel('Location', { exact: true }).fill('Test venue');
  await dialog
    .getByLabel(/^Team roster/)
    .fill('6901, Knights Robotics\n254, The Cheesy Poofs\n118, Robonauts');
  await dialog.getByRole('button', { name: 'Create event', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test('create an event, save and edit a match, compare teams, then retain data after reload', async ({
  page,
}) => {
  await createEvent(page);
  await navigate(page, 'Scout a match');
  await page.getByLabel('Scout name', { exact: true }).fill('Abhijay');
  await page.getByRole('button', { name: 'Increase Auto pieces scored', exact: true }).click();
  await page.getByRole('button', { name: 'Increase Teleop pieces scored', exact: true }).click();
  await page.getByRole('button', { name: 'Increase Teleop pieces scored', exact: true }).click();
  await page.getByLabel('Endgame completed', { exact: true }).click();
  await page.getByText('Notes, defense & reliability', { exact: true }).click();
  await page.getByRole('button', { name: 'Defense rating 4', exact: true }).click();
  await page.getByLabel('Match notes', { exact: true }).fill('Clean intake, repeatable auto.');
  await page.getByRole('button', { name: 'Save observation', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Match Q1 saved');
  await expect(page.locator('.match-log tbody tr')).toHaveCount(1);
  await page.locator('.match-log > summary').click();
  await page.getByRole('button', { name: 'Edit team 6901 match 1', exact: true }).click();
  await page.getByRole('button', { name: 'Increase Teleop pieces scored', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.match-log tbody tr')).toHaveCount(1);
  await expect(page.locator('.match-log tbody tr')).toContainText('11');
  await navigate(page, 'Teams & insights');
  await page.getByLabel('Compare team 6901', { exact: true }).check();
  await page.getByLabel('Compare team 254', { exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Side by side' })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: '6901 Knights Robotics', exact: true }),
  ).toBeVisible();
  await navigate(page, 'Scout a match');
  await expect(page.locator('.match-log tbody tr')).toHaveCount(1);
});

test('match drafts survive navigation and offline reload including unvisited lazy pages', async ({
  page,
  context,
}) => {
  await createEvent(page);
  await navigate(page, 'Scout a match');
  await page.getByLabel('Scout name', { exact: true }).fill('Offline scout');
  await page.getByText('Notes, defense & reliability', { exact: true }).click();
  await page
    .getByLabel('Match notes', { exact: true })
    .fill('Saved draft before the connection drops');
  await page.waitForTimeout(500);
  await navigate(page, 'Overview');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Test Regional' })).toBeVisible();
  await navigate(page, 'Scout a match');
  await expect(page.getByLabel('Scout name', { exact: true })).toHaveValue('Offline scout');
  await page.getByText('Notes, defense & reliability', { exact: true }).click();
  await expect(page.getByLabel('Match notes', { exact: true })).toHaveValue(
    'Saved draft before the connection drops',
  );
  await page.getByRole('button', { name: 'Save observation', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('saved');
  await navigate(page, 'Transfer center');
  await expect(page.getByRole('heading', { name: 'Back up your workspace' })).toBeVisible();
  await context.setOffline(false);
});

test('backup export and import are reviewed, repeatable and do not multiply observations', async ({
  page,
}) => {
  await demo(page);
  await navigate(page, 'Transfer center');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download workspace backup', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const buffer = await readFile(path!);
  const parsed = JSON.parse(buffer.toString());
  expect(parsed.data.matches).toHaveLength(30);
  await page
    .getByLabel('Import JSON backup', { exact: true })
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
  const review = page.getByRole('dialog', { name: 'Review your import' });
  await expect(review).toBeVisible();
  await expect(review).toContainText('36 unchanged records');
  await review.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByLabel('Import JSON backup', { exact: true })
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
  await page.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('36 unchanged');
  await navigate(page, 'Overview');
  await expect(
    page.locator('.stat').filter({ has: page.getByText('Match observations', { exact: true }) }),
  ).toContainText('30');
});

test('malformed import fails visibly without changing the workspace', async ({ page }) => {
  await demo(page);
  await navigate(page, 'Transfer center');
  await page.getByLabel('Import JSON backup', { exact: true }).setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole('alert')).toContainText('unsupported or invalid');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await navigate(page, 'Overview');
  await expect(
    page.locator('.stat').filter({ has: page.getByText('Match observations', { exact: true }) }),
  ).toContainText('30');
});

test('QR frames are generated and can be received in reverse order through text fallback', async ({
  page,
}) => {
  await demo(page);
  await navigate(page, 'Transfer center');
  await page.getByRole('button', { name: 'QR transfer', exact: true }).click();
  await page.getByRole('button', { name: 'Generate QR frames', exact: true }).click();
  await expect(page.getByRole('img', { name: /AllianceLab transfer QR frame 1/ })).toBeVisible();
  await page.getByText('Transfer text for this frame', { exact: true }).click();
  const parts: string[] = [];
  for (;;) {
    parts.push(await page.getByLabel('QR frame text', { exact: true }).inputValue());
    const next = page.getByRole('button', { name: 'Next QR frame', exact: true });
    if (await next.isDisabled()) break;
    await next.click();
  }
  await page.getByText('Paste a frame’s transfer text', { exact: true }).click();
  for (const text of parts.reverse()) {
    await page.getByLabel('Received QR frame text', { exact: true }).fill(text);
    await page.getByRole('button', { name: 'Add frame', exact: true }).click();
  }
  await expect(page.getByRole('dialog', { name: 'Review your import' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('unchanged');
});

test('pit notes persist and are visible in team details', async ({ page }) => {
  await createEvent(page);
  await navigate(page, 'Scout a match');
  await page.getByRole('button', { name: 'Pit scouting', exact: true }).click();
  await page.getByLabel('Scout name', { exact: true }).fill('Abhijay');
  await page.getByLabel('Drivetrain', { exact: true }).selectOption('Swerve');
  await page.getByLabel('Robot weight (lb, optional)', { exact: true }).fill('115');
  await page.getByLabel('Strengths', { exact: true }).fill('Very consistent intake.');
  await page.getByRole('button', { name: 'Save pit notes', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Pit notes saved');
  await navigate(page, 'Teams & insights');
  await page.getByRole('button', { name: 'View team 6901', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Very consistent intake.');
  await expect(page.getByRole('dialog')).toContainText('115 lb');
});

test('planner keeps team assignments unique and persists priorities', async ({ page }) => {
  await demo(page);
  await navigate(page, 'Alliance lab');
  await page.getByRole('button', { name: 'Compare another alliance', exact: true }).click();
  await page.getByRole('button', { name: 'Set priorities', exact: true }).click();
  await page.getByLabel('Your alliance slot 1', { exact: true }).selectOption('6901');
  await expect(
    page.getByLabel('Comparison alliance slot 1', { exact: true }).locator('option[value="6901"]'),
  ).toHaveAttribute('disabled', '');
  await page.getByLabel('Auto pieces scored priority', { exact: true }).focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByLabel('Your alliance slot 1', { exact: true })).toHaveValue('6901');
  await page.getByRole('button', { name: 'Set priorities', exact: true }).click();
  await expect(page.getByLabel('Auto pieces scored priority', { exact: true })).toHaveValue('9');
});

test('all screens fit the viewport and have no serious automated accessibility violations', async ({
  page,
}) => {
  await demo(page);
  for (const name of [
    'Overview',
    'Scout a match',
    'Teams & insights',
    'Alliance lab',
    'Transfer center',
    'Event settings',
  ]) {
    await navigate(page, name);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      name + ' overflow',
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const violations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
    }));
    expect(violations, name + ' accessibility').toEqual([]);
  }
});

test('deleting a real event preserves the separate demo and reset requires confirmation', async ({
  page,
}) => {
  await createEvent(page);
  await navigate(page, 'Event settings');
  await page.getByText('About, privacy & demo', { exact: true }).click();
  await page.getByRole('button', { name: 'Open demo event', exact: true }).click();
  await page.getByRole('button', { name: 'Delete event Test Regional', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete Test Regional?' });
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Delete event Lone Star Practice', exact: true }),
  ).toBeVisible();
  await page.locator('.danger-zone > summary').click();
  await page.getByRole('button', { name: 'Reset workspace', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Delete event Lone Star Practice', exact: true }),
  ).toBeVisible();
});

test('unreadable stored data is preserved until an explicit reset', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('alliancelab.workspace.v1', '{unreadable'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Saved data could not be read');
  expect(await page.evaluate(() => localStorage.getItem('alliancelab.workspace.v1'))).toBe(
    '{unreadable',
  );
  await page.getByRole('button', { name: 'Start a new local workspace', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Start empty workspace', exact: true })
    .click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const request = indexedDB.open('alliancelab', 1);
            request.onsuccess = () => {
              const db = request.result;
              const read = db.transaction('workspace').objectStore('workspace').get('current');
              read.onsuccess = () => {
                db.close();
                resolve(read.result?.backup.data.events.length ?? -1);
              };
              read.onerror = () => reject(read.error);
            };
          }),
      ),
    )
    .toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('alliancelab.workspace.v1'))).toBe(
    '{unreadable',
  );
});

test('QR image scanning decodes the generated frames into a reviewed import', async ({ page }) => {
  await demo(page);
  await navigate(page, 'Transfer center');
  await page.getByRole('button', { name: 'QR transfer', exact: true }).click();
  await page.getByRole('button', { name: 'Generate QR frames', exact: true }).click();
  const frames: string[] = [];
  for (;;) {
    const image = page.getByRole('img', { name: /AllianceLab transfer QR frame/ });
    await expect(image).toBeVisible();
    frames.push((await image.getAttribute('src'))!);
    const next = page.getByRole('button', { name: 'Next QR frame', exact: true });
    if (await next.isDisabled()) break;
    const old = await image.getAttribute('src');
    await next.click();
    await expect(image).not.toHaveAttribute('src', old!);
  }
  for (const [i, image] of frames.entries()) {
    await page.locator('.scanner input[type=file]').setInputFiles({
      name: 'frame-' + i + '.png',
      mimeType: 'image/png',
      buffer: Buffer.from(image.split(',')[1], 'base64'),
    });
    if (i < frames.length - 1)
      await expect(page.getByLabel('QR transfer progress')).toHaveAttribute('value', String(i + 1));
  }
  await expect(page.getByRole('dialog', { name: 'Review your import' })).toBeVisible();
});

test('another tab updating the workspace pauses saving to prevent silent data loss', async ({
  page,
  context,
}) => {
  await demo(page);
  const other = await context.newPage();
  await other.goto('/');
  await navigate(other, 'Scout a match');
  await other.getByLabel('Scout name', { exact: true }).fill('Other scout');
  await expect(page.getByRole('alert')).toContainText('Another tab changed this workspace');
  await expect(
    page.getByRole('button', { name: 'Reload latest workspace', exact: true }),
  ).toBeVisible();
  await other.close();
});
