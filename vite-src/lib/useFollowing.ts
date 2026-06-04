/**
 * Following store — persisted to localStorage.
 * Exposes both React hooks and plain helpers so non-hook
 * code (e.g. API layer) can read the state synchronously.
 */
import { useState, useEffect } from 'react';

export interface FollowedTeam {
  id?: string;
  name: string;
  initial: string;
  color: string;
  crest?: string;
}

const STORAGE_KEY = 'fs_following_v1';

function load(): Map<string, FollowedTeam> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr: FollowedTeam[] = JSON.parse(raw);
    return new Map(arr.map(t => [t.name, t]));
  } catch {
    return new Map();
  }
}

function save(map: Map<string, FollowedTeam>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...map.values()]));
  } catch {}
}

// Module-level singleton so all components share the same state.
let store = load();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(fn => fn());
}

// ── Plain (non-hook) helpers — safe to call from API layer ──────────────────

export function getFollowedNames(): Set<string> {
  return new Set(store.keys());
}

// ── React hooks ────────────────────────────────────────────────────────────

/** Returns the full list of followed teams; re-renders on changes. */
export function useAllFollowed(): FollowedTeam[] {
  const [, rerender] = useState(0);
  useEffect(() => {
    const h = () => rerender(n => n + 1);
    listeners.add(h);
    return () => { listeners.delete(h); };
  }, []);
  return [...store.values()];
}

/** Returns [isFollowed, toggleFn] for a specific team. */
export function useFollowing(
  team: FollowedTeam,
): [boolean, (e?: React.MouseEvent) => void] {
  const [, rerender] = useState(0);
  useEffect(() => {
    const h = () => rerender(n => n + 1);
    listeners.add(h);
    return () => { listeners.delete(h); };
  }, []);

  const followed = store.has(team.name);

  const toggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (store.has(team.name)) {
      store.delete(team.name);
    } else {
      store.set(team.name, {
        id:      team.id,
        name:    team.name,
        initial: team.initial,
        color:   team.color,
        crest:   team.crest,
      });
    }
    save(store);
    notify();
  };

  return [followed, toggle];
}
