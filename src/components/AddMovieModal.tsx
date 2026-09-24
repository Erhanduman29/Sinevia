import { useState } from 'react';
import { X, Plus, Boxes, Clock, Search, Loader2, Image as ImageIcon } from 'lucide-react';
import { useApp, resolveTMDBGenres } from '../context/AppContext';
import { normalize } from '../lib/utils';
import { searchTMDB, type TMDBResult } from '../lib/tmdb';
import type { WatchProvider } from '../types';

interface Props {
  onClose: () => void;
}

export default function AddMovieModal({ onClose }: Props) {
  const { data, addMovie, addCollection } = useApp();
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [runtime, setRuntime] = useState<string>('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [useCollection, setUseCollection] = useState(false);
  const [collectionMode, setCollectionMode] = useState<'select' | 'new'>('select');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [overview, setOverview] = useState('');
  const [tmdbId, setTmdbId] = useState<number | undefined>();
  
  // YENİ: İzleme linki verilerini hafızada tut
  const [imdbId, setImdbId] = useState<string | undefined>();
  const [watchProviders, setWatchProviders] = useState<WatchProvider[]>([]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchTMDB(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleSelectMovie = (movie: TMDBResult) => {
    setTitle(movie.title);
    setYear(movie.year);
    if (movie.runtime) setRuntime(movie.runtime.toString());
    setPosterUrl(movie.posterUrl);
    setOverview(movie.overview);
    setTmdbId(movie.id);
    
    // İzleme Verilerini çek
    setImdbId(movie.imdbId);
    setWatchProviders(movie.watchProviders || []);
    
    // Tür eşleştirmesi
    const mappedIncoming = resolveTMDBGenres(movie.genres, data.genres);
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

  const handleSubmit = () => {
    if (!title.trim()) return;
    let collectionId: string | null = null;
    if (useCollection) {
      if (collectionMode === 'new' && newCollectionName.trim()) {
        const existing = data.collections.find((c) => normalize(c.name) === normalize(newCollectionName));
        if (existing) {
          collectionId = existing.id;
        } else {
          collectionId = addCollection(newCollectionName);
        }
      } else if (collectionMode === 'select' && selectedCollectionId) {
        collectionId = selectedCollectionId;
      }
    }
    
    const runtimeNum = runtime ? parseInt(runtime, 10) : undefined;
    
    // YENİ: addMovie'ye imdbId ve watchProviders'ı gönderiyoruz
    const ok = addMovie(title, year, selectedGenres, collectionId, runtimeNum, posterUrl, overview, tmdbId, imdbId, watchProviders);
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
            <Plus size={20} className="text-gold-400" /> Film Ekle
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200 transition-colors">
            <X size={22} />
          </button>
        </div>
        
        <div className="p-5 space-y-6">
          <div className="bg-ink-800/40 p-4 rounded-xl border border-ink-700/50">
            <label className="block text-sm font-semibold text-gold-400 mb-2">🔍 İnternetten Otomatik Bul (TMDB)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Film adını yazın..."
                  className="w-full bg-ink-900 border border-ink-700 rounded-lg pl-9 pr-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="bg-gold-500 hover:bg-gold-400 text-ink-950 px-5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center min-w-[100px]"
              >
                {isSearching ? <Loader2 size={18} className="animate-spin" /> : 'Ara'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {searchResults.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMovie(m)}
                    className="flex flex-col text-left group bg-ink-900 rounded-lg overflow-hidden border border-ink-700 hover:border-gold-500/50 transition-all"
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
            <span className="text-xs font-semibold text-ink-400 uppercase">Manuel Doldur</span>
            <div className="flex-1 h-px bg-ink-700" />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Film Adı</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="örn. Inception"
              className="w-full bg-ink-800 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-ink-500 transition-colors"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Çıkış Yılı</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="örn. 2010"
                className="w-full bg-ink-800 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-ink-500 transition-colors"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-ink-300 mb-1.5">
                <Clock size={16} className="text-ink-400" />
                Süre (Dakika)
              </label>
              <input
                type="number"
                value={runtime}
                onChange={(e) => setRuntime(e.target.value)}
                placeholder="örn. 148"
                className="w-full bg-ink-800 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-ink-500 transition-colors"
              />
            </div>
          </div>

          {posterUrl && (
            <div className="flex items-center gap-3 p-3 bg-ink-800/30 rounded-lg border border-ink-700/50">
              <img src={posterUrl} alt="Afiş" className="w-10 h-14 rounded object-cover shadow-sm" />
              <div className="flex-1">
                <div className="text-xs font-semibold text-gold-400 mb-0.5">Afiş, Özet ve İzleme Linkleri Eklendi</div>
                <div className="text-[11px] text-ink-400 line-clamp-1">{overview}</div>
              </div>
              <button onClick={() => { setPosterUrl(null); setOverview(''); setTmdbId(undefined); setImdbId(undefined); setWatchProviders([]); }} className="text-xs text-red-400 hover:underline px-2">Kaldır</button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink-300 mb-2">Türler</label>
            <div className="flex flex-wrap gap-2">
              {displayedGenres.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedGenres.includes(g)
                      ? 'bg-ink-100 text-ink-900'
                      : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <button
              onClick={() => setUseCollection(!useCollection)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
                useCollection
                  ? 'border-ink-500 bg-ink-800 text-ink-100'
                  : 'border-ink-700 bg-ink-800/50 text-ink-400 hover:text-ink-200'
              }`}
            >
              <Boxes size={18} />
              <span className="text-sm font-medium">Koleksiyon / Seri</span>
            </button>
            {useCollection && (
              <div className="mt-3 space-y-3 pl-2 border-l-2 border-ink-700">
                <div className="flex gap-2">
                  <button
                    onClick={() => setCollectionMode('select')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      collectionMode === 'select' ? 'bg-ink-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'
                    }`}
                  >
                    Mevcut Koleksiyon
                  </button>
                  <button
                    onClick={() => setCollectionMode('new')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      collectionMode === 'new' ? 'bg-ink-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'
                    }`}
                  >
                    Yeni Koleksiyon
                  </button>
                </div>
                {collectionMode === 'select' ? (
                  data.collections.length > 0 ? (
                    <select
                      value={selectedCollectionId}
                      onChange={(e) => setSelectedCollectionId(e.target.value)}
                      className="w-full bg-ink-800 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 focus:outline-none focus:border-ink-500"
                    >
                      <option value="">Koleksiyon seç...</option>
                      {data.collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-ink-500">Henüz koleksiyon yok. Yeni koleksiyon oluşturun.</p>
                  )
                ) : (
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Koleksiyon adı (örn. Marvel Evreni)"
                    className="w-full bg-ink-800 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-ink-500 transition-colors"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-ink-700 sticky bottom-0 bg-ink-900 z-10">
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="w-full flex items-center justify-center gap-2 bg-ink-100 text-ink-900 rounded-lg py-3 font-semibold hover:bg-ink-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={20} />
            Film Ekle
          </button>
        </div>
      </div>
    </div>
  );
}