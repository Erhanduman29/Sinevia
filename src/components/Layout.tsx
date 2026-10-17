import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Film, Tv, History, Trophy, Settings, BarChart3, Bot,
  Menu, X, LayoutDashboard, Sparkles, CalendarClock, Users,
  Cloud, CloudOff, RefreshCw, Search, Shuffle, ArrowRight, CornerDownLeft,
  Target, Medal, SearchX, Clapperboard
} from 'lucide-react';
import WrappedModal from './WrappedModal';
import { useApp, PAST_WATCH_COLLECTION_NAME } from '../context/AppContext';
import PickModal from './PickModal';
import BulkAddModal from './BulkAddModal';
import RatingModal from './RatingModal';
import MediaDetailModal from './MediaDetailModal';
import type { DetailModalTarget } from './MediaDetailModal';
import { getNextUnwatchedEpisode, normalize } from '../lib/utils';
import { useTutorial } from '../context/TutorialContext';
import Sini from '../tutorial/Sini';
import { describeCombo, loadBindings } from '../lib/shortcuts';
import { ACHIEVEMENT_DEFS } from '../lib/achievements';

export type TabId = 'home' | 'movies' | 'series' | 'network' | 'plan' | 'history' | 'achievements' | 'stats' | 'ai' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

// ---------------------------------------------------------------------------
// PREMIUM KABUK STİLLERİ (kaynak: sinevia-premium.html)
// ---------------------------------------------------------------------------
const GLASS_SHEEN =
  'var(--glass, linear-gradient(155deg, rgba(255,255,255,.055), rgba(255,255,255,.018) 55%, rgba(255,255,255,.03)))';

const glassSurface: React.CSSProperties = { backgroundImage: GLASS_SHEEN };

const MONO = "'Archivo', ui-sans-serif, sans-serif";

const SIDEBAR_BG =
  'linear-gradient(180deg, color-mix(in srgb, var(--bg-base) 94%, #ffffff 6%), color-mix(in srgb, var(--bg-base) 96%, transparent))';

const gradTitleStyle: React.CSSProperties = {
  backgroundImage: 'linear-gradient(100deg, #FFFFFF 20%, #B9B9BC)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

const activePillStyle: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(120deg, color-mix(in srgb, var(--color-1) 28%, transparent), color-mix(in srgb, var(--color-1) 8%, transparent))',
  borderColor: 'color-mix(in srgb, var(--color-1) 45%, transparent)',
  boxShadow:
    '0 6px 22px -8px color-mix(in srgb, var(--color-1) 55%, transparent), inset 0 1px 0 rgba(255,255,255,.14)',
};

const ACTIVE_PILL_TEXT: React.CSSProperties = {
  color: 'var(--text-main, #f4f4f2)',
  backgroundColor: 'transparent',
};

const accentTextStyle: React.CSSProperties = {
  backgroundImage: 'linear-gradient(135deg, var(--color-2), var(--color-1))',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

const btnPrimaryStyle: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(150deg, var(--btn-p-hi, color-mix(in srgb, var(--color-2) 80%, white)), var(--btn-p-mid, var(--color-1)) 45%, var(--btn-p-low, color-mix(in srgb, var(--color-1) 55%, black)))',
  boxShadow:
    '0 10px 28px -10px color-mix(in srgb, var(--color-1) 75%, transparent), inset 0 1px 0 rgba(255,255,255,.35), inset 0 -2px 6px rgba(0,0,0,.25)',
};

const btnSecondaryStyle: React.CSSProperties = {
  backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,.14), rgba(255,255,255,.05))',
  borderColor: 'rgba(255,255,255,.16)',
  boxShadow: '0 8px 22px -12px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.16)',
};

const topbarStyle: React.CSSProperties = {
  backgroundColor: 'color-mix(in srgb, var(--bg-base) 72%, transparent)',
  backdropFilter: 'blur(20px) saturate(140%)',
  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
  boxShadow: '0 18px 44px -26px rgba(0,0,0,.9)',
};

const TOPBAR_HAIRLINE =
  'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-line, var(--color-1)) 55%, transparent) 30%, color-mix(in srgb, var(--accent-line, var(--color-2)) 35%, transparent) 60%, transparent)';

function ButtonShimmer() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -left-[80%] w-[55%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/35 to-transparent transition-all duration-500 group-hover:left-[130%]"
    />
  );
}

function ActiveRail() {
  return (
    <span
      aria-hidden
      className="absolute -left-3 top-[22%] bottom-[22%] w-[3px] rounded-full"
      style={{ background: 'var(--accent-line, var(--color-1))', boxShadow: '0 0 12px var(--accent-line, var(--color-1))' }}
    />
  );
}

// ---------------------------------------------------------------------------
// GLOBAL ARAMA (komut paleti) — nötr cam yüzey, yazı yazarken renk/çerçeve değişmez
// ---------------------------------------------------------------------------
const SEARCH_GLASS_ROW = `linear-gradient(90deg, color-mix(in srgb, var(--text-main, #f4f4f2) 7%, transparent), color-mix(in srgb, var(--text-main, #f4f4f2) 2.5%, transparent) 52%, transparent 88%)`;
const SEARCH_GLASS_RAIL =
  'linear-gradient(180deg, color-mix(in srgb, var(--text-main, #f4f4f2) 88%, transparent), transparent)';
const SEARCH_GLASS_EDGE = 'color-mix(in srgb, var(--text-main, #f4f4f2) 26%, transparent)';

const SEARCH_NEUTRAL_CSS = `
.sv-search-input,
.sv-search-input:focus,
.sv-search-input:focus-visible,
.sv-search-input:active {
  background: transparent !important;
  background-color: transparent !important;
  border: 0 !important;
  border-color: transparent !important;
  outline: none !important;
  box-shadow: none !important;
}
`;

function rowTypeLabel(entry: SearchEntry): string | null {
  if (entry.media) return entry.media.type === 'movie' ? 'Film' : 'Dizi';
  if (entry.action) return 'Kısayol';
  return null;
}

const searchPanelStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card, #15151b)',
  backgroundImage:
    'var(--glass, linear-gradient(155deg, rgba(255,255,255,.06), rgba(255,255,255,.02)))',
  borderColor: 'rgba(255,255,255,.12)',
  borderRadius: 'var(--r, 16px)',
  boxShadow:
    '0 40px 110px -36px rgba(0,0,0,.95), 0 2px 10px -6px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.09)',
};

interface SearchEntry {
  key: string;
  label: string;
  sub?: string;
  icon: LucideIcon;
  tab: TabId;
  media?: { type: 'movie' | 'series'; id: string };
  poster?: string;
  action?: string;
}

interface SearchGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  entries: SearchEntry[];
}

const SEARCH_PAGES: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Ana Sayfa', icon: LayoutDashboard },
  { id: 'movies', label: 'Filmler', icon: Film },
  { id: 'series', label: 'Diziler', icon: Tv },
  { id: 'network', label: 'Sinevia Ağı', icon: Users },
  { id: 'plan', label: 'Haftalık Plan', icon: CalendarClock },
  { id: 'history', label: 'Geçmiş', icon: History },
  { id: 'achievements', label: 'Başarımlar', icon: Trophy },
  { id: 'stats', label: 'İstatistik', icon: BarChart3 },
  { id: 'ai', label: 'AI Asistan', icon: Bot },
  { id: 'settings', label: 'Ayarlar', icon: Settings },
];

function pageEntries(): SearchEntry[] {
  return SEARCH_PAGES.map((p) => ({
    key: `page-${p.id}`,
    label: p.label,
    sub: 'Sayfaya git',
    icon: p.icon,
    tab: p.id,
  }));
}

const SEARCH_ACTIONS: {
  key: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  tab: TabId;
  action: string;
  keywords: string;
}[] = [
  {
    key: 'action-quests',
    label: 'Görev Panosu',
    sub: 'Başarımlar sayfası · Görevler sekmesi',
    icon: Target,
    tab: 'achievements',
    action: 'quests',
    keywords: 'görev görevler gorev gorevler görev panosu gorev panosu quest quests',
  },
  {
    key: 'action-trophies',
    label: 'Kupa Kasası',
    sub: 'Başarımlar sayfası · Kupalar sekmesi',
    icon: Medal,
    tab: 'achievements',
    action: 'trophies',
    keywords: 'kupa kupalar kupa kasası kupa kasasi trophy trophies',
  },
];

function trLower(value: string): string {
  return value.toLocaleLowerCase('tr-TR');
}

function matchesAllTokens(query: string, haystack: string): boolean {
  const hay = normalize(haystack);
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every((t) => hay.includes(t));
}

