import { useMemo } from 'react';
import { eventStats } from './analytics';
import type { Match, ScoutEvent } from './domain';

export function useEventStats(event: ScoutEvent, matches: Match[]) {
  return useMemo(() => eventStats(event, matches), [event, matches]);
}
