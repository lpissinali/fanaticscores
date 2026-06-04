'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSEO } from '../../lib/useSEO';
import Icon from '../../components/shared/Icon/Icon';
import StudioCard, { CardThumb, CARD_DIMS, type CardConfig, type CardTemplate, type CardFormat, type CardStyle } from './StudioCard';
import { getCachedMatch, type CachedMatch } from '../../lib/matchCache';
import { useMatches, fetchMatchday } from '../../lib/useMatches';
import type { SupportedLocale } from '../../i18n';
import type { Match, Competition } from '../../lib/types';
import styles from './StudioPage.module.css';

interface StudioPageProps { locale: SupportedLocale; }

// ── Auto-generate hashtags from match ─────────────────────────────────────────

function generateHashtags(m: CachedMatch): string[] {
  const { match, competition, compCode } = m;
  const tags: string[] = [];
  const clean = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  tags.push(`#${match.home.initial.toLowerCase()}${match.away.initial.toLowerCase()}`);
  if (compCode) tags.push(`#${compCode.toLowerCase()}`);
  tags.push(`#${clean(match.home.name)}`);
  tags.push(`#${clean(match.away.name)}`);
  tags.push(`#${clean(competition)}`);
  return [...new Set(tags)].slice(0, 6);
}

// ── Change-match popover ──────────────────────────────────────────────────────

type PopoverTab = 'live' | 'today' | 'upcoming' | 'past7';

// Friendly date label e.g. "Yesterday · Tue 18 May"
function dateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  const formatted = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  if (diff === 1) return `Yesterday · ${formatted}`;
  if (diff === 0) return `Today · ${formatted}`;
  if (diff === -1) return `Tomorrow · ${formatted}`;
  return formatted;
}

