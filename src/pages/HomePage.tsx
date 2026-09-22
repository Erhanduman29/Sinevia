import { useState, useMemo } from 'react';
import { Shuffle, Projector, Tv, Sparkles, Trophy, Star, Crown, Search, TrendingUp, Zap, Clock, Bot, Dna } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { levelFromXp } from '../lib/xp';
import { getNextUnwatchedEpisode } from '../lib/utils';
import PickModal from '../components/PickModal';
import RatingModal from '../components/RatingModal';
import BulkAddModal from '../components/BulkAddModal';
import DnaSynthesizerModal from '../components/DnaSynthesizerModal';
import type { Movie, Series, Episode } from '../types';

export default function HomePage() {
  const { data, watchMovie, watchEpisode } = useApp();
  
  const [showBulkAdd, setShowBulkAdd] = useState<'movie' | 'tv' | false>(false);
  const [showPick, setShowPick] = useState(false);
  const [showDnaModal, setShowDnaModal] = useState(false);
  const [pickedItem, setPickedItem] = useState<
    | { kind: 'movie'; movie: Movie }
    | { kind: 'series'; series: Series; episode: Episode }
    | null
  >(null);

  const eligibleMovies = useMemo(() => {
    const unwatched = data.movies.filter((m) => !m.watched);
    const standalone = unwatched.filter((m) => !m.collectionId);

    const collectionGroups = new Map<string, Movie[]>();
    unwatched.filter((m) => m.collectionId).forEach((m) => {
      const arr = collectionGroups.get(m.collectionId!) || [];
      arr.push(m);
      collectionGroups.set(m.collectionId!, arr);
    });

    const sequentialCollectionMovies: Movie[] = [];
    collectionGroups.forEach((movies) => {
      const sorted = [...movies].sort((a, b) => (a.year || '9999').localeCompare(b.year || '9999'));
      if (sorted.length > 0) sequentialCollectionMovies.push(sorted[0]);
    });

    return [...standalone, ...sequentialCollectionMovies];
  }, [data.movies]);

  const nextEpisodes = data.series
    .map((s) => {
      const next = getNextUnwatchedEpisode(s.episodes);
      return next ? { series: s, episode: next } : null;
    })
    .filter((x): x is { series: Series; episode: Episode } => x !== null);

  const lvl = levelFromXp(data.totalXp);

  const getLevelTitle = (level: number) => {
    if (level < 5) return { title: 'Çaylak İzleyici', color: 'text-ink-300', bgGlow: 'bg-ink-500/10', gradient: 'from-ink-600 to-ink-400', barGradient: 'from-ink-600 to-ink-400' };
    if (level < 10) return { title: 'Film Meraklısı', color: 'text-blue-400', bgGlow: 'bg-blue-500/15', gradient: 'from-blue-600 to-blue-400', barGradient: 'from-blue-700 via-blue-500 to-cyan-400' };
    if (level < 20) return { title: 'Tutkulu Sinefil', color: 'text-violet-400', bgGlow: 'bg-violet-500/15', gradient: 'from-violet-600 to-violet-400', barGradient: 'from-violet-700 via-violet-500 to-fuchsia-400' };
    if (level < 40) return { title: 'Sinema Otoritesi', color: 'text-gold-400', bgGlow: 'bg-gold-500/15', gradient: 'from-gold-600 to-gold-400', barGradient: 'from-gold-700 via-gold-500 to-yellow-300' };
    return { title: 'Sinevia Efsanesi', color: 'text-cyan-400', bgGlow: 'bg-cyan-500/15', gradient: 'from-cyan-600 to-cyan-400', barGradient: 'from-cyan-700 via-cyan-500 to-teal-300' };
  };

  const userPersona = getLevelTitle(lvl.level);

  type PickItem = { kind: 'movie'; movie: Movie } | { kind: 'series'; series: Series; episode: Episode };

  const handlePick = (item: PickItem) => {
    setPickedItem(item);
  };

  const navigateTo = (tabId: string) => {
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: tabId }));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* PROFİL KARTI */}
      <div className={`relative bg-gradient-to-br from-ink-950 to-ink-900 border border-ink-800/80 rounded-[2rem] p-6 shadow-2xl overflow-hidden`}>
        <div className={`absolute top-0 right-0 w-64 h-64 ${userPersona.bgGlow} rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none transition-all duration-1000`} />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-center">
          <div className="flex items-center gap-5 flex-shrink-0">
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${userPersona.gradient} p-0.5 shadow-lg rotate-3 transition-colors duration-1000`}>
              <div className="w-full h-full bg-ink-950 rounded-[14px] flex items-center justify-center -rotate-3">
                <Crown className={userPersona.color} size={32} />
              </div>
            </div>
            <div>
              <div className={`text-xs font-black uppercase tracking-widest mb-1 transition-colors duration-1000 ${userPersona.color}`}>
                {userPersona.title}
              </div>
              <div className="text-3xl font-black text-white leading-none">Seviye {lvl.level}</div>
            </div>
          </div>

          <div className="flex-1 w-full md:border-l border-ink-800/80 md:pl-8">
            <div className="flex justify-between text-sm font-black text-ink-200 mb-2 uppercase tracking-widest">
              <span>İlerleme</span>
              <span className={userPersona.color}>% {Math.floor(lvl.progress)}</span>
            </div>
            
            <div className="h-4 w-full bg-ink-950 rounded-full overflow-hidden border border-ink-800/80 shadow-inner relative">
              <div 
                className={`h-full bg-gradient-to-r ${userPersona.barGradient} transition-all duration-1000 relative`}
                style={{ width: `${Math.max(2, lvl.progress)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
            
            <div className="flex justify-between items-center text-xs md:text-sm text-ink-400 mt-3 font-bold uppercase tracking-widest">
              <span>Toplam <span className="text-white">{(data.totalXp || 0).toLocaleString()} XP</span></span>
              <span>Sıradaki Unvana <span className={userPersona.color}>{Math.max(0, lvl.nextLevelXp - lvl.currentLevelXp).toLocaleString()} XP</span> Kaldı</span>
            </div>
          </div>
        </div>
      </div>

      {/* KLASİK ACTION CENTER (SEVİYE ÇUBUĞUNUN HEMEN ALTINA TAŞINDI) */}
      <div className="bg-ink-900/40 backdrop-blur-md border border-ink-700/50 rounded-[2rem] p-6 md:p-8 text-center space-y-6 shadow-xl animate-fade-in-up">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => setShowPick(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 px-8 py-4 rounded-xl font-bold hover:from-gold-400 hover:to-gold-500 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-gold-500/25 group"
          >
            <Shuffle size={24} className="group-hover:rotate-180 transition-transform duration-500" />
            Rastgele Seçim Yap
          </button>
          
          <div className="flex w-full sm:w-auto gap-4">
            <button
              onClick={() => setShowBulkAdd('movie')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 bg-ink-800/80 text-white px-8 py-4 rounded-xl font-semibold hover:bg-ink-700 transition-all border border-ink-700 hover:border-ink-500 shadow-md"
            >
              <Search size={20} className="text-ink-400" />
              Katalogdan Ekle
            </button>
          </div>
        </div>
      </div>

      {data.dailyStreak > 1 && (
        <div className="bg-gradient-to-r from-orange-900/40 via-ink-900/60 to-ink-900/40 border border-orange-700/30 rounded-2xl p-4 flex items-center gap-4 shadow-lg animate-fade-in-up">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20 flex-shrink-0">
            <Zap size={24} className="text-white fill-white" />
          </div>
          <div>
            <div className="text-base font-bold text-orange-200">Alev Aldın! {data.dailyStreak} Günlük Seri</div>
            <div className="text-sm text-orange-400/80">Her gün izlemeye devam et, seriyi bozma.</div>
          </div>
        </div>
      )}

      {/* YENİ NESİL YAPAY ZEKA BANNER'I */}
      <div className="bg-gradient-to-r from-azure-900/30 via-indigo-900/30 to-ink-900/40 border border-azure-700/40 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden animate-fade-in-up">
        <div className="absolute top-0 right-0 w-64 h-64 bg-azure-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="flex items-center gap-5 relative z-10 w-full md:w-auto">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-azure-500 to-indigo-600 p-0.5 shadow-lg shadow-azure-500/30 shrink-0">
            <div className="w-full h-full bg-ink-950 rounded-[14px] flex items-center justify-center">
              <Bot className="text-azure-400" size={32} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-azure-400 mb-1 flex items-center gap-1.5">
              <Sparkles size={12} /> Yeni Nesil Özellik
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white mb-1 tracking-tight">Sinevia AI ile Tanış</h3>
            <p className="text-sm text-ink-300 max-w-md leading-relaxed">
              Ne izleyeceğini bulamıyor musun? Asistanına nasıl bir şey aradığını söyle, sana özel yapımları anında kütüphanene eklesin.
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => navigateTo('ai')} 
          className="w-full md:w-auto shrink-0 bg-gradient-to-r from-azure-600 to-indigo-600 hover:from-azure-500 hover:to-indigo-500 text-white font-black px-8 py-4 rounded-xl shadow-lg shadow-azure-500/25 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5 relative z-10"
        >
          <Bot size={20} /> Asistanla Sohbet Et
        </button>
      </div>

      {/* DNA SENTEZLEYİCİ LABORATUVAR BANNER'I */}
      <div className="bg-gradient-to-r from-emerald-900/30 via-teal-900/30 to-ink-900/40 border border-emerald-700/40 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden animate-fade-in-up delay-75">
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        
        <div className="flex items-center gap-5 relative z-10 w-full md:w-auto">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-0.5 shadow-lg shadow-emerald-500/30 shrink-0">
            <div className="w-full h-full bg-ink-950 rounded-[14px] flex items-center justify-center">
              <Dna className="text-emerald-400" size={32} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1 flex items-center gap-1.5">
              <Sparkles size={12} /> Çapraz Tavsiye Motoru
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white mb-1 tracking-tight">Film Laboratuvarı</h3>
            <p className="text-sm text-ink-300 max-w-md leading-relaxed">
              İki favori filmini seç, DNA'larını çaprazla ve genetik olarak sana en uygun yapımı kütüphanenden sentezle.
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => setShowDnaModal(true)} 
          className="w-full md:w-auto shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-8 py-4 rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5 relative z-10"
        >
          <Dna size={20} /> DNA Sentezle
        </button>
      </div>

      {/* İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button 
          onClick={() => navigateTo('movies')} 
          className="group relative overflow-hidden flex flex-col items-center justify-center bg-ink-900/60 border border-ink-700/50 rounded-2xl p-5 text-center shadow-lg hover:border-gold-500/40 transition-all hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Projector size={26} className="text-gold-400 mb-2 group-hover:scale-110 transition-transform duration-300" />
          <div className="text-3xl font-black text-ink-100">{data.movies.length}</div>
          <div className="text-xs font-semibold text-ink-500 tracking-wider uppercase mt-1 group-hover:text-gold-400/80 transition-colors">Film Arşivi</div>
        </button>

        <button 
          onClick={() => navigateTo('series')} 
          className="group relative overflow-hidden flex flex-col items-center justify-center bg-ink-900/60 border border-ink-700/50 rounded-2xl p-5 text-center shadow-lg hover:border-azure-500/40 transition-all hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-azure-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Tv size={26} className="text-azure-400 mb-2 group-hover:scale-110 transition-transform duration-300" />
          <div className="text-3xl font-black text-ink-100">{data.series.length}</div>
          <div className="text-xs font-semibold text-ink-500 tracking-wider uppercase mt-1 group-hover:text-azure-400/80 transition-colors">Dizi Arşivi</div>
        </button>

        <button 
          onClick={() => navigateTo('history')} 
          className="group relative overflow-hidden flex flex-col items-center justify-center bg-ink-900/60 border border-ink-700/50 rounded-2xl p-5 text-center shadow-lg hover:border-violet-500/40 transition-all hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Clock size={26} className="text-violet-400 mb-2 group-hover:scale-110 transition-transform duration-300" />
          <div className="text-3xl font-black text-ink-100">{data.history.length}</div>
          <div className="text-xs font-semibold text-ink-500 tracking-wider uppercase mt-1 group-hover:text-violet-400/80 transition-colors">Geçmiş</div>
        </button>

        <button 
          onClick={() => navigateTo('achievements')} 
          className="group relative overflow-hidden flex flex-col items-center justify-center bg-ink-900/60 border border-ink-700/50 rounded-2xl p-5 text-center shadow-lg hover:border-emerald-500/40 transition-all hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Trophy size={26} className="text-emerald-400 mb-2 group-hover:scale-110 transition-transform duration-300" />
          <div className="text-3xl font-black text-ink-100">
            {data.achievements.reduce((s, a) => s + a.unlockedTiers.length, 0)}
          </div>
          <div className="text-xs font-semibold text-ink-500 tracking-wider uppercase mt-1 group-hover:text-emerald-400/80 transition-colors">Başarımlar</div>
        </button>
      </div>

      {/* NASIL ÇALIŞIR KISMI */}
      <div>
        <div className="flex items-center gap-3 mb-5 pl-2">
          <Sparkles className="text-gold-400" size={24} />
          <h3 className="text-xl font-bold text-white">Sistem Nasıl Çalışır?</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-ink-900/40 backdrop-blur-sm border border-ink-700/40 rounded-2xl p-5 hover:bg-ink-800/40 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <Search size={20} className="text-blue-400" />
            </div>
            <h4 className="font-bold text-white mb-2">1. Ara ve Seç</h4>
            <p className="text-sm text-ink-400 leading-relaxed">Katalogdan veya yapay zeka asistanıyla filmleri bul, sepetine at ve arşivle.</p>
          </div>
          
          <div className="bg-ink-900/40 backdrop-blur-sm border border-ink-700/40 rounded-2xl p-5 hover:bg-ink-800/40 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center mb-4 border border-gold-500/20 group-hover:scale-110 transition-transform">
              <Shuffle size={20} className="text-gold-400" />
            </div>
            <h4 className="font-bold text-white mb-2">2. Karar Veremiyor Musun?</h4>
            <p className="text-sm text-ink-400 leading-relaxed">Kütüphanenden seçtiğin türlere göre çarkı çevir, izleyeceğin filmi rastgele belirle.</p>
          </div>

          <div className="bg-ink-900/40 backdrop-blur-sm border border-ink-700/40 rounded-2xl p-5 hover:bg-ink-800/40 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <Star size={20} className="text-emerald-400" />
            </div>
            <h4 className="font-bold text-white mb-2">3. Puanla ve Arşivle</h4>
            <p className="text-sm text-ink-400 leading-relaxed">İzlediğin yapımlara 10 üzerinden puan ver, notlarını yaz. Hepsi günlüğünde saklansın.</p>
          </div>

          <div className="bg-ink-900/40 backdrop-blur-sm border border-ink-700/40 rounded-2xl p-5 hover:bg-ink-800/40 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4 border border-violet-500/20 group-hover:scale-110 transition-transform">
              <TrendingUp size={20} className="text-violet-400" />
            </div>
            <h4 className="font-bold text-white mb-2">4. Seviye Atla</h4>
            <p className="text-sm text-ink-400 leading-relaxed">İzledikçe XP kazan, gizli başarımları aç ve profilini bir Sinevia Efsanesine dönüştür.</p>
          </div>
        </div>
      </div>

      {showBulkAdd && (
        <BulkAddModal 
          initialTab={showBulkAdd} 
          onClose={() => setShowBulkAdd(false)} 
        />
      )}

      {showPick && (
        <PickModal
          movieCount={eligibleMovies.length}
          seriesCount={nextEpisodes.length}
          unwatchedMovies={eligibleMovies}
          nextEpisodes={nextEpisodes}
          onPick={handlePick}
          onClose={() => setShowPick(false)}
        />
      )}
      
      {showDnaModal && <DnaSynthesizerModal onClose={() => setShowDnaModal(false)} />}
      
      {pickedItem && (
        <RatingModal
          title={pickedItem.kind === 'movie' ? pickedItem.movie.title : pickedItem.series.title}
          subtitle={
            pickedItem.kind === 'movie'
              ? pickedItem.movie.year ? `Çıkış Yılı: ${pickedItem.movie.year}` : 'Film'
              : `${pickedItem.episode.season}. Sezon ${pickedItem.episode.episode}. Bölüm`
          }
          onRate={(rating, note) => {
            if (pickedItem.kind === 'movie') {
              watchMovie(pickedItem.movie.id, rating, note);
            } else {
              watchEpisode(pickedItem.series.id, pickedItem.episode.id, rating, note);
            }
          }}
          onClose={() => setPickedItem(null)}
        />
      )}
    </div>
  );
}