function buildSearchGroups(query: string, data: any): SearchGroup[] {
  const q = query.trim();
  const groups: SearchGroup[] = [];
  if (!q) return groups;

  const actionHits: SearchEntry[] = SEARCH_ACTIONS.filter((a) =>
    matchesAllTokens(q, a.keywords)
  ).map((a) => ({
    key: a.key,
    label: a.label,
    sub: a.sub,
    icon: a.icon,
    tab: a.tab,
    action: a.action,
  }));
  if (actionHits.length) {
    groups.push({ id: 'actions', label: 'Sayfa İçi', icon: LayoutDashboard, entries: actionHits });
  }

  const movies: any[] = Array.isArray(data?.movies) ? data.movies : [];
  const series: any[] = Array.isArray(data?.series) ? data.series : [];
  const history: any[] = Array.isArray(data?.history) ? data.history : [];
  const collections: any[] = Array.isArray(data?.collections) ? data.collections : [];
  const colName = (id?: string | null) =>
    (id && collections.find((c) => c.id === id)?.name) || '';
  const join = (value: unknown) =>
    Array.isArray(value)
      ? value.join(' ')
      : value === null || value === undefined
        ? ''
        : String(value);

  const movieHits: SearchEntry[] = movies
    .filter((m) =>
      matchesAllTokens(
        q,
        [m.title, m.year, m.genres, m.cast, m.directors, m.note,
          m.reviewTags, colName(m.collectionId)].map(join).join(' ')
      )
    )
    .slice(0, 6)
    .map((m) => ({
      key: `movie-${m.id}`,
      label: m.title || 'İsimsiz Film',
      sub: [m.year, Array.isArray(m.genres) ? m.genres.join(', ') : ''].filter(Boolean).join(' · '),
      icon: Film,
      tab: 'movies' as TabId,
      media: { type: 'movie' as const, id: m.id },
      poster: m.posterUrl,
    }));
  if (movieHits.length) groups.push({ id: 'movies', label: 'Filmler', icon: Film, entries: movieHits });

  const seriesHits: SearchEntry[] = series
    .filter((s) =>
      matchesAllTokens(
        q,
        [s.title, s.year, s.genres, s.cast, s.creators, s.note,
          (s.episodes || []).map((e: any) => e?.name || '')].map(join).join(' ')
      )
    )
    .slice(0, 6)
    .map((s) => ({
      key: `series-${s.id}`,
      label: s.title || 'İsimsiz Dizi',
      sub: [s.year, Array.isArray(s.genres) ? s.genres.join(', ') : ''].filter(Boolean).join(' · '),
      icon: Tv,
      tab: 'series' as TabId,
      media: { type: 'series' as const, id: s.id },
      poster: s.posterUrl,
    }));
  if (seriesHits.length) groups.push({ id: 'series', label: 'Diziler', icon: Tv, entries: seriesHits });

  const collectionHits: SearchEntry[] = collections
    .filter((c) => matchesAllTokens(q, `${c.name || ''} ${c.description || ''}`))
    .slice(0, 4)
    .map((c) => ({
      key: `collection-${c.id}`,
      label: c.name || 'Adsız Koleksiyon',
      sub: 'Koleksiyon',
      icon: Film,
      tab: 'movies' as TabId,
    }));
  if (collectionHits.length) {
    groups.push({ id: 'collections', label: 'Koleksiyonlar', icon: Film, entries: collectionHits });
  }

  const seenHistory = new Set<string>();
  const historyHits: SearchEntry[] = history
    .filter((h) =>
      matchesAllTokens(
        q,
        [h.title, h.year, h.note, h.reviewTags, h.season, h.episode].map(join).join(' ')
      )
    )
    .filter((h) => {
      const key = trLower(`${h.title || ''}`);
      if (seenHistory.has(key)) return false;
      seenHistory.add(key);
      return true;
    })
    .slice(0, 6)
    .map((h) => ({
      key: `history-${h.id}`,
      label: h.title || 'İzleme Kaydı',
      sub: [h.kind === 'series' || h.type === 'series' ? 'Dizi' : 'Film', h.year]
        .filter(Boolean)
        .join(' · '),
      icon: History,
      tab: 'history' as TabId,
    }));
  if (historyHits.length) groups.push({ id: 'history', label: 'Geçmiş', icon: History, entries: historyHits });

  const peopleMap = new Map<string, TabId>();
  movies.forEach((m) => {
    [...(m.cast || []), ...(m.directors || [])].forEach((p: string) => {
      if (p && !peopleMap.has(p)) peopleMap.set(p, 'movies');
    });
  });
  series.forEach((s) => {
    [...(s.cast || []), ...(s.creators || [])].forEach((p: string) => {
      if (p && !peopleMap.has(p)) peopleMap.set(p, 'series');
    });
  });
  const peopleHits: SearchEntry[] = Array.from(peopleMap.entries())
    .filter(([name]) => matchesAllTokens(q, name))
    .slice(0, 6)
    .map(([name, tab]) => ({
      key: `person-${name}`,
      label: name,
      sub: tab === 'movies' ? 'Film kadrosu' : 'Dizi kadrosu',
      icon: Users,
      tab,
    }));
  if (peopleHits.length) {
    groups.push({ id: 'people', label: 'Kişiler & Oyuncular', icon: Users, entries: peopleHits });
  }

  const achievementProgress: any[] = Array.isArray(data?.achievements) ? data.achievements : [];
  const showLockedAch = !!data?.showLockedNames;
  const achHits: SearchEntry[] = ACHIEVEMENT_DEFS
    .filter((def) => {
      // Gizli (secret) başarımlar: kilitliyken ve test modu kapalıyken aramada da sızmasın.
      if (def.secret && !showLockedAch) {
        const p = achievementProgress.find((a) => a?.achievementId === def.id);
        const u = Array.isArray(p?.unlockedTiers) ? p.unlockedTiers.length : 0;
        if (u === 0) return false;
      }
      return matchesAllTokens(q, `${def.name} ${def.category || ''} ${def.description || ''}`);
    })
    .slice(0, 6)
    .map((def) => {
      const prog = achievementProgress.find((a) => a?.achievementId === def.id);
      const unlocked = Array.isArray(prog?.unlockedTiers) ? prog.unlockedTiers.length : 0;
      return {
        key: `achievement-${def.id}`,
        label: def.name,
        sub: [def.category, unlocked > 0 ? `${unlocked} rozet açıldı` : 'Henüz açılmadı'].filter(Boolean).join(' · '),
        icon: Trophy,
        tab: 'achievements' as TabId,
      };
    });
  if (achHits.length) {
    groups.push({ id: 'achievements', label: 'Başarımlar', icon: Trophy, entries: achHits });
  }

  const pageHits = pageEntries().filter((p) => matchesAllTokens(q, p.label));
  if (pageHits.length) groups.push({ id: 'pages', label: 'Bölümler', icon: LayoutDashboard, entries: pageHits });

  return groups;
}

