import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../Icon/Icon';
import Crest from '../Crest/Crest';
import { getAllCachedTeams } from '../../../lib/matchCache';
import type { CachedTeam } from '../../../lib/matchCache';
import styles from './SearchModal.module.css';

// ── Static competitions list ───────────────────────────────────────────────

const COMPETITIONS = [
  { code: 'CL',  name: 'UEFA Champions League', country: 'Europe',      flag: '#1a3a6b' },
  { code: 'PL',  name: 'Premier League',         country: 'England',     flag: '#3d0d6b' },
  { code: 'PD',  name: 'Primera Division',       country: 'Spain',       flag: '#8b0000' },
  { code: 'SA',  name: 'Serie A',                country: 'Italy',       flag: '#003580' },
  { code: 'BL1', name: 'Bundesliga',             country: 'Germany',     flag: '#cc0000' },
  { code: 'FL1', name: 'Ligue 1',                country: 'France',      flag: '#003189' },
  { code: 'BSA', name: 'Campeonato Brasileiro',  country: 'Brazil',      flag: '#006400' },
  { code: 'ELC', name: 'Championship',           country: 'England',     flag: '#2d0d5b' },
  { code: 'DED', name: 'Eredivisie',             country: 'Netherlands', flag: '#ff6600' },
  { code: 'PPL', name: 'Primeira Liga',          country: 'Portugal',    flag: '#006600' },
  { code: 'WC',  name: 'FIFA World Cup',         country: 'World',       flag: '#8b6914' },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function score(name: string, q: string): number {
  const n = name.toLowerCase();
  const s = q.toLowerCase();
  if (n === s) return 3;
  if (n.startsWith(s)) return 2;
  if (n.includes(s)) return 1;
  return 0;
}

interface SearchModalProps {
  onClose: () => void;
  locale: string;
}

export default function SearchModal({ onClose, locale }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const teams = getAllCachedTeams();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // ── Filter results ───────────────────────────────────────────────────────

  const q = query.trim();

  const matchedComps = q.length < 1
    ? COMPETITIONS.slice()
    : COMPETITIONS.filter(c => score(c.name, q) > 0 || score(c.country, q) > 0)
        .sort((a, b) => score(b.name, q) - score(a.name, q));

  const matchedTeams: CachedTeam[] = q.length < 2
    ? []
    : teams.filter(t => score(t.name, q) > 0)
        .sort((a, b) => score(b.name, q) - score(a.name, q))
        .slice(0, 8);

  const isEmpty = matchedComps.length === 0 && matchedTeams.length === 0;

  function goComp(code: string) {
    navigate(`/${locale}/competition/${code}`);
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className={styles.inputRow}>
          <Icon name="search" size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search teams, competitions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => setQuery('')}>
              <Icon name="x" size={14} />
            </button>
          )}
          <button className={styles.escBtn} onClick={onClose}>Esc</button>
        </div>

        <div className={styles.results}>
          {/* Competitions section */}
          {matchedComps.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Competitions</div>
              {matchedComps.map(comp => (
                <button key={comp.code} className={styles.row} onClick={() => goComp(comp.code)}>
                  <div className={styles.flagBar} style={{ backgroundColor: comp.flag }} />
                  <div className={styles.rowBody}>
                    <div className={styles.rowName}>{comp.name}</div>
                    <div className={styles.rowSub}>{comp.country}</div>
                  </div>
                  <Icon name="chevron-right" size={13} style={{ color: 'var(--text-faint)' }} />
                </button>
              ))}
            </div>
          )}

          {/* Teams section */}
          {matchedTeams.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Teams</div>
              {matchedTeams.map(team => (
                <button
                  key={team.id}
                  className={styles.row}
                  onClick={() => { navigate(`/${locale}/team/${team.id}`); onClose(); }}
                >
                  <Crest
                    team={{ id: team.id, name: team.name, short: team.name.slice(0, 3), initial: team.name.slice(0, 3), color: '#3a3a48', crest: team.crest, score: null }}
                    size="sm"
                  />
                  <div className={styles.rowBody}>
                    <div className={styles.rowName}>{team.name}</div>
                    <div className={styles.rowSub}>{team.compCountry} · {team.compName}</div>
                  </div>
                  <Icon name="chevron-right" size={13} style={{ color: 'var(--text-faint)' }} />
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {q.length > 1 && isEmpty && (
            <div className={styles.empty}>
              <Icon name="search" size={24} style={{ color: 'var(--text-faint)', marginBottom: 8 }} />
              <div>No results for <strong>"{q}"</strong></div>
              <div className={styles.emptySub}>Try a team or competition name</div>
            </div>
          )}

          {/* Hint when nothing typed */}
          {q.length === 0 && (
            <div className={styles.hint}>
              Start typing to search teams or competitions
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
