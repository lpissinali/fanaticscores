/**
 * Shared in-memory follow state with cross-component sync.
 * Replace with a real persistence layer (localStorage / user account) in production.
 */
import { useState, useEffect } from 'react';

const followingSet = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function useFollowing(name: string): [boolean, (e?: React.MouseEvent) => void] {
  const [, rerender] = useState(0);

  useEffect(() => {
    const handler = () => rerender((n) => n + 1);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const followed = followingSet.has(name);

  const toggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (followingSet.has(name)) {
      followingSet.delete(name);
    } else {
      followingSet.add(name);
    }
    notify();
  };

  return [followed, toggle];
}