function GlobalSearch({
  open,
  onClose,
  onNavigate,
  onSelectMedia,
  data,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: TabId) => void;
  onSelectMedia: (m: { type: 'movie' | 'series'; id: string }) => void;
  data: any;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const groups: SearchGroup[] = useMemo(
    () =>
      query.trim()
        ? buildSearchGroups(query, data)
        : [{ id: 'pages', label: 'Bölümler', icon: LayoutDashboard, entries: pageEntries() }],
    [query, data]
  );
  const flat: SearchEntry[] = useMemo(() => groups.flatMap((g) => g.entries), [groups]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (typeof document !== 'undefined'
      ? (document.activeElement as HTMLElement | null)
      : null);
    setQuery('');
    setActive(0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const select = (entry: SearchEntry | undefined) => {
    if (!entry) return;
    if (entry.media) {
      onSelectMedia(entry.media);
      onClose();
      return;
    }
    if (entry.action) {
      try {
        sessionStorage.setItem('sinevia_search_action', entry.action);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event('sinevia-search-action'));
      onNavigate(entry.tab);
      onClose();
      return;
    }
    onNavigate(entry.tab);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flat.length) setActive((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length) setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(flat[active]);
    }
  };

  return (
    <div
      className="sv-search-wrap fixed inset-0 z-[220] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Global arama"
    >
      <style>{SEARCH_NEUTRAL_CSS}</style>
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl overflow-hidden border backdrop-blur-2xl" style={searchPanelStyle}>
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,.34) 30%, rgba(255,255,255,.16) 62%, transparent)',
          }}
        />

        {/* Arama girişi — yazı yazarken arka plan ve çerçeve asla renk değiştirmez */}
        <div
          className="relative flex items-center gap-3 px-4 py-4 border-b"
          style={{ borderColor: 'rgba(255,255,255,.10)', background: 'transparent' }}
        >
          <Search size={18} className="shrink-0" style={{ color: 'var(--muted, #8a8a94)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Film, dizi, kişi veya sayfa ara…"
            aria-label="Global arama girişi"
            className="sv-search-input flex-1 !bg-transparent !border-0 !outline-none !ring-0 !shadow-none text-[15px] tracking-[0.01em] text-ink-50 placeholder:text-ink-500"
          />
          <kbd
            className="text-[9.5px] px-1.5 py-[3px] rounded-md border shrink-0 uppercase tracking-[0.1em]"
            style={{
              fontFamily: MONO,
              borderColor: 'rgba(255,255,255,.12)',
              color: 'var(--muted, #8a8a94)',
              background: 'rgba(255,255,255,.04)',
            }}
          >
            ESC
          </kbd>
        </div>

        <div className="sv-search-results max-h-[52vh] overflow-y-auto custom-scrollbar py-1.5">
          {groups.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <span
                aria-hidden
                className="mx-auto mb-3 w-11 h-11 rounded-xl grid place-items-center border"
                style={{
                  borderColor: 'rgba(255,255,255,.10)',
                  background: 'rgba(255,255,255,.04)',
                  color: 'var(--muted, #8a8a94)',
                }}
              >
                <SearchX size={20} />
              </span>
              <p className="text-[13px] font-semibold text-ink-300">Sonuç bulunamadı</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
                Farklı bir film, dizi, kişi veya sayfa adı deneyin.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="mb-1">
                <div
                  className="flex items-center gap-2.5 px-4 pt-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: 'var(--muted, #8a8a94)' }}
                >
                  <group.icon size={12} style={{ color: 'var(--muted, #8a8a94)' }} />
                  <span className="shrink-0">{group.label}</span>
                  <span
                    aria-hidden
                    className="flex-1 h-px"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(255,255,255,.12), transparent)',
                    }}
                  />
                </div>
                {group.entries.map((entry) => {
                  const index = flat.indexOf(entry);
                  const isActive = index === active;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onClick={() => select(entry)}
                      className="relative w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                      style={
                        isActive
                          ? { backgroundImage: SEARCH_GLASS_ROW }
                          : undefined
                      }
                    >
                      {isActive && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
                          style={{
                            background: SEARCH_GLASS_RAIL,
                            opacity: 0.9,
                          }}
                        />
                      )}
                      {entry.poster ? (
                        <img
                          src={entry.poster}
                          alt=""
                          loading="lazy"
                          className="w-7 h-10 rounded-md object-cover shrink-0 border"
                          style={{
                            borderColor: isActive
                              ? SEARCH_GLASS_EDGE
                              : 'rgba(255,255,255,.12)',
                          }}
                        />
                      ) : (
                        <span
                          className="w-8 h-8 rounded-lg grid place-items-center shrink-0 border"
                          style={{
                            borderColor: isActive
                              ? SEARCH_GLASS_EDGE
                              : 'rgba(255,255,255,.12)',
                            color: isActive ? 'var(--text-main, #f4f4f2)' : 'var(--muted, #8a8a94)',
                          }}
                        >
                          <entry.icon size={15} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold leading-tight text-ink-100 truncate">
                          {entry.label}
                        </span>
                        {entry.sub && (
                          <span
                            className="block text-[11px] leading-tight tracking-[0.01em] truncate"
                            style={{ color: 'var(--muted, #8a8a94)' }}
                          >
                            {entry.sub}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 flex items-center gap-2">
                        {rowTypeLabel(entry) && (
                          <span
                            className="text-[9px] font-bold uppercase tracking-[0.16em]"
                            style={{ color: 'var(--muted, #8a8a94)' }}
                          >
                            {rowTypeLabel(entry)}
                          </span>
                        )}
                        <ArrowRight
                          size={14}
                          className="transition-opacity duration-200"
                          style={{
                            color: isActive ? 'var(--text-main, #f4f4f2)' : 'var(--muted, #8a8a94)',
                            opacity: isActive ? 1 : 0.4,
                          }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className="flex items-center justify-between gap-3 px-4 py-3 border-t text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ borderColor: 'rgba(255,255,255,.10)', color: 'var(--muted, #8a8a94)' }}
        >
          <span className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5">
              <CornerDownLeft size={12} /> Seç
            </span>
            <span
              aria-hidden
              className="w-px h-3"
              style={{ background: 'rgba(255,255,255,.12)' }}
            />
            <span>↑↓ Gezin</span>
          </span>
          <span style={{ fontFamily: MONO, letterSpacing: '0.08em' }}>{flat.length} sonuç</span>
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const appCtx = useApp() as any;
  const syncStatus: 'syncing' | 'synced' | 'error' = appCtx.syncStatus || 'synced';
  const { watchMovie, watchEpisode } = appCtx;

  const profileData = appCtx?.data || {};
  const nickname: string = profileData.nickname || 'Sinevia Ajanı';
  const level: number = Number(profileData.level) || 1;
  const streak: number = Number(profileData.dailyStreak) || 0;

  const unlockedBadgeCount = (Array.isArray(profileData.achievements) ? profileData.achievements : [])
    .reduce((sum: number, a: any) => sum + (Array.isArray(a?.unlockedTiers) ? a.unlockedTiers.length : 0), 0);
  const navCounts: Partial<Record<TabId, number>> = {
    movies: profileData.movies?.length || 0,
    series: profileData.series?.length || 0,
    plan: profileData.weeklyPlan?.length || 0,
    history: profileData.history?.length || 0,
    achievements: unlockedBadgeCount,
  };

  const hour = new Date().getHours();
  const greeting = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  const { activeTutorial } = useTutorial();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showWrapped, setShowWrapped] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchDetail, setSearchDetail] = useState<DetailModalTarget | null>(null);
  const [showBulkAdd, setShowBulkAdd] = useState<'movie' | 'tv' | false>(false);
  const [showPick, setShowPick] = useState(false);
  const [pickedItem, setPickedItem] = useState<
    | { kind: 'movie'; movie: any }
    | { kind: 'series'; series: any; episode: any }
    | null
  >(null);

  const [searchCombo, setSearchCombo] = useState('/');
  useEffect(() => {
    setSearchCombo(describeCombo(loadBindings().focusSearch));
  }, []);

  const handleSearchSelectMedia = ({ type, id }: { type: 'movie' | 'series'; id: string }) => {
    if (type === 'movie') {
      const movie = (profileData.movies || []).find((m: any) => m?.id === id);
      if (movie) setSearchDetail({ type: 'movie', data: movie });
    } else {
      const serie = (profileData.series || []).find((s: any) => s?.id === id);
      if (serie) setSearchDetail({ type: 'series', data: serie });
    }
  };

  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const lastScrollY = useRef(0);

  const navItems = [
    { id: 'home', icon: LayoutDashboard, label: 'Ana Sayfa', shortLabel: 'Ana Sayfa' },
    { id: 'movies', icon: Film, label: 'Filmler', shortLabel: 'Filmler' },
    { id: 'series', icon: Tv, label: 'Diziler', shortLabel: 'Diziler' },
    { id: 'network', icon: Users, label: 'Sinevia Ağı', shortLabel: 'Ağ' },
    { id: 'plan', icon: CalendarClock, label: 'Haftalık Plan', shortLabel: 'Plan' },
    { id: 'history', icon: History, label: 'Geçmiş', shortLabel: 'Geçmiş' },
    { id: 'achievements', icon: Trophy, label: 'Başarımlar', shortLabel: 'Kupalar' },
    { id: 'stats', icon: BarChart3, label: 'İstatistik', shortLabel: 'İstatistik' },
    { id: 'ai', icon: Bot, label: 'AI Asistan', shortLabel: 'AI' },
  ] as const;

  // Mobil alt bar — en sağa Ayarlar eklendi
  const mobileBottomTabs = [
    { id: 'movies', icon: Film, label: 'Filmler' },
    { id: 'series', icon: Tv, label: 'Diziler' },
    { id: 'network', icon: Users, label: 'Sinevia Ağı' },
    { id: 'history', icon: History, label: 'Geçmiş' },
    { id: 'achievements', icon: Trophy, label: 'Başarımlar' },
    { id: 'settings', icon: Settings, label: 'Ayarlar' },
  ] as const;

  useEffect(() => {
    const checkModals = () => {
      const hasModals = Array.from(document.querySelectorAll('.fixed.inset-0')).some(el => {
        const zIndexMatch = el.className.match(/z-\[?(\d+)\]?/);
        if (zIndexMatch) {
          return parseInt(zIndexMatch[1], 10) > 60; 
        }
        return false;
      });
      setIsModalOpen(hasModals);
    };

    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    
    checkModals();

    return () => observer.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isModalOpen) return;
    if (activeTutorial) return;

    const currentY = e.currentTarget.scrollTop;
    
    if (currentY <= 20) {
      setIsNavVisible(true);
      lastScrollY.current = currentY;
      return;
    }

    const diff = currentY - lastScrollY.current;

    if (diff > 15) {
      setIsNavVisible(false);
      lastScrollY.current = currentY;
    } else if (diff < -15) {
      setIsNavVisible(true);
      lastScrollY.current = currentY;
    }
  };

  useEffect(() => {
    const scrollEl = document.getElementById('main-scroll');
    if (scrollEl) {
      scrollEl.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      setIsNavVisible(true); 
    }
  }, [activeTab]);

  const handleMobileMenuClick = (id: TabId) => {
    onTabChange(id);
    setIsMobileMenuOpen(false);
  };

  const openGlobalSearch = () => setIsSearchOpen(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pastColIds = useMemo(
    () =>
      new Set(
        (profileData.collections || [])
          .filter((c: any) => normalize(c.name) === normalize(PAST_WATCH_COLLECTION_NAME))
          .map((c: any) => c.id)
      ),
    [profileData.collections]
  );
  const plannedMovieIds = useMemo(() => {
    const ids = new Set<string>();
    (profileData.weeklyPlan || []).forEach((p: any) => ids.add(p.movieId));
    return ids;
  }, [profileData.weeklyPlan]);
  const eligibleMovies = useMemo(() => {
    const unwatched = (profileData.movies || []).filter(
      (m: any) => !m.watched && (!m.collectionId || !pastColIds.has(m.collectionId)) && !plannedMovieIds.has(m.id)
    );
    const standalone = unwatched.filter((m: any) => !m.collectionId);
    const collectionGroups = new Map<string, any[]>();
    unwatched.filter((m: any) => m.collectionId).forEach((m: any) => {
      const arr = collectionGroups.get(m.collectionId) || [];
      arr.push(m);
      collectionGroups.set(m.collectionId, arr);
    });
    const sequentialCollectionMovies: any[] = [];
    collectionGroups.forEach((moviesInCol) => {
      const sorted = [...moviesInCol].sort((a: any, b: any) => (a.year || '9999').localeCompare(b.year || '9999'));
      if (sorted.length > 0) sequentialCollectionMovies.push(sorted[0]);
    });
    return [...standalone, ...sequentialCollectionMovies];
  }, [profileData.movies, pastColIds, plannedMovieIds]);
  const allNextEpisodes = useMemo(() => {
    return (profileData.series || [])
      .map((s: any) => {
        const next = getNextUnwatchedEpisode(s.episodes);
        return next ? { series: s, episode: next } : null;
      })
      .filter((x: any): x is { series: any; episode: any } => x !== null);
  }, [profileData.series]);

  const topbarTitle = activeTab === 'settings'
    ? 'Ayarlar'
    : navItems.find((item) => item.id === activeTab)?.label || 'Sinevia';

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-ink-950 font-sans text-ink-50 selection:bg-azure-500/30 selection:text-azure-200 overflow-hidden relative isolate transition-colors duration-500">
      <div className="fixed top-[-10%] right-[-5%] w-[300px] h-[300px] sm:w-[420px] sm:h-[420px] md:w-[600px] md:h-[600px] rounded-full blur-[70px] sm:blur-[100px] md:blur-[130px] pointer-events-none ambient-glow-1 -z-10 transition-all duration-700" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[300px] h-[300px] sm:w-[420px] sm:h-[420px] md:w-[600px] md:h-[600px] rounded-full blur-[70px] sm:blur-[100px] md:blur-[130px] pointer-events-none ambient-glow-2 -z-10 transition-all duration-700" />
      <div className="fixed top-[40%] left-[30%] w-[260px] h-[260px] sm:w-[380px] sm:h-[380px] md:w-[500px] md:h-[500px] rounded-full blur-[80px] sm:blur-[110px] md:blur-[140px] pointer-events-none ambient-glow-3 -z-10 transition-all duration-700" />

      {/* MOBİL: SABİT ÜST BAR (Arama Çubuğu + Katalog + Ne İzlesem) */}
      <header
        className="md:hidden fixed top-0 inset-x-0 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-ink-900/80 backdrop-blur-xl border-b border-ink-800 z-[60] flex items-center justify-between gap-1.5 pl-[max(0.6rem,env(safe-area-inset-left))] pr-[max(0.6rem,env(safe-area-inset-right))] shadow-md shrink-0 transition-transform duration-300"
        style={glassSurface}
      >
        <span aria-hidden className="absolute inset-x-0 bottom-[-1px] h-px pointer-events-none" style={{ background: TOPBAR_HAIRLINE }} />

        {/* Sol: Menü + Marka */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            data-tutorial="nav-tabs"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-white bg-ink-900 border border-ink-800 hover:bg-ink-800 transition-colors shrink-0"
            title="Menü"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <button
            onClick={() => handleMobileMenuClick('home')}
            className="flex items-center gap-1 transition-transform active:scale-95 shrink-0"
            title="Ana Sayfa"
          >
            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
              <Sini size={26} mood="idle" showGlow={false} />
            </div>
            <span className="hidden xs:inline text-[11px] font-black text-white tracking-[0.08em] uppercase whitespace-nowrap">
              SINEVIA
            </span>
          </button>
        </div>

        {/* Orta: Mobil Arama Çubuğu */}
        <button
          type="button"
          onClick={openGlobalSearch}
          aria-label="Global arama"
          className="flex-1 min-w-0 h-9 px-2.5 rounded-xl bg-ink-900/75 border border-ink-800/80 flex items-center gap-1.5 text-left transition-colors hover:border-ink-700"
        >
          <Search size={14} className="text-ink-400 shrink-0" />
          <span className="text-[11.5px] text-ink-400 truncate">Ara…</span>
        </button>

        {/* Sağ: Katalog + Ne İzlesem + Bulut Durumu */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowBulkAdd('movie')}
            className="h-9 px-2.5 rounded-xl text-ink-50 font-extrabold text-[10px] tracking-[0.06em] uppercase flex items-center gap-1 border shrink-0 transition-transform active:scale-95"
            style={btnSecondaryStyle}
            title="Katalog Ekle"
          >
            <Clapperboard size={13} />
            <span>Katalog</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPick(true)}
            className="relative overflow-hidden h-9 px-2.5 rounded-xl text-white font-extrabold text-[10px] tracking-[0.06em] uppercase flex items-center gap-1 shrink-0 transition-transform active:scale-95"
            style={btnPrimaryStyle}
            title="Ne İzlesem"
          >
            <Shuffle size={13} />
            <span>Ne İzlesem</span>
          </button>

          <div
            className={`relative hidden sm:flex items-center justify-center w-8 h-8 rounded-xl border transition-all ${
              syncStatus === 'syncing' ? 'bg-azure-500/10 border-azure-500/30 text-azure-400' :
              syncStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
              'bg-emerald-500/5 border-emerald-500/20 text-emerald-500/70'
            }`}
            title={syncStatus === 'syncing' ? 'Bulutla eşitleniyor...' : syncStatus === 'error' ? 'Bağlantı hatası' : 'Sistem güncel'}
          >
            {syncStatus === 'syncing' ? <RefreshCw size={13} className="animate-spin" /> :
             syncStatus === 'error' ? <CloudOff size={13} /> :
             <Cloud size={13} />}
          </div>
        </div>
      </header>

      {/* MOBİL: AÇILIR TAM MENÜ EKRANI */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-[calc(3.5rem+env(safe-area-inset-top))] inset-x-0 bottom-0 bg-ink-900/80 backdrop-blur-3xl z-[55] animate-fade-in flex flex-col p-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] overflow-y-auto" style={glassSurface}>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => { setIsMobileMenuOpen(false); setShowWrapped(true); }}
              className="relative overflow-hidden flex items-center justify-between px-3.5 py-3 rounded-xl text-[13px] font-black text-white shadow-lg mb-1"
              style={btnPrimaryStyle}
            >
              <span className="flex items-center gap-3">
                <Sparkles size={19} /> SINEVIA WRAPPED ÖZETİN
              </span>
              <span className="text-[10px] bg-black/20 text-white px-2 py-0.5 rounded-full">Story</span>
              <ButtonShimmer />
            </button>

            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleMobileMenuClick(item.id as TabId)}
                  data-tutorial={`nav-${item.id}`}
                  className={`relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-bold transition-all ${
                    isActive
                      ? 'text-gold-400 bg-ink-800'
                      : 'text-ink-300 bg-ink-900/60 hover:bg-ink-800/50 hover:text-ink-100'
                  }`}
                  style={isActive ? activePillStyle : undefined}
                >
                  <item.icon size={19} className={isActive ? 'scale-110' : ''} />
                  <span className="tracking-wide">{item.label}</span>
                  {isActive && <ActiveRail />}
                </button>
              );
            })}

            <button
              onClick={() => handleMobileMenuClick('settings')}
              className={`relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-bold transition-all ${
                activeTab === 'settings'
                  ? 'text-gold-400 bg-ink-800'
                  : 'text-ink-300 bg-ink-900/60 hover:bg-ink-800/50 hover:text-ink-100'
              }`}
              style={activeTab === 'settings' ? activePillStyle : undefined}
            >
              <Settings size={19} />
              <span className="tracking-wide">Ayarlar</span>
              {activeTab === 'settings' && <ActiveRail />}
            </button>
          </div>
        </div>
      )}

      {/* MASAÜSTÜ SOL SIDEBAR */}
      <aside
        className="hidden md:flex flex-col w-56 shrink-0 z-20 bg-ink-900/80 backdrop-blur-[18px] border-r transition-colors duration-500"
        style={{
          backgroundImage: SIDEBAR_BG,
          borderColor: 'var(--line, var(--border-dim))',
          boxShadow: '12px 0 44px -20px rgba(0,0,0,.7)',
        }}
      >
        <button
          onClick={() => onTabChange('home')}
          className="relative h-[72px] px-[22px] flex items-center border-b border-ink-800/50 hover:bg-ink-800/40 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <Sini size={40} mood="idle" showGlow={false} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[23px] font-black tracking-[-0.03em] uppercase leading-none text-white whitespace-nowrap">
                SINE<span style={accentTextStyle}>VIA</span>
              </h1>
              <span className="block mt-1.5 text-[9px] font-bold tracking-[0.28em] uppercase text-ink-500 whitespace-nowrap">
                Kayıt Defteri
              </span>
            </div>
          </div>
          <span
            aria-hidden
            className="absolute left-5 right-5 bottom-[-1px] h-px opacity-70"
            style={{ background: 'linear-gradient(90deg, var(--accent-line, var(--color-1)), transparent)' }}
          />
        </button>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto hide-scrollbar" data-tutorial="nav-tabs">
          <div className="px-3 pb-2 pt-1 text-[9px] font-bold tracking-[0.24em] uppercase text-ink-500 opacity-80">
            Bölümler
          </div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as TabId)}
                data-tutorial={`nav-${item.id}`}
                className={`relative w-full flex items-center gap-3 px-3.5 py-[11px] rounded-xl transition-all duration-300 font-bold text-[12.5px] tracking-[0.06em] uppercase whitespace-nowrap group ${
                  isActive
                    ? 'bg-gold-500/20 text-gold-400 border'
                    : 'text-ink-400 hover:bg-ink-800/50 hover:text-white hover:translate-x-[3px] border border-transparent'
                }`}
                style={isActive ? { ...activePillStyle, ...ACTIVE_PILL_TEXT } : undefined}
              >
                <item.icon size={17} className={`transition-transform duration-300 shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span>{item.label}</span>
                {(navCounts[item.id as TabId] ?? 0) > 0 && (
                  <span
                    className="ml-auto inline-flex items-center px-1.5 py-[3px] rounded-md text-[10px] font-bold leading-none"
                    style={{
                      fontFamily: MONO,
                      color: isActive ? 'var(--text-main, #f4f4f2)' : 'var(--muted, #8a8a94)',
                      background: isActive
                        ? 'color-mix(in srgb, var(--text-main, #f4f4f2) 12%, transparent)'
                        : 'var(--surface, rgba(255,255,255,.05))',
                      border: `1px solid ${isActive
                        ? 'color-mix(in srgb, var(--text-main, #f4f4f2) 30%, transparent)'
                        : 'var(--line, var(--border-dim, rgba(255,255,255,.10)))'}`,
                    }}
                  >
                    {navCounts[item.id as TabId]}
                  </span>
                )}
                {isActive && <ActiveRail />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-ink-800/60 space-y-2">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-ink-800/40 border border-ink-800/50 mb-3 select-none" style={glassSurface}>
            <div className="relative flex items-center justify-center">
              {syncStatus === 'syncing' ? <RefreshCw size={15} className="text-azure-400 animate-spin" /> :
               syncStatus === 'error' ? <CloudOff size={15} className="text-red-400" /> :
               <Cloud size={15} className="text-emerald-500/80" />}
              {syncStatus === 'syncing' && (
                <span className="absolute inset-0 rounded-full border border-azure-400 animate-ping opacity-40" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-ink-500 uppercase tracking-widest leading-none mb-1">Bulut Ağı</span>
              <span className={`text-[10px] font-bold tracking-wide leading-none ${
                syncStatus === 'syncing' ? 'text-azure-400' : 
                syncStatus === 'error' ? 'text-red-400' : 'text-emerald-500/80'
              }`}>
                {syncStatus === 'syncing' ? 'Eşitleniyor...' : syncStatus === 'error' ? 'Bağlantı Yok' : 'Sistem Güncel'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowWrapped(true)}
            className="relative overflow-hidden w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-extrabold text-[11px] tracking-[0.12em] uppercase shadow-lg transition-all duration-300 hover:-translate-y-[2px] active:translate-y-px"
            style={btnPrimaryStyle}
          >
            <Sparkles size={15} /> Wrapped Özetin
            <ButtonShimmer />
          </button>

          <button
            onClick={() => onTabChange('settings')}
            className={`relative w-full flex items-center gap-3 px-3.5 py-[11px] rounded-xl transition-all duration-300 font-bold text-[12.5px] tracking-[0.06em] uppercase whitespace-nowrap group ${
              activeTab === 'settings'
                ? 'bg-gold-500/20 text-gold-400 border'
                : 'text-ink-400 hover:bg-ink-800/50 hover:text-white hover:translate-x-[3px] border border-transparent'
            }`}
            style={activeTab === 'settings' ? { ...activePillStyle, ...ACTIVE_PILL_TEXT } : undefined}
          >
            <Settings size={17} className={`transition-transform duration-300 shrink-0 ${activeTab === 'settings' ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span>Ayarlar</span>
            {activeTab === 'settings' && <ActiveRail />}
          </button>
        </div>
      </aside>

      {/* ANA İÇERİK ALANI */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent relative pt-[calc(3.5rem+env(safe-area-inset-top))] pb-0 md:pt-0 md:pb-0">
        {/* MASAÜSTÜ PREMIUM TOPBAR */}
        <header
          className="hidden md:flex items-center gap-4 h-[72px] px-6 shrink-0 relative z-30 border-b border-ink-800/60 backdrop-blur-[20px] transition-colors duration-500"
          style={topbarStyle}
        >
          <div className="min-w-0">
            <h1 className="text-2xl font-black uppercase tracking-[-0.03em] leading-none whitespace-nowrap" style={gradTitleStyle}>
              {greeting}, {nickname}
            </h1>
            <p className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-500 whitespace-nowrap">
              {topbarTitle} · {streak} günlük seri · Seviye {level}
            </p>
          </div>

          <button
            onClick={openGlobalSearch}
            aria-label="Global arama"
            className="group relative flex items-center gap-2.5 min-w-0 flex-1 max-w-[380px] ml-auto px-4 py-2.5 rounded-xl bg-ink-900/60 border border-ink-800/60 backdrop-blur-md text-left transition-all duration-300 hover:-translate-y-[1px]"
            style={glassSurface}
          >
            <Search size={15} className="text-ink-400 group-hover:text-ink-200 transition-colors shrink-0" />
            <span className="flex-1 text-[13px] text-ink-400 whitespace-nowrap overflow-hidden text-ellipsis">Film, dizi, oyuncu ara…</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded-md border border-ink-800/60 bg-ink-800/40 text-ink-400 shrink-0" style={{ fontFamily: MONO }}>{searchCombo}</kbd>
          </button>

          <button
            onClick={() => setShowBulkAdd('movie')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-ink-50 font-extrabold text-[11.5px] tracking-[0.1em] uppercase whitespace-nowrap backdrop-blur-md transition-all duration-300 hover:-translate-y-[2px] active:translate-y-px shrink-0"
            style={btnSecondaryStyle}
          >
            <Clapperboard size={15} /> Katalog
          </button>

          <button
            onClick={() => setShowPick(true)}
            className="relative overflow-hidden group flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-extrabold text-[11.5px] tracking-[0.1em] uppercase whitespace-nowrap transition-all duration-300 hover:-translate-y-[2px] active:translate-y-px shrink-0"
            style={btnPrimaryStyle}
          >
            <Shuffle size={15} /> Ne İzlesem
            <ButtonShimmer />
          </button>

          <button
            onClick={() => onTabChange('network')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ink-900/60 border border-ink-800/60 text-ink-400 hover:text-ink-100 hover:border-ink-700 font-extrabold text-[11.5px] tracking-[0.1em] uppercase whitespace-nowrap transition-all duration-300 hover:-translate-y-[2px] shrink-0"
          >
            <Users size={15} /> Sinevia Ağı
          </button>

          <span aria-hidden className="absolute left-0 right-0 bottom-[-1px] h-px pointer-events-none" style={{ background: TOPBAR_HAIRLINE }} />
        </header>

        <div id="main-scroll" onScroll={handleScroll} className="flex-1 overflow-y-auto p-3.5 sm:p-4 md:p-8 relative custom-scrollbar pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
          <div className={activeTab === 'achievements' ? 'w-full max-w-[100rem] mx-auto' : 'max-w-7xl mx-auto'}>{children}</div>
        </div>
      </main>

      {/* MOBİL: AKILLI SABİT ALT NAVİGASYON BARI (6 Sekme — En Sağda Ayarlar) */}
      <nav
        className={`md:hidden fixed bottom-0 inset-x-0 min-h-[62px] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] bg-ink-900/80 backdrop-blur-2xl border-t border-ink-800/60 z-[58] grid grid-cols-6 px-1 shadow-[0_-8px_25px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-in-out ${
          isNavVisible && !isModalOpen ? 'translate-y-0' : 'translate-y-[120%]'
        }`}
        style={glassSurface}
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-px pointer-events-none" style={{ background: TOPBAR_HAIRLINE }} />
        {mobileBottomTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleMobileMenuClick(tab.id as TabId)}
              data-tutorial={`nav-${tab.id}`}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-xl my-1.5 transition-all ${
                isActive ? 'text-gold-400 bg-gold-500/10' : 'text-ink-400 hover:text-ink-200'
              }`}
              style={isActive ? { backgroundImage: activePillStyle.backgroundImage } : undefined}
            >
              <Icon size={19} className={isActive ? 'scale-110' : ''} />
              <span className={`text-[9px] tracking-tight whitespace-nowrap ${isActive ? 'font-black' : 'font-semibold'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* GLOBAL ARAMA */}
      <GlobalSearch
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={onTabChange}
        onSelectMedia={handleSearchSelectMedia}
        data={profileData}
      />
      {searchDetail && (
        <MediaDetailModal target={searchDetail} onClose={() => setSearchDetail(null)} />
      )}

      {/* ÜST BAR MODALLARI */}
      {showBulkAdd && <BulkAddModal initialTab={showBulkAdd} onClose={() => setShowBulkAdd(false)} />}
      {showPick && (
        <PickModal
          seriesCount={allNextEpisodes.length}
          unwatchedMovies={eligibleMovies}
          nextEpisodes={allNextEpisodes}
          onPick={(item) => setPickedItem(item)}
          onClose={() => setShowPick(false)}
        />
      )}
      {pickedItem && (
        <RatingModal
          title={pickedItem.kind === 'movie' ? pickedItem.movie.title : pickedItem.series.title}
          subtitle={
            pickedItem.kind === 'movie'
              ? pickedItem.movie.year
                ? `Çıkış Yılı: ${pickedItem.movie.year}`
                : 'Film'
              : `${pickedItem.episode.season}. Sezon ${pickedItem.episode.episode}. Bölüm`
          }
          initialIsPastWatch={pickedItem.kind === 'movie' ? Boolean(pickedItem.movie.isPastWatch) : false}
          allowPastWatch={pickedItem.kind === 'movie'}
          onRate={(rating, note, detailedRating, reviewTags, isPastWatch) => {
            if (pickedItem.kind === 'movie') {
              watchMovie(pickedItem.movie.id, rating, note, detailedRating, reviewTags, isPastWatch);
            } else {
              watchEpisode(pickedItem.series.id, pickedItem.episode.id, rating, note, detailedRating, reviewTags);
            }
            setPickedItem(null);
          }}
          onClose={() => setPickedItem(null)}
        />
      )}

      {showWrapped && <WrappedModal onClose={() => setShowWrapped(false)} />}
    </div>
  );
}