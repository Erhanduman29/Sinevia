import { useState, useMemo } from 'react';
import { ChevronRight, Film, Tv, StickyNote, Clock, Search, Filter, Star as StarIcon, Edit2, Image as ImageIcon, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass, formatDateTime } from '../lib/utils';
import RatingModal from '../components/RatingModal';
import type { WatchHistoryItem, Movie } from '../types';

type SortMode = 'newest' | 'oldest' | 'rating';
type FilterType = 'all' | 'movie' | 'series';

export default function HistoryPage() {
  const { data, updateHistoryRating } = useApp();
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [showNotes, setShowNotes] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<WatchHistoryItem | null>(null);
  
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const processedItems = useMemo(() => {
    let items = [...data.history];

    if (filterType !== 'all') {
      items = items.filter(h => h.kind === filterType || h.type === filterType);
    }

    if (search.trim()) {
      const q = search.toLocaleLowerCase('tr-TR');
      items = items.filter(h => h.title.toLocaleLowerCase('tr-TR').includes(q));
    }

    items.sort((a, b) => {
      if (sortMode === 'newest') return new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime();
      if (sortMode === 'oldest') return new Date(a.watchedAt).getTime() - new Date(b.watchedAt).getTime();
      if (sortMode === 'rating') {
        const ra = a.rating ?? -1;
        const rb = b.rating ?? -1;
        return rb - ra;
      }
      return 0;
    });

    return items;
  }, [data.history, search, sortMode, filterType]);

  const seriesGroups = new Map<string, WatchHistoryItem[]>();
  processedItems.filter((h) => h.kind === 'series' || h.type === 'series').forEach((h) => {
    const sid = h.seriesId || h.itemId || h.id;
    const arr = seriesGroups.get(sid) || [];
    arr.push(h);
    seriesGroups.set(sid, arr);
  });

  const latestPerSeries = new Map<string, WatchHistoryItem>();
  processedItems.filter((h) => h.kind === 'series' || h.type === 'series').forEach((h) => {
    const sid = h.seriesId || h.itemId || h.id;
    const existing = latestPerSeries.get(sid);
    if (!existing || new Date(h.watchedAt) > new Date(existing.watchedAt)) {
      latestPerSeries.set(sid, h);
    }
  });

  const displayItems: { type: 'movie' | 'series'; item: WatchHistoryItem; seriesId?: string }[] = [];
  const seenSeries = new Set<string>();
  
  for (const item of processedItems) {
    if (item.kind === 'movie' || item.type === 'movie') {
      displayItems.push({ type: 'movie', item });
    } else {
      const sid = item.seriesId || item.itemId || hIdFallback(item);
      if (!seenSeries.has(sid)) {
        seenSeries.add(sid);
        const latest = latestPerSeries.get(sid)!;
        displayItems.push({ type: 'series', item: latest, seriesId: sid });
      }
    }
  }

  function hIdFallback(item: WatchHistoryItem) {
    return item.seriesId || item.itemId || item.id;
  }

  const groupedByDate = new Map<string, { type: 'movie' | 'series'; item: WatchHistoryItem; seriesId?: string }[]>();
  displayItems.forEach((d) => {
    const dateKey = new Date(d.item.watchedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    const arr = groupedByDate.get(dateKey) || [];
    arr.push(d);
    groupedByDate.set(dateKey, arr);
  });

  const toggleSeries = (sid: string) => {
    setExpandedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const toggleNote = (id: string) => {
    setShowNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink-100 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-500/20 border border-gold-500/30 flex items-center justify-center">
          <Clock size={22} className="text-gold-300" />
        </div>
        Geçmiş (Günlük)
      </h1>

      {data.history.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İzleme geçmişinde ara..."
              className="w-full bg-ink-800/80 border border-ink-700 rounded-lg pl-10 pr-4 py-2 text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/30 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex bg-ink-800/50 rounded-lg p-1 border border-ink-700/50">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === 'all' ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-300'}`}
              >
                Tümü
              </button>
              <button
                onClick={() => setFilterType('movie')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === 'movie' ? 'bg-gold-500/20 text-gold-400' : 'text-ink-400 hover:text-ink-300'}`}
              >
                <Film size={12} /> Filmler
              </button>
              <button
                onClick={() => setFilterType('series')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === 'series' ? 'bg-azure-500/20 text-azure-400' : 'text-ink-400 hover:text-ink-300'}`}
              >
                <Tv size={12} /> Diziler
              </button>
            </div>

            <div className="flex bg-ink-800/50 rounded-lg p-1 border border-ink-700/50">
              <button
                onClick={() => setSortMode('newest')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${sortMode === 'newest' ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-300'}`}
              >
                <Clock size={12} /> En Yeni
              </button>
              <button
                onClick={() => setSortMode('oldest')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${sortMode === 'oldest' ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-300'}`}
              >
                En Eski
              </button>
              <button
                onClick={() => setSortMode('rating')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${sortMode === 'rating' ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-300'}`}
              >
                <StarIcon size={12} /> Puana Göre
              </button>
            </div>
          </div>
        </div>
      )}

      {displayItems.length === 0 ? (
        <div className="text-center py-16 text-ink-500">
          <div className="w-16 h-16 rounded-2xl bg-ink-800/50 flex items-center justify-center mx-auto mb-4">
            <Film size={32} className="text-ink-600" />
          </div>
          <p className="text-lg font-medium">{data.history.length === 0 ? 'Henüz izlenen bir şey yok.' : 'Aramaya uygun sonuç bulunamadı.'}</p>
          <p className="text-sm mt-1">{data.history.length === 0 ? 'Film veya dizi izledikçe burada görünecek.' : 'Filtreleri veya arama kelimesini değiştirin.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedByDate.entries()).map(([dateLabel, items]) => (
            <div key={dateLabel} className="animate-fade-in-up">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-xs font-bold text-ink-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-gold-500/70" /> {dateLabel}
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-ink-700/50 to-transparent" />
              </div>

              <div className="space-y-3">
                {items.map(({ type, item, seriesId }) => {
                  if (type === 'movie') {
                    // Ana veritabanından filmin güncel verilerini (afiş, süre vb.) alıyoruz
                    const movieData = data.movies.find(m => m.id === (item.itemId || item.id));
                    return (
                      <MovieHistoryItem
                        key={item.id}
                        item={item}
                        movieData={movieData}
                        showNote={showNotes.has(item.id)}
                        onToggleNote={() => toggleNote(item.id)}
                        onEdit={() => setEditingItem(item)}
                      />
                    );
                  } else {
                    const sid = seriesId!;
                    const seriesData = data.series.find(s => s.id === sid); // Afiş ve detaylar için
                    const eps = (seriesGroups.get(sid) || []).sort(
                      (a, b) => {
                         if (sortMode === 'oldest') return new Date(a.watchedAt).getTime() - new Date(b.watchedAt).getTime();
                         if (sortMode === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
                         return new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime();
                      }
                    );
                    const isExpanded = expandedSeries.has(sid);

                    return (
                      <div
                        key={sid}
                        className="bg-gradient-to-br from-ink-900/80 to-ink-900/40 backdrop-blur-sm border border-ink-700/50 rounded-2xl overflow-hidden shadow-lg shadow-ink-950/30 transition-all hover:border-ink-600/50"
                      >
                        <button
                          onClick={() => toggleSeries(sid)}
                          className="w-full flex items-start gap-4 p-4 hover:bg-ink-800/30 transition-colors"
                        >
                          <div className="flex-shrink-0 w-14 sm:w-16 aspect-[2/3] rounded-lg bg-ink-950 border border-ink-700/50 flex items-center justify-center overflow-hidden">
                            {seriesData?.posterUrl ? (
                              <img src={seriesData.posterUrl} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <Tv size={24} className="text-ink-600" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-bold text-ink-100 truncate">{item.title}</h3>
                                <div className="text-xs text-ink-300 mt-1.5 flex items-center gap-1.5 flex-wrap">
                                  <span className="text-azure-400 font-semibold bg-azure-500/10 px-1.5 py-0.5 rounded">
                                    Son: {item.season}. Sezon {item.episode}. Bölüm
                                  </span>
                                  {seriesData?.year && <span>· {seriesData.year}</span>}
                                </div>
                                <div className="text-xs text-ink-500 mt-2 flex items-center gap-1.5">
                                  <Clock size={12}/> {formatDateTime(item.watchedAt)}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                {item.rating !== null && (
                                  <span className={`text-sm px-2.5 py-1 rounded-lg font-bold ${ratingBgClass(item.rating)}`}>
                                    {item.rating}
                                  </span>
                                )}
                                <div className="flex items-center gap-1 mt-1 text-ink-400 hover:text-ink-200">
                                  <span className="text-xs font-medium bg-ink-800/60 px-2 py-0.5 rounded-full">{eps.length} bölüm</span>
                                  <div className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                    <ChevronRight size={16} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-ink-700/40 bg-ink-950/30">
                            {eps.map((ep) => (
                              <div key={ep.id} className="px-4 py-3 hover:bg-ink-800/30 transition-colors border-b border-ink-800/40 last:border-0">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-azure-500/50 flex-shrink-0" />
                                    <div>
                                      <div className="text-sm text-ink-200 font-medium">
                                        {ep.season}. Sezon {ep.episode}. Bölüm
                                      </div>
                                      <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5">
                                        <Clock size={10} /> {formatDateTime(ep.watchedAt)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {ep.rating !== null && (
                                      <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${ratingBgClass(ep.rating)}`}>
                                        {ep.rating}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => setEditingItem(ep)}
                                      className="text-ink-500 hover:text-azure-400 p-1.5 rounded-md hover:bg-ink-800 transition-colors"
                                      title="Puanı Düzenle"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {ep.note && (
                                  <div className="mt-2.5 ml-4">
                                    <button
                                      onClick={() => toggleNote(ep.id)}
                                      className="text-xs font-medium text-ink-400 hover:text-azure-300 flex items-center gap-1.5 transition-colors"
                                    >
                                      <StickyNote size={12} /> {showNotes.has(ep.id) ? 'Notu Gizle' : 'Günlük Notunu Oku'}
                                    </button>
                                    {showNotes.has(ep.id) && (
                                      <div className="mt-2 bg-ink-900/50 rounded-lg p-3 border-l-2 border-azure-500/40 relative animate-fade-in">
                                        <p className="text-sm text-ink-300 italic whitespace-pre-wrap leading-relaxed">"{ep.note}"</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingItem && (
        <RatingModal
          title={editingItem.title}
          subtitle={
            editingItem.season != null
              ? `${editingItem.season}. Sezon ${editingItem.episode}. Bölüm (Puanı Düzenle)`
              : editingItem.year ? `Çıkış Yılı: ${editingItem.year} (Puanı Düzenle)` : 'Puanı Düzenle'
          }
          initialRating={editingItem.rating}
          initialNote={editingItem.note}
          onRate={(rating, note) => {
            updateHistoryRating(editingItem.id, rating, note);
            setEditingItem(null);
          }}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}

function MovieHistoryItem({
  item,
  movieData,
  showNote,
  onToggleNote,
  onEdit,
}: {
  item: WatchHistoryItem;
  movieData?: Movie;
  showNote: boolean;
  onToggleNote: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="bg-gradient-to-br from-ink-900/80 to-ink-900/40 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 shadow-lg shadow-ink-950/30 transition-all hover:border-ink-600/50 animate-fade-in-up">
      <div className="flex items-start gap-4">
        {/* YENİ: Afiş */}
        <div className="flex-shrink-0 w-14 sm:w-16 aspect-[2/3] rounded-lg bg-ink-950 border border-ink-700/50 flex items-center justify-center overflow-hidden shadow-inner">
          {movieData?.posterUrl ? (
            <img src={movieData.posterUrl} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <Film size={24} className="text-ink-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-ink-100 truncate">{item.title}</h3>
              
              <div className="text-xs text-ink-300 mt-1.5 flex items-center gap-1.5 flex-wrap">
                {movieData?.year && <span>{movieData.year}</span>}
                {movieData?.runtime && (
                  <>
                    <span className="text-ink-600">·</span>
                    <span>{movieData.runtime} dk</span>
                  </>
                )}
                {item.genres && item.genres.length > 0 && (
                  <>
                    <span className="text-ink-600">·</span>
                    <span className="truncate">{item.genres.join(', ')}</span>
                  </>
                )}
              </div>
              
              <div className="text-xs text-ink-500 mt-2 flex items-center gap-1.5">
                <Clock size={12}/> {formatDateTime(item.watchedAt)}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {item.rating !== null && (
                <span className={`text-base px-3 py-1.5 rounded-xl font-bold ${ratingBgClass(item.rating)}`}>
                  {item.rating}
                </span>
              )}
              <button
                onClick={onEdit}
                className="text-ink-500 hover:text-gold-400 p-1.5 rounded-lg hover:bg-ink-800/50 transition-colors"
                title="Puanı Düzenle"
              >
                <Edit2 size={16} />
              </button>
            </div>
          </div>

          {/* YENİ: Not Alanı Düzenlemesi */}
          {item.note && (
            <div className="mt-3">
              <button
                onClick={onToggleNote}
                className="text-xs font-medium text-ink-400 hover:text-gold-300 flex items-center gap-1.5 transition-colors"
              >
                <StickyNote size={12} /> {showNote ? 'Notu Gizle' : 'Günlük Notunu Oku'}
              </button>
              {showNote && (
                <div className="mt-2 bg-ink-950/50 rounded-lg p-3 border-l-2 border-gold-500/40 relative animate-fade-in">
                  <p className="text-sm text-ink-300 italic whitespace-pre-wrap leading-relaxed">"{item.note}"</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}