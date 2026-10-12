import { useState } from 'react';
import { X, Plus, Trash2, ChevronUp, ChevronDown, Search, Loader2, Image as ImageIcon, Users, User } from 'lucide-react';
import { useApp, resolveTMDBGenres } from '../context/AppContext';
import { searchTMDBSeries, type TMDBSeriesResult } from '../lib/tmdb';
import type { WatchProvider } from '../types';

interface Props {
  onClose: () => void;
}

export default function AddSeriesModal({ onClose }: Props) {
  const { addSeries, data } = useApp();
  const [title, setTitle] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<number[]>([10]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TMDBSeriesResult[]>([]);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [overview, setOverview] = useState('');
  const [tmdbId, setTmdbId] = useState<number | undefined>();
  const [year, setYear] = useState('');
  
  // İzleme linki ve Sinema Kartı (Künye/DNA) verilerini hafızada tut
  const [imdbId, setImdbId] = useState<string | undefined>();
  const [watchProviders, setWatchProviders] = useState<WatchProvider[]>([]);
  const [creators, setCreators] = useState<string[]>([]);
  const [cast, setCast] = useState<string[]>([]);
  const [studios, setStudios] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [originalLanguage, setOriginalLanguage] = useState<string | undefined>();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchTMDBSeries(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleSelectSeries = (series: TMDBSeriesResult) => {
    setTitle(series.title);
    setYear(series.year);
    setPosterUrl(series.posterUrl);
    setOverview(series.overview);
    setTmdbId(series.id);
    setSeasons(series.seasons);
    
    // İzleme ve Künye Verilerini çek
    setImdbId(series.imdbId);
    setWatchProviders(series.watchProviders || []);
    setCreators(series.creators || []);
    setCast(series.cast || []);
    setStudios(series.studios || []);
    setKeywords(series.keywords || []);
    setOriginalLanguage(series.originalLanguage);
    
    const mappedIncoming = resolveTMDBGenres(series.genres, data.genres);
    const newGenres = new Set([...selectedGenres, ...mappedIncoming]);
    setSelectedGenres(Array.from(newGenres));
    
    setSearchResults([]);
    setSearchQuery('');
  };

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const addSeason = () => {
    setSeasons((prev) => [...prev, 10]);
  };

  const removeSeason = (index: number) => {
    setSeasons((prev) => prev.filter((_, i) => i !== index));
  };

  const moveSeason = (index: number, dir: 'up' | 'down') => {
    setSeasons((prev) => {
      const next = [...prev];
      const target = dir === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateEpisodeCount = (index: number, value: string) => {
    const num = Math.max(1, Math.min(1000, parseInt(value) || 1));
    setSeasons((prev) => prev.map((s, i) => (i === index ? num : s)));
  };

  const totalEpisodes = seasons.reduce((sum, s) => sum + s, 0);

  const handleSubmit = () => {
    if (!title.trim() || seasons.length === 0) return;
    // YENİ: Tüm künye ve DNA bilgilerini de addSeries fonksiyonuna gönderiyoruz
    const ok = addSeries(
      title, 
      selectedGenres, 
      seasons, 
      posterUrl, 
      overview, 
      tmdbId, 
      year, 
      imdbId, 
      watchProviders,
      {
        creators,
        cast,
        studios,
        keywords,
        originalLanguage
      }
    );
    if (ok) onClose();
  };

  const displayedGenres = Array.from(new Set([...data.genres, ...selectedGenres])).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-ink-700 sticky top-0 bg-ink-900 z-20">
          <h2 className="text-lg font-semibold text-ink-100 flex items-center gap-2">
            <Plus size={20} className="text-azure-400" /> Dizi Ekle
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200 transition-colors">
            <X size={22} />
          </button>
        </div>
        <div className="p-5 space-y-6">
          
          <div className="bg-ink-800/40 p-4 rounded-xl border border-ink-700/50">
            <label className="block text-sm font-semibold text-azure-400 mb-2">🔍 İnternetten Otomatik Bul (TMDB)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Dizi adını yazın..."
                  className="w-full bg-ink-900 border border-ink-700 rounded-lg pl-9 pr-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-azure-500/50 transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="bg-azure-500 hover:bg-azure-400 text-white px-5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center min-w-[100px]"
              >
                {isSearching ? <Loader2 size={18} className="animate-spin" /> : 'Ara'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {searchResults.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectSeries(m)}
                    className="flex flex-col text-left group bg-ink-900 rounded-lg overflow-hidden border border-ink-700 hover:border-azure-500/50 transition-all"
                  >
                    <div className="aspect-[2/3] w-full bg-ink-950 flex items-center justify-center relative overflow-hidden">
                      {m.posterUrl ? (
                        <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <ImageIcon size={24} className="text-ink-700" />
                      )}
                    </div>
                    <div className="p-2">
                      <div className="font-semibold text-ink-100 text-xs line-clamp-1">{m.title}</div>
                      <div className="text-[10px] text-ink-400 mt-0.5">{m.year || 'Bilinmiyor'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 opacity-50">
            <div className="flex-1 h-px bg-ink-700" />
            <span className="text-xs font-semibold text-ink-400 uppercase">Manuel İncele / Düzenle</span>
            <div className="flex-1 h-px bg-ink-700" />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Dizi Adı</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="örn. Leyla ile Mecnun"
              className="w-full bg-ink-800 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-azure-500 transition-colors"
            />
          </div>

          {posterUrl && (
            <div className="flex items-start gap-3 p-3.5 bg-ink-800/40 rounded-xl border border-azure-500/30">
              <img src={posterUrl} alt="Afiş" className="w-12 h-18 rounded-lg object-cover shadow-md flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-xs font-bold text-azure-400">Sinema Kartı Bilgileri Hazır!</div>
                <div className="text-[11px] text-ink-300 line-clamp-2">{overview}</div>
                {creators.length > 0 && (
                  <div className="text-[10px] text-ink-400 flex items-center gap-1 pt-0.5">
                    <User size={11} className="text-azure-400" /> <span className="font-semibold text-ink-200">Yaratıcı:</span> {creators.slice(0, 2).join(', ')}
                  </div>
                )}
                {cast.length > 0 && (
                  <div className="text-[10px] text-ink-400 flex items-center gap-1">
                    <Users size={11} className="text-azure-400" /> <span className="font-semibold text-ink-200">Oyuncular:</span> {cast.slice(0, 3).join(', ')}
                  </div>
                )}
              </div>
              <button 
                onClick={() => { 
                  setPosterUrl(null); 
                  setOverview(''); 
                  setTmdbId(undefined); 
                  setImdbId(undefined); 
                  setWatchProviders([]);
                  setCreators([]);
                  setCast([]);
                  setStudios([]);
                  setKeywords([]);
                  setOriginalLanguage(undefined);
                }} 
                className="text-xs text-red-400 hover:underline px-2 flex-shrink-0"
              >
                Kaldır
              </button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ink-300">Sezonlar</label>
              <span className="text-xs text-ink-500">
                {seasons.length} sezon · {totalEpisodes} bölüm
              </span>
            </div>
            <div className="space-y-2">
              {seasons.map((epCount, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-ink-800/50 border border-ink-700/50 rounded-lg p-2.5"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveSeason(index, 'up')}
                      disabled={index === 0}
                      className="text-ink-500 hover:text-ink-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveSeason(index, 'down')}
                      disabled={index === seasons.length - 1}
                      className="text-ink-500 hover:text-ink-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-ink-400 w-16 flex-shrink-0">
                    {index + 1}. Sezon
                  </span>
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={epCount}
                      onChange={(e) => updateEpisodeCount(index, e.target.value)}
                      className="w-20 bg-ink-800 border border-ink-700 rounded px-2 py-1.5 text-sm text-ink-100 focus:outline-none focus:border-azure-500 transition-colors"
                    />
                    <span className="text-xs text-ink-500">bölüm</span>
                  </div>
                  {seasons.length > 1 && (
                    <button
                      onClick={() => removeSeason(index)}
                      className="text-ink-600 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addSeason}
              className="mt-2.5 w-full flex items-center justify-center gap-1.5 bg-ink-800 hover:bg-ink-700 border border-dashed border-ink-600 text-ink-400 hover:text-ink-200 rounded-lg py-2.5 text-sm font-medium transition-all"
            >
              <Plus size={16} />
              Sezon Ekle
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-300 mb-2">Türler</label>
            <div className="flex flex-wrap gap-2">
              {displayedGenres.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedGenres.includes(g)
                      ? 'bg-azure-500 text-white'
                      : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-ink-700 sticky bottom-0 bg-ink-900 z-10">
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || seasons.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-azure-500 to-azure-600 text-white rounded-lg py-3 font-semibold hover:from-azure-400 hover:to-azure-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={20} />
            Dizi Ekle
          </button>
        </div>
      </div>
    </div>
  );
}