function MatchList({ groups, onSelect }: {
  groups: { label?: string; comp: Competition }[];
  onSelect: (m: Match, comp: Competition) => void;
}) {
  return (
    <>
      {groups.map(({ label, comp }, gi) => (
        <div key={`${gi}-${comp.id}`} className={styles.popoverGroup}>
          <div className={styles.popoverGroupLabel}>
            <span className={styles.popoverGroupDot} style={{ background: comp.flag || 'var(--orange)' }} />
            {label ? <><span style={{ color: 'var(--text-dim)', marginRight: 4 }}>{label}</span></> : null}
            {comp.name.toUpperCase()}
            <span className={styles.popoverGroupCount}>{comp.matches.length}</span>
          </div>
          {comp.matches.map(m => {
            const hasScore = m.home.score !== null && m.away.score !== null;
            const isLive = m.status === 'LIVE' || m.status === 'HT';
            const statusText = m.status === 'FT' ? 'FT' : m.status === 'HT' ? 'HT' : isLive ? (m.minute ?? '') : (m.kickoff ?? '');
            return (
              <button key={m.id} className={styles.popoverMatch} onClick={() => onSelect(m, comp)}>
                <div className={styles.popoverMatchMin}>
                  {isLive && <span className={styles.liveDot} />}
                  <span style={{ color: isLive ? '#ff3b3b' : m.status === 'FT' ? 'var(--text-dim)' : 'var(--text-faint)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                    {statusText}
                  </span>
                </div>
                <div className={styles.popoverMatchTeam}>
                  {m.home.crest && <img src={m.home.crest} width={14} height={14} style={{ objectFit: 'contain' }} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                  <span className={styles.popoverMatchTeamName}>{m.home.name}</span>
                  <span className={styles.popoverMatchTeamFull}>vs</span>
                  {m.away.crest && <img src={m.away.crest} width={14} height={14} style={{ objectFit: 'contain' }} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                  <span className={styles.popoverMatchTeamName}>{m.away.name}</span>
                </div>
                <div className={styles.popoverMatchScore}>
                  {hasScore ? `${m.home.score} – ${m.away.score}` : '–'}
                </div>
                <div className={styles.popoverMatchComp}>{comp.short}</div>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

function MatchPopover({
  competitions, loading, onSelect, onClose, mobile = false,
}: {
  competitions: Competition[];
  loading: boolean;
  onSelect: (m: Match, comp: Competition) => void;
  onClose: () => void;
  mobile?: boolean;
}) {
  const [tab, setTab] = useState<PopoverTab>('today');
  const [query, setQuery] = useState('');

  // Past 7 days — lazy loaded on first tab click
  const [pastDays, setPastDays] = useState<{ date: string; comps: Competition[] }[]>([]);
  const [pastLoading, setPastLoading] = useState(false);
  const pastFetched = useRef(false);

  // Upcoming — tomorrow, lazy loaded
  const [upcomingComps, setUpcomingComps] = useState<Competition[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const upcomingFetched = useRef(false);

  const handleTabChange = async (newTab: PopoverTab) => {
    setTab(newTab);
    if (newTab === 'past7' && !pastFetched.current) {
      pastFetched.current = true;
      setPastLoading(true);
      const today = new Date();
      const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (i + 1));
        return d.toISOString().slice(0, 10);
      });
      const results = await Promise.all(
        dates.map(d => fetchMatchday(d).catch(() => ({ competitions: [] as Competition[], featured: null, hadErrors: true, aiBrief: null })))
      );
      setPastDays(dates.map((date, i) => ({ date, comps: results[i].competitions })));
      setPastLoading(false);
    }
    if (newTab === 'upcoming' && !upcomingFetched.current) {
      upcomingFetched.current = true;
      setUpcomingLoading(true);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const result = await fetchMatchday(tomorrow.toISOString().slice(0, 10))
        .catch(() => ({ competitions: [] as Competition[], featured: null, hadErrors: true, aiBrief: null }));
      setUpcomingComps(result.competitions);
      setUpcomingLoading(false);
    }
  };

  // Counts
  const liveCount = competitions.reduce((n, c) =>
    n + c.matches.filter(m => m.status === 'LIVE' || m.status === 'HT').length, 0);
  const todayCount = competitions.reduce((n, c) => n + c.matches.length, 0);
  const upcomingTodayCount = competitions.reduce((n, c) =>
    n + c.matches.filter(m => m.status === 'SCHEDULED').length, 0);

  // Apply search filter to a set of competitions
  const applyQuery = (comps: Competition[]) => {
    if (!query.trim()) return comps;
    const q = query.toLowerCase();
    return comps.map(c => ({
      ...c,
      matches: c.matches.filter(m =>
        m.home.name.toLowerCase().includes(q) ||
        m.away.name.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
      ),
    })).filter(c => c.matches.length > 0);
  };

  // Build groups for the active tab
  const groups: { label?: string; comp: Competition }[] = (() => {
    if (tab === 'live') {
      return applyQuery(
        competitions.map(c => ({ ...c, matches: c.matches.filter(m => m.status === 'LIVE' || m.status === 'HT') }))
          .filter(c => c.matches.length > 0)
      ).map(comp => ({ comp }));
    }
    if (tab === 'today') {
      return applyQuery(competitions).map(comp => ({ comp }));
    }
    if (tab === 'upcoming') {
      const todayScheduled = applyQuery(
        competitions.map(c => ({ ...c, matches: c.matches.filter(m => m.status === 'SCHEDULED') }))
          .filter(c => c.matches.length > 0)
      ).map(comp => ({ comp }));
      const tomorrowComps = applyQuery(upcomingComps).map(comp => ({ comp }));
      return [...todayScheduled, ...tomorrowComps];
    }
    if (tab === 'past7') {
      return pastDays.flatMap(({ date, comps }) =>
        applyQuery(comps
          .map(c => ({ ...c, matches: c.matches.filter(m => m.status === 'FT') }))
          .filter(c => c.matches.length > 0)
        ).map(comp => ({ label: dateLabel(date), comp }))
      );
    }
    return [];
  })();

  const tabs: { id: PopoverTab; label: string; count: number | null }[] = [
    { id: 'live',     label: 'Live now',    count: liveCount },
    { id: 'today',    label: 'Today',       count: todayCount },
    { id: 'upcoming', label: 'Upcoming',    count: upcomingTodayCount },
    { id: 'past7',    label: 'Past 7 days', count: null },
  ];

  const isLoading = (tab === 'past7' && pastLoading) || (tab === 'upcoming' && upcomingLoading) || (tab !== 'past7' && tab !== 'upcoming' && loading);

  return (
    <>
      <div className={mobile ? styles.mobModalBackdrop : styles.popoverBackdrop} onClick={onClose} />
      <div className={mobile ? styles.mobModal : styles.popover}>
        {/* Search */}
        <div className={styles.popoverSearch}>
          <Icon name="search" size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input
            className={styles.popoverInput}
            placeholder="Search matches…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 0, display: 'flex' }}>
              <Icon name="x" size={12} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className={styles.popoverTabs}>
          {tabs.map(t => (
            <button
              key={t.id}
              className={[styles.popoverTab, tab === t.id ? styles.popoverTabActive : ''].join(' ')}
              onClick={() => handleTabChange(t.id)}
            >
              {t.id === 'live' && liveCount > 0 && <span className={styles.liveDot} />}
              {t.label}
              {t.count !== null && t.count > 0 && <span className={styles.popoverTabCount}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Match list */}
        <div className={styles.popoverList}>
          {isLoading && <div className={styles.popoverEmpty}>Loading…</div>}
          {!isLoading && groups.length === 0 && (
            <div className={styles.popoverEmpty}>
              {query ? 'No matches found' : tab === 'live' ? 'No live matches right now' : tab === 'upcoming' ? 'No upcoming matches' : tab === 'past7' ? 'No results for the past 7 days' : 'No matches today'}
            </div>
          )}
          {!isLoading && <MatchList groups={groups} onSelect={onSelect} />}
        </div>
      </div>
    </>
  );
}

// ── Style swatch ──────────────────────────────────────────────────────────────

const STYLES: { id: CardStyle; label: string; sub: string; swatch: string | [string, string] }[] = [
  { id: 'dark',  label: 'Dark',  sub: 'Default · feed-friendly', swatch: '#fc8003' },
  { id: 'light', label: 'Light', sub: 'Daylight feeds',          swatch: '#f8f8fa' },
  { id: 'paper', label: 'Paper', sub: 'Editorial · warm cream',  swatch: '#f5f0e8' },
  // { id: 'team',  label: 'Team',  sub: 'Auto: home & away colors', swatch: ['#3b82f6', '#f59e0b'] },
  { id: 'pitch', label: 'Pitch', sub: 'Matchday green',          swatch: '#25c264' },
];

const FORMATS: { id: CardFormat; label: string; ratio: string }[] = [
  { id: 'square', label: 'Square', ratio: '1:1'  },
  { id: 'story',  label: 'Story',  ratio: '9:16' },
  { id: 'wide',   label: 'Wide',   ratio: '16:9' },
];

const TEMPLATES: CardTemplate[] = ['minimal', 'moment', 'stat', 'ticker'];

const SHARE_PLATFORMS = [
  { id: 'ig', label: 'Instagram', abbr: 'IG' },
  { id: 'x',  label: 'X',        abbr: 'X'  },
  { id: 'tt', label: 'TikTok',   abbr: 'TT' },
  { id: 'wa', label: 'WhatsApp', abbr: 'WA' },
  { id: 'fb', label: 'Facebook', abbr: 'FB' },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StudioPage({ locale }: StudioPageProps) {
  const { matchId } = useParams() as { matchId?: string };
  const router = useRouter();

  useSEO({
    title: 'Share Studio — Create Football Match Cards',
    description: 'Turn any football match into a shareable card. Pick a template, customise and post in seconds.',
    canonical: matchId ? `/en/studio/${matchId}` : '/en/studio',
    noIndex: !!matchId,
  });

  const [selectedMatch, setSelectedMatch] = useState<CachedMatch | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [config, setConfig] = useState<CardConfig>({
    template: 'minimal',
    format:   'square',
    style:    'dark',
    caption:  '',
  });
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [copied, setCopied] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [mobileTab, setMobileTab] = useState<'customize' | 'preview' | 'share'>('preview');

  const previewRef    = useRef<HTMLDivElement>(null);
  const mobPreviewRef = useRef<HTMLDivElement>(null);
  const captureRef    = useRef<HTMLDivElement>(null);
  const [previewWidth,    setPreviewWidth]    = useState(500);
  const [mobPreviewWidth, setMobPreviewWidth] = useState(375);

  const { competitions, loading } = useMatches();

  // Load match from URL param or cache
  useEffect(() => {
    if (matchId) {
      const cached = getCachedMatch(matchId);
      if (cached) {
        setSelectedMatch(cached);
        setHashtags(generateHashtags(cached));
        setShowPopover(false);
      } else {
        setShowPopover(true);
      }
    } else {
      setShowPopover(true);
    }
  }, [matchId]);

  // Track desktop preview container width
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setPreviewWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Track mobile preview container width
  useEffect(() => {
    const el = mobPreviewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setMobPreviewWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleSelectMatch = useCallback((m: Match, comp: Competition) => {
    const cached: CachedMatch = {
      match: m,
      competition: comp.name,
      compCountry: comp.country,
      compCode: comp.id,
      compType: 'LEAGUE',
    };
    setSelectedMatch(cached);
    setHashtags(generateHashtags(cached));
    setShowPopover(false);
    router.push(`/${locale}/studio/${m.id}`, { replace: true });
  }, [locale, router]);

  // ── Image capture helpers ───────────────────────────────────────────────────

  const captureCardBlob = useCallback(async (): Promise<Blob | null> => {
    const el = captureRef.current;
    if (!el) return null;
    setCapturing(true);
    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        logging: false,
        backgroundColor: null,
      });
      return await new Promise<Blob | null>(resolve =>
        canvas.toBlob(b => resolve(b), 'image/png'),
      );
    } finally {
      setCapturing(false);
    }
  }, []);

  const matchTitle = selectedMatch
    ? `${selectedMatch.match.home.name} vs ${selectedMatch.match.away.name}`
    : 'FanaticScores Card';

  const handleShare = useCallback(async () => {
    if (!selectedMatch) return;
    const blob = await captureCardBlob();
    if (!blob) return;
    const file = new File([blob], 'fanatic-card.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: matchTitle }).catch(() => {});
    } else {
      // Fallback: download the image
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'fanatic-card.png'; a.click();
      URL.revokeObjectURL(url);
    }
  }, [selectedMatch, captureCardBlob, matchTitle]);

  const handleCopy = useCallback(async () => {
    if (!selectedMatch) return;
    const blob = await captureCardBlob();
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch {
      // ClipboardItem not supported — fall back to downloading
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'fanatic-card.png'; a.click();
      URL.revokeObjectURL(url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [selectedMatch, captureCardBlob]);

  const handleSave = useCallback(async () => {
    if (!selectedMatch) return;
    const blob = await captureCardBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fanatic-card.png'; a.click();
    URL.revokeObjectURL(url);
  }, [selectedMatch, captureCardBlob]);

  const addHashtag = () => {
    const tag = newTag.trim().replace(/^#/, '');
    if (tag && !hashtags.includes(`#${tag}`)) {
      setHashtags(prev => [...prev, `#${tag}`]);
    }
    setNewTag('');
    setAddingTag(false);
  };

  // Scale calculation
  const [cardW, cardH] = CARD_DIMS[config.format];
  const maxPreviewW = Math.min(previewWidth - 48, 560);
  const scale = maxPreviewW / cardW;
  const scaledH = cardH * scale;
  // Mobile preview scale
  const mobPreviewW = Math.min(mobPreviewWidth - 40, cardW);
  const mobScale    = mobPreviewW / cardW;

  // Match info for top bar
  const m = selectedMatch?.match;
  const matchLabel = m
    ? `${m.home.initial} ${m.home.score ?? ''}–${m.away.score ?? ''} ${m.away.initial}`
    : 'No match selected';

  // ── Left panel ──────────────────────────────────────────────────────────────

  const leftPanel = (
    <div className={styles.panel}>
      {/* 01 Template */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}><span className={styles.sectionNum}>01</span> TEMPLATE</div>
        <div className={styles.templateGrid}>
          {TEMPLATES.map((t) => (
            <CardThumb key={t} template={t} selected={config.template === t}
              onClick={() => setConfig(c => ({ ...c, template: t, caption: t === 'minimal' || t === 'stat' ? '' : c.caption }))} />
          ))}
        </div>
      </section>

      {/* 02 Format */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}><span className={styles.sectionNum}>02</span> FORMAT</div>
        <div className={styles.formatRow}>
          {FORMATS.map(f => (
            <button
              key={f.id}
              className={[styles.formatBtn, config.format === f.id ? styles.formatBtnActive : ''].join(' ')}
              onClick={() => setConfig(c => ({ ...c, format: f.id }))}
            >
              <div className={styles.formatIcon} style={{
                aspectRatio: f.id === 'square' ? '1' : f.id === 'story' ? '0.5625' : '1.778',
                width: f.id === 'story' ? 14 : 22,
              }} />
              <span className={styles.formatLabel}>{f.label}</span>
              <span className={styles.formatRatio}>{f.ratio}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 03 Style */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}><span className={styles.sectionNum}>03</span> STYLE</div>
        <div className={styles.styleList}>
          {STYLES.map(s => (
            <button
              key={s.id}
              className={[styles.styleBtn, config.style === s.id ? styles.styleBtnActive : ''].join(' ')}
              onClick={() => setConfig(c => ({ ...c, style: s.id }))}
            >
              {Array.isArray(s.swatch) ? (
                <div className={styles.styleSwatch}>
                  <div style={{ flex: 1, background: s.swatch[0], borderRadius: '4px 0 0 4px' }} />
                  <div style={{ flex: 1, background: s.swatch[1], borderRadius: '0 4px 4px 0' }} />
                </div>
              ) : (
                <div className={styles.styleSwatch} style={{ background: s.swatch }} />
              )}
              <div className={styles.styleText}>
                <div className={styles.styleLabel}>{s.label}</div>
                <div className={styles.styleSub}>{s.sub}</div>
              </div>
              {config.style === s.id && <Icon name="check" size={13} style={{ color: 'var(--orange)', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  // ── Center (preview) ────────────────────────────────────────────────────────

  const centerPanel = (
    <div className={styles.center} ref={previewRef}>
      {selectedMatch ? (
        <div className={styles.previewWrap} style={{ width: maxPreviewW, height: scaledH }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: cardW, height: cardH }}>
            <a href={`https://fanaticscores.com/${locale}/match/${selectedMatch.match.id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
              <StudioCard match={selectedMatch} config={config} />
            </a>
          </div>
        </div>
      ) : (
        <div className={styles.previewEmpty}>
          <Icon name="sparkles" size={32} style={{ color: 'var(--text-faint)' }} />
          <p className={styles.previewEmptyText}>Select a match to start editing</p>
          <button className="fs-btn primary sm" onClick={() => setShowPopover(true)}>
            Pick a match
          </button>
        </div>
      )}
    </div>
  );

  // ── Right panel ─────────────────────────────────────────────────────────────

  const rightPanel = (
    <div className={styles.panel}>
      {/* 04 Caption */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}><span className={styles.sectionNum}>04</span> CAPTION</div>
        {config.template === 'minimal' || config.template === 'stat' ? (
          <div style={{
            padding: '12px 14px', borderRadius: 8,
            background: 'var(--surface)', border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-faint)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            Not available for the {config.template === 'minimal' ? 'Minimal' : 'Stat'} card
          </div>
        ) : (
        <textarea
          className={styles.captionArea}
          placeholder={selectedMatch
            ? `${selectedMatch.match.home.name} ${selectedMatch.match.home.score ?? ''}–${selectedMatch.match.away.score ?? ''} ${selectedMatch.match.away.name}…`
            : 'Select a match first…'}
          value={config.caption}
          onChange={e => setConfig(c => ({ ...c, caption: e.target.value }))}
          maxLength={280}
          disabled={!selectedMatch}
        />
        )}
        {config.template !== 'minimal' && config.template !== 'stat' && (
        <div className={styles.captionMeta}>
          <button
            className={styles.aiRewriteBtn}
            disabled={!selectedMatch || aiLoading}
            onClick={async () => {
              if (!selectedMatch || aiLoading) return;
              setAiLoading(true);
              setAiError(false);
              try {
                const m = selectedMatch.match;
                const res = await fetch('/api/captionRewrite', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    home:        m.home.name,
                    away:        m.away.name,
                    homeScore:   m.home.score,
                    awayScore:   m.away.score,
                    competition: selectedMatch.competition,
                    status:      m.status,
                    minute:      m.minute ?? null,
                    template:    config.template,
                    hashtags,
                  }),
                });
                if (!res.ok) throw new Error(`${res.status}`);
                const data = await res.json() as { caption?: string; error?: string };
                if (data.caption) {
                  // Strip any hashtags Claude included — they live in the pills, not the card text
                  const clean = data.caption.replace(/#\w+/g, '').replace(/\n+/g, ' ').trim();
                  setConfig(c => ({ ...c, caption: clean }));
                } else {
                  throw new Error('no caption');
                }
              } catch {
                setAiError(true);
                setTimeout(() => setAiError(false), 3000);
              } finally {
                setAiLoading(false);
              }
            }}
          >
            <Icon name="sparkles" size={11} />
            {' '}{aiLoading ? 'Writing…' : aiError ? 'Failed — try again' : 'Rewrite with AI'}
          </button>
          <span className={styles.captionCount}>{config.caption.length} / 280</span>
        </div>
        )}

        {/* Hashtags */}
        <div className={styles.hashtags}>
          {hashtags.map(tag => (
            <span key={tag} className={styles.hashtagPill} onClick={() => {
              setHashtags(prev => prev.filter(t => t !== tag));
              setConfig(c => ({ ...c, caption: c.caption.replace(tag, '').replace(/\s{2,}/g, ' ').trim() }));
            }}>
              {tag}
            </span>
          ))}
          {addingTag ? (
            <input
              className={styles.hashtagInput}
              autoFocus
              placeholder="#tag"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addHashtag(); if (e.key === 'Escape') setAddingTag(false); }}
              onBlur={addHashtag}
            />
          ) : (
            <button className={styles.hashtagAdd} onClick={() => setAddingTag(true)}>+ add</button>
          )}
        </div>
      </section>

      {/* 05 Share To */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}><span className={styles.sectionNum}>05</span> SHARE TO</div>
        <div className={styles.sharePlatforms}>
          {SHARE_PLATFORMS.map(p => (
            <button
              key={p.id}
              className={styles.platformBtn}
              title={p.label}
              onClick={handleShare}
              disabled={!selectedMatch}
            >
              <span className={styles.platformAbbr}>{p.abbr}</span>
              <span className={styles.platformLabel}>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Schedule — coming soon */}
        <div className={styles.scheduleRow} style={{ opacity: 0.4, pointerEvents: 'none' }}>
          <div className={styles.scheduleIcon}><Icon name="calendar" size={14} /></div>
          <div className={styles.scheduleText}>
            <div className={styles.scheduleTitle}>Schedule <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace", marginLeft: 6 }}>COMING SOON</span></div>
            <div className={styles.scheduleSub}>Post at full-time automatically</div>
          </div>
          <button className={styles.toggle} disabled>
            <span className={styles.toggleThumb} />
          </button>
        </div>
      </section>

      {/* 06 Export (placeholder) */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}><span className={styles.sectionNum}>06</span> EXPORT</div>
        <div className={styles.exportList}>
          {[
            { label: 'Include FS watermark', on: true },
            { label: 'High-res PNG (2×)',    on: true },
            { label: 'Transparent background', on: false },
          ].map(item => (
            <div key={item.label} className={styles.exportRow}>
              <span className={styles.exportLabel}>{item.label}</span>
              <div className={[styles.toggle, item.on ? styles.toggleOn : '', styles.toggleDisabled].join(' ')}>
                <span className={styles.toggleThumb} />
              </div>
            </div>
          ))}
        </div>
        <p className={styles.exportNote}>Use Save or Copy above to export your card</p>
      </section>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Hidden capture target (full natural size, off-screen) ────────────── */}
      {selectedMatch && (
        <div
          ref={captureRef}
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: cardW,
            height: cardH,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          <StudioCard match={selectedMatch} config={config} />
        </div>
      )}

      {/* ── DESKTOP ─────────────────────────────────────────────────────────── */}
      <div className={styles.desktopOnly}>
        <div className={styles.studio}>

          {/* Top bar */}
          <header className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <button className={styles.topBackBtn} onClick={() => router.back()} title="Back">
                <Icon name="chevron-left" size={16} />
              </button>
              <Link href={`/${locale}/`} className={styles.topLogo}>
                <img src="/assets/logo-mark-dark.png" alt="FanaticScores" height={22} style={{ display: 'block' }} />
                <span className={styles.topLogoLabel}>SHARE STUDIO</span>
              </Link>
            </div>

            <div className={styles.topBarMatch}>
              {selectedMatch && (
                <>
                  <img
                    src={`https://crests.football-data.org/${selectedMatch.compCode}.svg`}
                    width={18} height={18}
                    style={{ objectFit: 'contain' }}
                    alt=""
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className={styles.topMatchLabel}>{matchLabel}</span>
                  {(m?.status === 'LIVE') && (
                    <>
                      <span className={styles.topLiveDot} />
                      <span className={styles.topMinute}>{m?.minute}'</span>
                    </>
                  )}
                </>
              )}
              <button
                className={styles.changeBtn}
                onClick={() => setShowPopover(s => !s)}
              >
                Change
              </button>

              {/* Match popover */}
              {showPopover && (
                <MatchPopover
                  competitions={competitions}
                  loading={loading}
                  onSelect={handleSelectMatch}
                  onClose={() => setShowPopover(false)}
                />
              )}
            </div>

            <div className={styles.topBarRight}>
              <span className={styles.autoSave}>Auto-saved · just now</span>
              <button className={styles.topActionBtn} onClick={handleSave} disabled={!selectedMatch || capturing}>
                <Icon name="download" size={14} /> {capturing ? '…' : 'Save'}
              </button>
              <button className={styles.topActionBtn} onClick={handleCopy} disabled={!selectedMatch || capturing}>
                <Icon name={copied ? 'check' : 'copy'} size={14} />
                {copied ? 'Copied!' : capturing ? '…' : 'Copy'}
              </button>
              <button className={[styles.topShareBtn, !selectedMatch ? styles.topShareBtnDisabled : ''].join(' ')} onClick={handleShare} disabled={!selectedMatch || capturing}>
                <Icon name="share" size={14} /> {capturing ? '…' : 'Share'}
              </button>
            </div>
          </header>

          {/* Body */}
          <div className={styles.body}>
            {/* Left panel */}
            <div className={styles.leftCol}>{leftPanel}</div>

            {/* Center */}
            {centerPanel}

            {/* Right panel */}
            <div className={styles.rightCol}>{rightPanel}</div>
          </div>

          {/* Bottom bar */}
          <footer className={styles.bottomBar}>
            <span className={styles.bottomInfo}>PREVIEW · LIVE DATA · EDITS PERSIST PER TEMPLATE</span>
            <div className={styles.zoomControls}>
              <button className={styles.zoomBtn}>–</button>
              <span className={styles.zoomLabel}>FIT</span>
              <button className={styles.zoomBtn}>+</button>
            </div>
          </footer>
        </div>
      </div>

            {/* ── MOBILE ────────────────────────────────────────────────────────── */}
      <div className={styles.mobileOnly}>
        <div className={styles.mobScreen}>
          <header className={styles.mobTopBar}>
            <button className="fs-btn ghost" style={{ width: 36, height: 36, padding: 0 }} onClick={() => router.back()}>
              <Icon name="chevron-left" size={20} />
            </button>
            <div className={styles.mobMatchPill} onClick={() => setShowPopover(true)}>
              {selectedMatch ? <span>{matchLabel}</span> : <span style={{ color: 'var(--text-faint)' }}>Select match</span>}
              <Icon name="chevron-right" size={12} style={{ color: 'var(--text-faint)' }} />
            </div>
            <button
              className={[styles.topShareBtn, !selectedMatch ? styles.topShareBtnDisabled : ''].join(' ')}
              style={{ height: 32, fontSize: 12, padding: '0 12px' }}
              onClick={handleShare}
              disabled={!selectedMatch}
            >
              Share
            </button>
          </header>

          {/* Mobile tab content — all tabs stay mounted, toggled via display */}
          <div className={styles.mobContent}>
            <div
              className={styles.mobPreview}
              ref={mobPreviewRef}
              style={{ display: mobileTab === 'preview' ? 'flex' : 'none' }}
            >
              {selectedMatch ? (
                <div className={styles.previewWrap} style={{ width: mobPreviewW, height: cardH * mobScale }}>
                  <div style={{ transform: `scale(${mobScale})`, transformOrigin: 'top left', width: cardW, height: cardH }}>
                    <a href={`https://fanaticscores.com/${locale}/match/${selectedMatch.match.id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
                      <StudioCard match={selectedMatch} config={config} />
                    </a>
                  </div>
                </div>
              ) : (
                <div className={styles.previewEmpty}>
                  <Icon name="sparkles" size={28} style={{ color: 'var(--text-faint)' }} />
                  <p className={styles.previewEmptyText}>Select a match to start</p>
                  <button className="fs-btn primary sm" onClick={() => setShowPopover(true)}>Pick a match</button>
                </div>
              )}
            </div>
            <div style={{ display: mobileTab === 'customize' ? 'block' : 'none', padding: 16 }}>{leftPanel}</div>
            <div style={{ display: mobileTab === 'share'    ? 'block' : 'none', padding: 16 }}>{rightPanel}</div>
          </div>

          {/* Mobile tab bar */}
          <nav className={styles.mobTabBar}>
            {(['customize', 'preview', 'share'] as const).map(t => (
              <button key={t} className={[styles.mobTab, mobileTab === t ? styles.mobTabActive : ''].join(' ')} onClick={() => setMobileTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>

          {/* Mobile popover */}
          {showPopover && (
            <MatchPopover
              competitions={competitions}
              loading={loading}
              onSelect={handleSelectMatch}
              onClose={() => setShowPopover(false)}
              mobile
            />
          )}
        </div>
      </div>
    </>
  );
}
