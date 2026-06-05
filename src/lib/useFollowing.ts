'use client';
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

// Module-level singleton — initialised lazily on first client interaction
// to avoid reading localStorage during SSR (which causes hydration mismatches).
let store: Map<string, FollowedTeam> = new Map();
let storeLoaded = false;
const listeners = new Set<() => void>();

function ensureLoaded() {
  if (!storeLoaded) {
    store = load();
    storeLoaded = true;
  }
}

function notify() {
  listeners.forEach(fn => fn());
}

// ── Plain (non-hook) helpers — safe to call from API layer ──────────────────

export function getFollowedNames(): Set<string> {
  ensureLoaded();
  return new Set(store.keys());
}

// ── React hooks ────────────────────────────────────────────────────────────

/** Returns the full list of followed teams; re-renders on changes.
 *  Starts empty (matching SSR), loads from localStorage after hydration. */
export function useAllFollowed(): FollowedTeam[] {
  const [teams, setTeams] = useState<FollowedTeam[]>([]);

  useEffect(() => {
    // Load from localStorage after hydration to avoid SSR mismatch
    ensureLoaded();
    setTeams([...store.values()]);

    const h = () => setTeams([...store.values()]);
    listeners.add(h);
    return () => { listeners.delete(h); };
  }, []);

  return teams;
}

/** Returns [isFollowed, toggleFn] for a specific team. */
export function useFollowing(
  team: FollowedTeam,
): [boolean, (e?: React.MouseEvent) => void] {
  const [followed, setFollowed] = useState(false);

  useEffect(() => {
    ensureLoaded();
    setFollowed(store.has(team.name));

    const h = () => setFollowed(store.has(team.name));
    listeners.add(h);
    return () => { listeners.delete(h); };
  }, [team.name]);

  const toggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    ensureLoaded();
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
