import { useState } from 'react';
import { z } from 'zod';
import { SlidersHorizontal, Users, RotateCcw, EyeOff, ArrowUpRight } from 'lucide-react';
import { useWorkspace } from '../context';
import type { ScoutEvent } from '../domain';
import { rankTeams } from '../analytics';
import type { TeamStats } from '../analytics';
import { useEventStats } from '../useEventStats';
import { PageHeading, PanelTitle, Empty, fmt } from '../components/ui';

const PlannerSchema = z.object({
  weights: z.record(z.string(), z.number().min(0).max(10)),
  reliability: z.number().min(0).max(10),
  defense: z.number().min(0).max(10),
  slots: z
    .array(z.number().int().min(0).max(99999))
    .length(6)
    .refine((slots) => new Set(slots.filter(Boolean)).size === slots.filter(Boolean).length),
  excluded: z.array(z.number().int()).max(500),
});
export default function Planner({ event }: { event: ScoutEvent }) {
  const { workspace, setDraft } = useWorkspace();
  const initial = () => ({
    weights: Object.fromEntries(event.metrics.map((m) => [m.id, 5])),
    reliability: 5,
    defense: 2,
    slots: [0, 0, 0, 0, 0, 0],
    excluded: [] as number[],
  });
  const [plan, updatePlan] = useState(() => {
    const p = PlannerSchema.safeParse(workspace.drafts['planner:' + event.id]);
    return p.success
      ? {
          ...p.data,
          slots: p.data.slots.map((n) => (event.teams.some((t) => t.number === n) ? n : 0)),
        }
      : initial();
  });
  const [showExcluded, setShowExcluded] = useState(false);
  const [controls, setControls] = useState(false);
  const [comparison, setComparison] = useState(false);
  function setPlan(next: typeof plan | ((old: typeof plan) => typeof plan)) {
    const value = typeof next === 'function' ? next(plan) : next;
    if (setDraft('planner:' + event.id, value)) updatePlan(value);
  }
  const summaries = useEventStats(event, workspace.data.matches);
  const ranking = rankTeams(
    event,
    workspace.data.matches,
    plan.weights,
    plan.reliability,
    plan.defense,
    summaries,
  );
  const allZero =
    Object.values(plan.weights).every((w) => !w) && !plan.reliability && !plan.defense;
  const picks = ranking.filter(
    (t) => !plan.slots.includes(t.number) && (showExcluded || !plan.excluded.includes(t.number)),
  );
  const alliance = (indices: number[]) =>
    indices
      .map((i) => plan.slots[i])
      .filter(Boolean)
      .map((number) => summaries.get(number)!);
  const a = alliance([0, 1, 2]),
    b = alliance([3, 4, 5]);
  const estimate = (teams: TeamStats[]) => teams.reduce((sum, t) => sum + t.average, 0);
  const coverage = (teams: TeamStats[]) => teams.filter((t) => t.matches > 0).length;
  function slot(index: number, number: number) {
    setPlan((old) => ({ ...old, slots: old.slots.map((n, i) => (i === index ? number : n)) }));
  }
  return (
    <>
      <PageHeading
        eyebrow=""
        title="Plan"
        description="Build your alliance and keep a working pick list."
        action={
          <button
            className="button secondary"
            aria-expanded={controls}
            onClick={() => setControls(!controls)}
          >
            <SlidersHorizontal size={16} />
            {controls ? 'Hide priorities' : 'Set priorities'}
          </button>
        }
      />
      <div className={'planner-grid ' + (!controls ? 'wide-planner' : '')}>
        {controls && (
          <aside className="panel priorities">
            <PanelTitle
              title="What matters to you?"
              description="Adjust the pick-list priorities."
            />
            <div className="stack">
              {event.metrics.map((metric) => (
                <label className="range-label" key={metric.id}>
                  <span>
                    {metric.name}
                    <strong>{plan.weights[metric.id] || 0}</strong>
                  </span>
                  <input
                    type="range"
                    aria-label={metric.name + ' priority'}
                    min={0}
                    max={10}
                    step={1}
                    value={plan.weights[metric.id] || 0}
                    onChange={(e) =>
                      setPlan({
                        ...plan,
                        weights: { ...plan.weights, [metric.id]: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              ))}
              <label className="range-label">
                <span>
                  Reliability<strong>{plan.reliability}</strong>
                </span>
                <input
                  type="range"
                  aria-label="Reliability priority"
                  min={0}
                  max={10}
                  value={plan.reliability}
                  onChange={(e) => setPlan({ ...plan, reliability: Number(e.target.value) })}
                />
              </label>
              <label className="range-label">
                <span>
                  Defense<strong>{plan.defense}</strong>
                </span>
                <input
                  type="range"
                  aria-label="Defense priority"
                  min={0}
                  max={10}
                  value={plan.defense}
                  onChange={(e) => setPlan({ ...plan, defense: Number(e.target.value) })}
                />
              </label>
              <button
                className="text-button"
                onClick={() =>
                  setPlan((old) => ({
                    ...old,
                    weights: initial().weights,
                    reliability: 5,
                    defense: 2,
                  }))
                }
              >
                <RotateCcw size={14} />
                Reset priorities
              </button>
            </div>
            <details className="methodology">
              <summary>How the pick score works</summary>
              <p>
                Each metric average is divided by the best observed average in this event.
                Reliability is the fraction of matches without a disable; defense is the average
                rating divided by 5.
              </p>
              <p>
                Each normalized value is multiplied by your priority. The sum is divided by all
                priorities and scaled to 100. Missing and disputed matches are excluded. This is a
                relative comparison, not a win probability.
              </p>
              <p>
                Scouting-total weights from Event settings do not change here. These sliders only
                change the pick-list score.
              </p>
            </details>
          </aside>
        )}
        <div className="stack">
          <section className="panel">
            <PanelTitle
              title="Your alliance"
              description="Choose three teams to compare their combined averages."
              action={
                <button
                  className="text-button"
                  onClick={() => setPlan({ ...plan, slots: [0, 0, 0, 0, 0, 0] })}
                >
                  Clear slots
                  <RotateCcw size={14} />
                </button>
              }
            />
            <div className="alliance-builder">
              {(comparison ? ['Your alliance', 'Comparison alliance'] : ['Your alliance']).map(
                (label, ai) => (
                  <div className={'alliance-card ' + (ai ? 'blue-card' : 'red-card')} key={label}>
                    <h3>
                      <i className={'alliance-dot ' + (ai ? 'blue' : 'red')} />
                      {label}
                    </h3>
                    {[0, 1, 2].map((n) => {
                      const index = ai * 3 + n;
                      return (
                        <label className="alliance-slot" key={index}>
                          <span>{n + 1}</span>
                          <select
                            aria-label={label + ' slot ' + (n + 1)}
                            value={plan.slots[index]}
                            onChange={(e) => slot(index, Number(e.target.value))}
                          >
                            <option value={0}>Choose a team</option>
                            {event.teams.map((t) => (
                              <option
                                disabled={
                                  plan.slots.includes(t.number) && plan.slots[index] !== t.number
                                }
                                key={t.number}
                                value={t.number}
                              >
                                {t.number} · {t.name || 'Team ' + t.number}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                    <div className="alliance-estimate">
                      <strong>{(ai ? b : a).length ? fmt(estimate(ai ? b : a)) : '—'}</strong>
                      <span>combined average scouting total</span>
                      <small>
                        {coverage(ai ? b : a)} / {(ai ? b : a).length} selected teams have usable
                        observations
                      </small>
                    </div>
                  </div>
                ),
              )}
            </div>
            <button
              className="text-button compare-toggle"
              aria-expanded={comparison}
              onClick={() => setComparison(!comparison)}
            >
              {comparison ? 'Hide comparison alliance' : 'Compare another alliance'}
            </button>
            <details className="notice subtle">
              <summary>About combined totals</summary>
              <Users size={18} />
              <span>
                Combined totals add individual averages. They do not model field congestion,
                autonomous overlap, matchups, or game rules. Check pit notes with the drive team.
              </span>
            </details>
          </section>
          <section className="panel">
            <PanelTitle
              title="Your working pick list"
              description="Ranked by your priorities · selected teams are removed"
              action={
                <button className="text-button" onClick={() => setShowExcluded(!showExcluded)}>
                  <EyeOff size={14} />
                  {showExcluded ? 'Hide unavailable' : 'Show unavailable'}
                </button>
              }
            />
            {allZero && (
              <div role="status" className="notice amber">
                All priorities are zero. Increase a slider to create a meaningful ranking.
              </div>
            )}
            {picks.length ? (
              <div className="pick-list">
                {picks.map((t, index) => (
                  <div
                    key={t.number}
                    className={'pick-row ' + (plan.excluded.includes(t.number) ? 'excluded' : '')}
                  >
                    <span className="rank">{String(index + 1).padStart(2, '0')}</span>
                    <div className="pick-team">
                      <strong>
                        {t.number} <span>{t.name}</span>
                      </strong>
                      <span>
                        {t.matches
                          ? t.matches + ' matches · ' + fmt(t.reliability, 0) + '% reliable'
                          : 'No usable match observations'}
                        {t.conflicts ? ' · review needed' : ''}
                      </span>
                    </div>
                    <div className="pick-score">
                      <strong>{t.matches ? fmt(t.rankScore) : '—'}</strong>
                      <span>pick score</span>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={
                        (plan.excluded.includes(t.number)
                          ? 'Mark available team '
                          : 'Mark unavailable team ') + t.number
                      }
                      aria-pressed={plan.excluded.includes(t.number)}
                      onClick={() =>
                        setPlan({
                          ...plan,
                          excluded: plan.excluded.includes(t.number)
                            ? plan.excluded.filter((n) => n !== t.number)
                            : [...plan.excluded, t.number],
                        })
                      }
                    >
                      <EyeOff size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={'Add team ' + t.number + ' to your alliance'}
                      disabled={
                        !plan.slots.slice(0, 3).includes(0) || plan.excluded.includes(t.number)
                      }
                      onClick={() => slot(plan.slots.slice(0, 3).indexOf(0), t.number)}
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No available teams">
                Add a roster, clear a slot, or show teams you marked unavailable.
              </Empty>
            )}
            <div className="panel-foot">
              Small samples can be misleading. Review match consistency and pit notes before
              committing to a pick.
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
