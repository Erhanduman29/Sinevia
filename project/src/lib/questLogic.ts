import { Movie, Series, WatchHistoryItem } from '../types';

/* ══════════════════════════════════════════════════════════════════════════
   GÖREV DOĞRULAMA MOTORU — Yardımcı Tarih / Gruplama Araçları
   Tüm "aynı gün", "arka arkaya", "farklı tür" koşulları bu çekirdek
   yardımcılarla değerlendirilir. Tarihler kullanıcının YEREL saatine göre
   güne bölünür (UTC kayması olmadan).
   ══════════════════════════════════════════════════════════════════════════ */

function toDayKey(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

function keyOfDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Öğeleri izlendiği güne göre gruplar (geçersiz tarihler atlanır). */
function groupByDay<T>(items: T[], getWhen: (t: T) => string | null | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = toDayKey(getWhen(it));
    if (!k) continue;
    const arr = map.get(k);
    if (arr) arr.push(it);
    else map.set(k, [it]);
  }
  return map;
}

/** İzlenme sırasına göre dizilmiş filmlerde, koşulu sağlayan `len` adet ardışık (arka arkaya) kayıt var mı? */
function hasConsecutiveRun(movies: Movie[], len: number, pred: (m: Movie) => boolean): boolean {
  const sorted = movies
    .filter((m) => Boolean(m.watchedAt))
    .sort((a, b) => new Date(a.watchedAt as string).getTime() - new Date(b.watchedAt as string).getTime());
  let run = 0;
  for (const m of sorted) {
    if (pred(m)) {
      run += 1;
      if (run >= len) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

/** Aynı gün içinde koşulu sağlayan en az `minCount` film var mı? */
function hasMoviesOnSameDay(movies: Movie[], minCount: number, pred?: (m: Movie) => boolean): boolean {
  for (const arr of groupByDay(movies, (m) => m.watchedAt).values()) {
    const list = pred ? arr.filter(pred) : arr;
    if (list.length >= minCount) return true;
  }
  return false;
}

/** Aynı gün içinde birincil türleri (genres[0]) birbirinden farklı en az `count` film var mı? */
function hasDistinctGenreMovies(movies: Movie[], minMovies: number, minGenres: number): boolean {
  for (const arr of groupByDay(movies, (m) => m.watchedAt).values()) {
    if (arr.length < minMovies) continue;
    const primaries = new Set(arr.map((m) => (m.genres && m.genres[0]) || '').filter(Boolean));
    if (primaries.size >= minGenres) return true;
  }
  return false;
}

/** Aynı gün içinde (dizi ayrımı gözetmeksizin) en az `minCount` bölüm izlenmiş mi? */
function hasEpisodesOnSameDay(episodes: WatchHistoryItem[], minCount: number): boolean {
  for (const arr of groupByDay(episodes, (e) => e.watchedAt).values()) {
    if (arr.length >= minCount) return true;
  }
  return false;
}

/** Aynı diziden aynı gün içinde en az `minCount` bölüm izlenmiş mi? */
function hasSeriesClusterSameDay(episodes: WatchHistoryItem[], minCount: number): boolean {
  const counts = new Map<string, number>();
  for (const e of episodes) {
    const key = `${e.seriesId || e.itemId || '?'}|${toDayKey(e.watchedAt)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const c of counts.values()) if (c >= minCount) return true;
  return false;
}

/** Filmlerin görev penceresindeki izlenme günlerinden oluşan küme. */
function watchedMovieDayKeys(movies: Movie[]): Set<string> {
  const set = new Set<string>();
  for (const m of movies) {
    const k = toDayKey(m.watchedAt);
    if (k) set.add(k);
  }
  return set;
}

export function evaluateQuestCompletion(
  questId: string,
  questAcceptedAt: number,
  history: WatchHistoryItem[],
  movies: Movie[],
  dailyStreak: number,
  series: Series[] = []
): boolean {
  // Sadece görevi KABUL ETTİKTEN SONRA izlenenler
  // Önceden izlenen (past watch) kayıtlar görevi tetiklemez; görevler yalnız
  // yeni izlemeler için vardır.
  const historySince = history.filter(h => {
    if (h.isPastWatch) return false;
    const watchedTime = new Date(h.watchedAt).getTime();
    return !isNaN(watchedTime) && watchedTime >= questAcceptedAt;
  });

  const watchedMovies = movies.filter(m =>
    m.watched && historySince.some(h => h.kind === 'movie' && h.itemId === m.id)
  );

  const ratedMovies = movies.filter(m =>
    m.rating !== null && historySince.some(h => h.kind === 'movie' && h.itemId === m.id)
  );

  const watchedEpisodes = historySince.filter(h => h.kind === 'series' && !h.bulkRating);

  // Görev kabulünden SONRA yapılan puan revizyonları. Burada `historySince`
  // KULLANILMAZ: kullanıcı filmi görevden önce izlemiş olabilir, puanı ise görev
  // aktifken değiştirmiş olabilir. Ölçüt izleme zamanı değil, değişiklik zamanıdır.
  const revisedMovies = history.filter(h =>
    h.kind === 'movie' &&
    h.previousRating != null &&
    Boolean(h.ratingChangedAt) &&
    new Date(h.ratingChangedAt as string).getTime() >= questAcceptedAt
  );

  const episodeRuntimeOf = (e: WatchHistoryItem): number => {
    if (e.bulkRating) return 0;
    const s = series.find(x => x.id === (e.seriesId || e.itemId));
    const ep = s?.episodes.find(x => x.season === e.season && x.episode === e.episode);
    return e.actualRuntime || e.originalRuntime || ep?.runtime || s?.episodeRuntime || 0;
  };

  switch (questId) {
    case 'c_picky_taste': 
      return ratedMovies.some(m => m.rating === 7.5 || m.rating === 8.5);
    case 'c_short_movie': 
      return watchedMovies.some(m => m.runtime && m.runtime < 90);
    case 'c_action_fan': 
      return watchedMovies.some(m => m.genres?.includes('Aksiyon') && m.rating !== null);
    case 'c_comedy_fan': 
      return watchedMovies.some(m => m.genres?.includes('Komedi'));
    case 'c_drama_fan': 
      return watchedMovies.some(m => m.genres?.includes('Dram'));
    case 'c_sci_fi_fan': 
      return watchedMovies.some(m => m.genres?.includes('Bilim Kurgu'));
    case 'c_documentary': 
      return watchedMovies.some(m => m.genres?.includes('Belgesel'));
    case 'c_animation': 
      return watchedMovies.some(m => m.genres?.includes('Animasyon'));
    case 'c_masterpiece': 
      return ratedMovies.some(m => m.rating === 10);
    case 'c_trash': 
      return ratedMovies.some(m => m.rating !== null && m.rating <= 3);
    case 'c_mediocre': 
      return ratedMovies.some(m => m.rating !== null && m.rating >= 5 && m.rating <= 6);
    case 'c_detailer': 
      return watchedMovies.some(m => m.reviewTags && m.reviewTags.length >= 3);
    case 'c_writer': 
      return watchedMovies.some(m => m.note && m.note.length >= 50);
    case 'c_old_movie': 
      return watchedMovies.some(m => m.year && parseInt(m.year) < 2000);
    case 'c_new_movie': {
      const currentYear = new Date().getFullYear().toString();
      return watchedMovies.some(m => m.year === currentYear);
    }
    case 'c_weekend': 
      return watchedMovies.some(m => {
        if (!m.watchedAt) return false;
        const day = new Date(m.watchedAt).getDay();
        return day === 0 || day === 6; 
      });
    case 'c_weekday': 
      return watchedMovies.some(m => {
        if (!m.watchedAt) return false;
        return new Date(m.watchedAt).getDay() === 1; 
      });
    case 'c_episode_rating': 
      return watchedEpisodes.some(e => e.rating !== null && e.rating >= 8);
    case 'c_series_pilot': 
      return watchedEpisodes.some(e => e.season === 1 && e.episode === 1);
    case 'c_series_double': 
      // Aynı gün içinde en az 2 dizi bölümü
      return hasEpisodesOnSameDay(watchedEpisodes, 2);

    case 'r_night_watch': 
      return watchedMovies.some(m => {
        if (!m.watchedAt) return false;
        const hr = new Date(m.watchedAt).getHours();
        return hr >= 1 && hr < 5;
      });
    case 'r_two_hours': 
      return watchedMovies.some(m => m.runtime && m.runtime >= 120 && m.runtime <= 130);
    case 'r_tarantino': 
      return watchedMovies.some(m => (m.genres?.includes('Suç') || m.genres?.includes('Gerilim')) && m.rating !== null && m.rating >= 8);
    case 'r_classic':
      return watchedMovies.some(m => m.year && parseInt(m.year) >= 1970 && parseInt(m.year) <= 1980);
    case 'r_mystery_solver':
      return watchedMovies.some(m => m.genres?.includes('Gizem') && m.note && m.note.length >= 100);
    case 'r_consistent': 
      return dailyStreak >= 3; 
    case 'r_variety': 
      // Aynı gün içinde birincil türleri farklı en az 2 film
      return hasDistinctGenreMovies(watchedMovies, 2, 2);
    case 'r_series_wolf': 
      // Aynı diziden aynı gün en az 3 bölüm
      return hasSeriesClusterSameDay(watchedEpisodes, 3);
    case 'r_friday_joy': 
      return watchedMovies.some(m => {
        if (!m.watchedAt) return false;
        const d = new Date(m.watchedAt);
        return d.getDay() === 5 && d.getHours() >= 20; 
      });
    case 'r_double_action': 
      return hasMoviesOnSameDay(watchedMovies, 2, m => Boolean(m.genres?.includes('Aksiyon')));
    case 'r_double_horror': 
      return hasMoviesOnSameDay(watchedMovies, 2, m => Boolean(m.genres?.includes('Korku')));
    case 'r_long_movie': 
      return watchedMovies.some(m => m.runtime && m.runtime >= 150);
    case 'r_perfect_pair': 
      // Aynı gün izlediğin 2 filme de 9 veya 10 puan
      return hasMoviesOnSameDay(watchedMovies, 2, m => m.rating != null && m.rating >= 9);
    case 'r_indecisive': 
      // İzledikten sonra puanı en az bir kez değiştir (revize et)
      return revisedMovies.length > 0;
    case 'r_second_chance':
      // 5 altı bir puanı sonradan 7 ve üzerine yükselt
      return revisedMovies.some(h => (h.previousRating as number) < 5 && h.rating != null && h.rating >= 7);

    case 'e_series_killer': 
      // Aynı diziden aynı gün en az 5 bölüm
      return hasSeriesClusterSameDay(watchedEpisodes, 5);
    case 'e_culture_envoy': 
      // Aynı gün içinde birincil türleri farklı en az 3 film
      return hasDistinctGenreMovies(watchedMovies, 3, 3);
    case 'e_old_school': 
      return watchedMovies.some(m => m.year && parseInt(m.year) <= 1960);
    case 'e_heavy_novel': 
      return watchedMovies.some(m => m.note && m.note.length >= 1000);
    case 'e_marathon_3': 
      // Aynı gün içinde 3 film
      return hasMoviesOnSameDay(watchedMovies, 3);
    case 'e_perfect_3': 
      // Aynı gün içinde 8+ puanlı 3 film
      return hasMoviesOnSameDay(watchedMovies, 3, m => m.rating != null && m.rating >= 8);
    case 'e_weekday_warrior': {
      // Hafta içi (Pzt-Cuma) 5 gün üst üste her gün en az 1 film
      const days = watchedMovieDayKeys(watchedMovies);
      for (const key of days) {
        const d = dateKeyToDate(key);
        const wd = d.getDay(); // 0=Pazar ... 6=Cumartesi
        if (wd < 1 || wd > 5) continue;
        const monday = new Date(d);
        monday.setDate(d.getDate() - (wd - 1));
        let ok = true;
        for (let i = 0; i < 5; i++) {
          const dd = new Date(monday);
          dd.setDate(monday.getDate() + i);
          if (!days.has(keyOfDate(dd))) { ok = false; break; }
        }
        if (ok) return true;
      }
      return false;
    }
    case 'e_season_finale': {
      // Bir dizinin bir sezonunun SON bölümünü izle (sezonundaki en yüksek bölüm numarası)
      if (series.length === 0) return false;
      for (const e of watchedEpisodes) {
        const sid = e.seriesId || e.itemId;
        const s = series.find(x => x.id === sid);
        if (!s || e.season == null || e.episode == null) continue;
        const seasonEps = s.episodes.filter(ep => ep.season === e.season);
        if (seasonEps.length === 0) continue;
        const maxEp = Math.max(...seasonEps.map(ep => ep.episode));
        if (e.episode === maxEp) return true;
      }
      return false;
    }

    case 'l_directors_cut': 
      return watchedMovies.some(m => m.runtime && m.runtime >= 180);
    case 'l_weekend_massacre': {
      // Tek bir Cuma-Cumartesi-Pazar penceresinde toplam 4 film
      const byDay = groupByDay(watchedMovies, m => m.watchedAt);
      for (const key of byDay.keys()) {
        const d = dateKeyToDate(key);
        const wd = d.getDay();
        let friday: Date;
        if (wd === 5) friday = new Date(d);
        else if (wd === 6) { friday = new Date(d); friday.setDate(d.getDate() - 1); }
        else if (wd === 0) { friday = new Date(d); friday.setDate(d.getDate() - 2); }
        else continue;
        let total = 0;
        for (let i = 0; i < 3; i++) {
          const dd = new Date(friday);
          dd.setDate(friday.getDate() + i);
          total += byDay.get(keyOfDate(dd))?.length ?? 0;
        }
        if (total >= 4) return true;
      }
      return false;
    }
    case 'l_flawless_selection': 
      // Arka arkaya izlenen 4 filme de 9+ puan (araya düşük puanlı film girmeden)
      return hasConsecutiveRun(watchedMovies, 4, m => m.rating != null && m.rating >= 9);
    case 'l_sinevia_god': 
      return dailyStreak >= 7;
    case 'l_marathon_5': 
      // Aynı gün içinde 5 film
      return hasMoviesOnSameDay(watchedMovies, 5);

    case 'm_hater': 
      // Arka arkaya izlenen 3 filme de 3 ve altı puan
      return hasConsecutiveRun(watchedMovies, 3, m => m.rating != null && m.rating <= 3);
    case 'm_impatient': 
      // Sayacı başlayan bir filmi ilk 15 dakikasında iptal etme (Sinematik Otopsi)
      return movies.some(m =>
        Boolean(m.abandoned) &&
        Boolean(m.abandonedAt) &&
        new Date(m.abandonedAt as string).getTime() >= questAcceptedAt &&
        m.abandonedProgress?.unit === 'minute' &&
        typeof m.abandonedProgress.value === 'number' &&
        m.abandonedProgress.value > 0 &&
        m.abandonedProgress.value <= 15
      );

    case 'c_night_series':
      return watchedEpisodes.some(e => {
        const hr = new Date(e.watchedAt).getHours();
        return hr >= 22 || hr < 4;
      });
    case 'c_series_note':
      return watchedEpisodes.some(e => (e.rating ?? 0) >= 7 && (e.note || '').length >= 30);
    case 'c_three_genres':
      return new Set(watchedMovies.map(m => m.genres?.[0]).filter(Boolean)).size >= 3;
    case 'c_short_episode':
      return watchedEpisodes.some(e => episodeRuntimeOf(e) > 0 && episodeRuntimeOf(e) <= 30);
    case 'r_series_marathon':
      return hasSeriesClusterSameDay(watchedEpisodes, 4);
    case 'r_movie_series_day': {
      const days = new Set(watchedMovies.map(m => toDayKey(m.watchedAt)).filter(Boolean));
      for (const day of days) {
        if (watchedEpisodes.filter(e => toDayKey(e.watchedAt) === day).length >= 2) return true;
      }
      return false;
    }
    case 'r_documentary_pair':
      return watchedMovies.filter(m => m.genres?.includes('Belgesel')).length >= 2;
    case 'r_series_high':
      return watchedEpisodes.filter(e => (e.rating ?? 0) >= 9).length >= 3;
    case 'e_season_binge':
      return hasEpisodesOnSameDay(watchedEpisodes, 6);
    case 'e_weekend_binge': {
      const byDay = groupByDay(watchedEpisodes, e => e.watchedAt);
      for (const [key, eps] of byDay) {
        const wd = dateKeyToDate(key).getDay();
        if ((wd === 5 || wd === 6 || wd === 0) && eps.length >= 6) return true;
      }
      return false;
    }
    case 'e_genre_marathon': {
      const byDay = groupByDay(watchedMovies, m => m.watchedAt);
      for (const arr of byDay.values()) {
        const counts = new Map<string, number>();
        for (const m of arr) {
          for (const g of m.genres || []) counts.set(g, (counts.get(g) || 0) + 1);
        }
        if (Array.from(counts.values()).some(c => c >= 4)) return true;
      }
      return false;
    }
    case 'l_series_devotion':
      return watchedEpisodes.length >= 15;
    case 'l_cinema_century':
      return watchedMovies.length >= 10;
    case 'm_series_hater': {
      const sorted = [...watchedEpisodes].sort((a, b) => new Date(a.watchedAt).getTime() - new Date(b.watchedAt).getTime());
      let run = 0;
      for (const e of sorted) {
        if (e.rating != null && e.rating <= 3) { run += 1; if (run >= 3) return true; }
        else run = 0;
      }
      return false;
    }
    case 'm_binge_queen':
      return hasEpisodesOnSameDay(watchedEpisodes, 10);

    default:
      return false;
  }
}
