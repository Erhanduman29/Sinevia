/**
 * TMDB anahtarı .env dosyasından gelir: VITE_TMDB_API_KEY
 * Not: VITE_ önekli değişkenler istemci paketinde görünür; bu bir gizlilik
 * katmanı değildir, sadece anahtarın kod içinde dağınık durmasını engeller.
 */
export const TMDB_API_KEY = (import.meta.env.VITE_TMDB_API_KEY ?? '').trim();

export interface WatchProvider {
  logoUrl: string;
  providerName: string;
  link?: string;
}

export interface TMDBResult {
  id: number;
  title: string;
  year: string;
  posterUrl: string | null;
  overview: string;
  genres: string[];
  runtime?: number;
  keywords?: string[];
  directors?: string[];
  cast?: string[];
  studios?: string[];
  originalLanguage?: string;
  imdbId?: string; // YENİ
  watchProviders?: WatchProvider[]; // YENİ
}

export interface TMDBSeriesResult {
  id: number;
  title: string;
  year: string;
  posterUrl: string | null;
  overview: string;
  genres: string[];
  seasons: number[];
  keywords?: string[];
  creators?: string[];
  cast?: string[];
  studios?: string[];
  originalLanguage?: string;
  imdbId?: string; // YENİ
  watchProviders?: WatchProvider[]; // YENİ
  episodeRuntime?: number; // YENİ: bölüm başına ortalama süre (dk)
  /** Gerçek sezon/bölüm verisi geldi mi? (varsayılan [10] ile karışmaması için) */
  hasSeasonData?: boolean;
}

const GENRE_MAP: Record<number, string> = {
  28: 'Aksiyon', 12: 'Macera', 16: 'Animasyon', 35: 'Komedi', 80: 'Suç',
  99: 'Belgesel', 18: 'Dram', 10751: 'Aile', 14: 'Fantastik', 36: 'Tarih', 
  27: 'Korku', 10402: 'Müzik', 9648: 'Gizem', 10749: 'Romantik', 878: 'Bilim Kurgu',
  10770: 'TV Filmi', 53: 'Gerilim', 10752: 'Savaş', 37: 'Vahşi Batı'
};

/**
 * Dizinin TMDB'deki güncel sezon/bölüm yapısı — "Eksikleri Bul" taraması için.
 * air_date filtrelenmez: gelecek bölümler de listede görünsün isteniyor.
 */
export async function fetchSeriesSeasonCounts(
  tmdbId: number
): Promise<{ season: number; episodes: number }[]> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR`);
    if (!res.ok) return [];
    const data = await res.json();
    const seasons: { season_number?: number; episode_count?: number }[] = Array.isArray(data?.seasons) ? data.seasons : [];
    return seasons
      .filter((s) => (s.season_number ?? 0) > 0 && (s.episode_count ?? 0) > 0)
      .map((s) => ({ season: s.season_number as number, episodes: s.episode_count as number }))
      .sort((a, b) => a.season - b.season);
  } catch {
    return [];
  }
}

/**
 * Dizinin sezon/bölüm sürelerini (dk) TMDB'den çeker.
 * Dönen yapı: [{ season, episodes: [{ episode, runtime? }] }]
 * Ağ/parse hatalarında boş dizi döner — çağıran akış bozulmaz.
 */
export async function fetchSeriesSeasonDetails(
  tmdbId: number
): Promise<{ season: number; episodes: { episode: number; runtime?: number }[] }[]> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR`);
    if (!res.ok) return [];
    const data = await res.json();
    const seasons: { season_number?: number }[] = Array.isArray(data?.seasons) ? data.seasons : [];
    const seasonNumbers = seasons
      .map((s) => s.season_number ?? 0)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    const out: { season: number; episodes: { episode: number; runtime?: number }[] }[] = [];
    for (const seasonNumber of seasonNumbers) {
      try {
        const seasonRes = await fetch(
          `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=tr-TR`
        );
        if (!seasonRes.ok) continue;
        const seasonData = await seasonRes.json();
        const eps: { episode_number?: number; runtime?: number | null }[] = Array.isArray(seasonData?.episodes)
          ? seasonData.episodes
          : [];
        out.push({
          season: seasonNumber,
          episodes: eps.map((ep) => ({
            episode: ep.episode_number as number,
            runtime: ep.runtime ?? undefined,
          })),
        });
      } catch {
        /* tek sezon hatası tüm taramayı düşürmesin */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function searchTMDB(query: string): Promise<TMDBResult[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API Key eksik!");
    return [];
  }
  
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=tr-TR&page=1`);
    if (!res.ok) return [];
    const data = await res.json();
    
    const results = await Promise.all(data.results.slice(0, 8).map(async (item: any) => {
      let runtime, keywords: string[] = [], directors: string[] = [], cast: string[] = [], studios: string[] = [];
      let imdbId = undefined;
      let watchProviders: WatchProvider[] = [];
      
      try {
        // YENİ: watch/providers ve external_ids eklendi
        const detailRes = await fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_API_KEY}&language=tr-TR&append_to_response=keywords,credits,watch/providers,external_ids`);
        const detailData = await detailRes.json();
        
        runtime = detailData.runtime;
        imdbId = detailData.external_ids?.imdb_id || detailData.imdb_id;
        
        // YENİ: Türkiye'deki Yasal Platformları Çek (Netflix, Prime vb.)
        const trProviders = detailData['watch/providers']?.results?.TR;
        if (trProviders) {
          const providersList = [...(trProviders.flatrate || []), ...(trProviders.rent || []), ...(trProviders.buy || [])];
          // Tekrar eden platformları engelle
          const uniqueProviders = Array.from(new Map(providersList.map(p => [p.provider_id, p])).values());
          watchProviders = uniqueProviders.slice(0, 3).map((p: any) => ({
            logoUrl: `https://image.tmdb.org/t/p/w200${p.logo_path}`,
            providerName: p.provider_name,
            link: trProviders.link
          }));
        }
        
        if (detailData.production_companies) {
          studios = detailData.production_companies.slice(0, 3).map((c: any) => c.name);
        }
        
        const kwList = detailData.keywords?.keywords || detailData.keywords?.results || [];
        keywords = kwList.slice(0, 10).map((k: any) => k.name.toLocaleLowerCase('tr-TR').trim());
        
        if (detailData.credits) {
          directors = (detailData.credits.crew || [])
            .filter((c: any) => c.job === 'Director' || c.department === 'Directing')
            .map((d: any) => d.name.trim());
            
          cast = (detailData.credits.cast || [])
            .slice(0, 5)
            .map((a: any) => a.name.trim());
        }
      } catch (e) {
        console.error("Film verileri çekilemedi:", e);
      }

      return {
        id: item.id,
        title: item.title || item.original_title,
        year: (item.release_date || '').split('-')[0],
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        overview: item.overview || '',
        genres: (item.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
        runtime: runtime,
        keywords,
        directors: Array.from(new Set(directors)),
        cast: Array.from(new Set(cast)),
        studios: Array.from(new Set(studios)),
        originalLanguage: item.original_language || '',
        imdbId,
        watchProviders
      };
    }));
    
    return results;
  } catch (err) {
    console.error("TMDB Arama Hatası:", err);
    return [];
  }
}

export async function searchTMDBSeries(query: string): Promise<TMDBSeriesResult[]> {
  if (!TMDB_API_KEY) return [];
  
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=tr-TR&page=1`);
    if (!res.ok) return [];
    const data = await res.json();
    
    const results = await Promise.all(data.results.slice(0, 8).map(async (item: any) => {
      let seasonsCount: number[] = [];
      let genres: string[] = [];
      let keywords: string[] = [], creators: string[] = [], cast: string[] = [], studios: string[] = [];
      let imdbId = undefined;
      let watchProviders: WatchProvider[] = [];
      let episodeRuntime: number | undefined;
      
      try {
        // YENİ: watch/providers ve external_ids eklendi
        const detailRes = await fetch(`https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}&language=tr-TR&append_to_response=keywords,credits,watch/providers,external_ids`);
        const detailData = await detailRes.json();
        
        imdbId = detailData.external_ids?.imdb_id;
        episodeRuntime = detailData.episode_run_time?.[0] ?? detailData.last_episode_to_air?.runtime ?? undefined;

        // YENİ: Türkiye'deki Yasal Platformları Çek
        const trProviders = detailData['watch/providers']?.results?.TR;
        if (trProviders) {
          const providersList = [...(trProviders.flatrate || []), ...(trProviders.rent || []), ...(trProviders.buy || [])];
          const uniqueProviders = Array.from(new Map(providersList.map(p => [p.provider_id, p])).values());
          watchProviders = uniqueProviders.slice(0, 3).map((p: any) => ({
            logoUrl: `https://image.tmdb.org/t/p/w200${p.logo_path}`,
            providerName: p.provider_name,
            link: trProviders.link
          }));
        }
        
        seasonsCount = (detailData.seasons || [])
          .filter((s: any) => s.season_number > 0)
          .sort((a: any, b: any) => a.season_number - b.season_number)
          .map((s: any) => s.episode_count);
          
        genres = (detailData.genres || []).map((g: any) => g.name);
        
        if (detailData.production_companies) {
          studios = detailData.production_companies.slice(0, 3).map((c: any) => c.name);
        }
        
        const kwList = detailData.keywords?.results || detailData.keywords?.keywords || [];
        keywords = kwList.slice(0, 10).map((k: any) => k.name.toLocaleLowerCase('tr-TR').trim());
        
        if (detailData.created_by) {
          creators = detailData.created_by.map((c: any) => c.name.trim());
        }
        if (detailData.credits) {
          cast = (detailData.credits.cast || [])
            .slice(0, 5)
            .map((a: any) => a.name.trim());
        }
        
      } catch (e) {
        console.error("Dizi verileri çekilemedi:", e);
      }

      return {
        id: item.id,
        title: item.name || item.original_name,
        year: (item.first_air_date || '').split('-')[0],
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        overview: item.overview || '',
        genres: genres.length > 0 ? genres : (item.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
        seasons: seasonsCount.length > 0 ? seasonsCount : [10],
        keywords,
        creators: Array.from(new Set(creators)),
        cast: Array.from(new Set(cast)),
        studios: Array.from(new Set(studios)),
        originalLanguage: item.original_language || '',
        imdbId,
        watchProviders,
        episodeRuntime
      };
    }));
    
    return results;
  } catch (err) {
    console.error("TMDB Dizi Arama Hatası:", err);
    return [];
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   MIGRATION ENGINE — hafif arama ve ID ile detay çözümleme
   ══════════════════════════════════════════════════════════════════════════ */

export interface TMDBBasicResult {
  id: number;
  title: string;
  originalTitle?: string;
  year: string;
  posterUrl: string | null;
  overview: string;
  genres: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 429 / ağ hatalarında bekleyip yeniden dener. */
async function tmdbJson(url: string, attempt = 0): Promise<any | null> {
  if (!TMDB_API_KEY) return null;
  try {
    const res = await fetch(url);
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(700 * (attempt + 1));
      return tmdbJson(url, attempt + 1);
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    if (attempt < 2) {
      await sleep(500 * (attempt + 1));
      return tmdbJson(url, attempt + 1);
    }
    return null;
  }
}

function providersOf(data: any): WatchProvider[] {
  const tr = data?.['watch/providers']?.results?.TR;
  if (!tr) return [];
  const list = [...(tr.flatrate || []), ...(tr.rent || []), ...(tr.buy || [])];
  const unique = Array.from(new Map(list.map((p: any) => [p.provider_id, p])).values());
  return unique.slice(0, 3).map((p: any) => ({
    logoUrl: `https://image.tmdb.org/t/p/w200${p.logo_path}`,
    providerName: p.provider_name,
    link: tr.link,
  }));
}

/** Yalnızca arama sonucu — 8 detay isteği yapmaz (aktarım önizlemesi için hızlıdır). */
export async function searchTMDBBasic(query: string, language = 'tr-TR'): Promise<TMDBBasicResult[]> {
  if (!TMDB_API_KEY) return [];
  const data = await tmdbJson(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=${encodeURIComponent(language)}&page=1`);
  if (!data?.results) return [];
  return (data.results as any[]).slice(0, 6).map((item) => ({
    id: item.id,
    title: item.title || item.original_title || '',
    originalTitle: item.original_title || undefined,
    year: (item.release_date || '').split('-')[0],
    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    overview: item.overview || '',
    genres: (item.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
  }));
}

export async function searchTMDBSeriesBasic(query: string, language = 'tr-TR'): Promise<TMDBBasicResult[]> {
  if (!TMDB_API_KEY) return [];
  const data = await tmdbJson(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=${encodeURIComponent(language)}&page=1`);
  if (!data?.results) return [];
  return (data.results as any[]).slice(0, 6).map((item) => ({
    id: item.id,
    title: item.name || item.original_name || '',
    originalTitle: item.original_name || undefined,
    year: (item.first_air_date || '').split('-')[0],
    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    overview: item.overview || '',
    genres: (item.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
  }));
}

export async function fetchTMDBMovieDetails(id: number): Promise<TMDBResult | null> {
  if (!TMDB_API_KEY) return null;
  const data = await tmdbJson(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=tr-TR&append_to_response=keywords,credits,watch/providers,external_ids`,
  );
  if (!data) return null;

  const kwList = data.keywords?.keywords || data.keywords?.results || [];
  const directors = (data.credits?.crew || [])
    .filter((c: any) => c.job === 'Director' || c.department === 'Directing')
    .map((c: any) => String(c.name || '').trim())
    .filter(Boolean);
  const cast = (data.credits?.cast || []).slice(0, 5).map((c: any) => String(c.name || '').trim()).filter(Boolean);

  return {
    id: data.id,
    title: data.title || data.original_title || '',
    year: (data.release_date || '').split('-')[0],
    posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
    overview: data.overview || '',
    genres: (data.genres || []).map((g: any) => g.name),
    runtime: data.runtime ?? undefined,
    keywords: kwList.slice(0, 10).map((k: any) => String(k.name || '').toLocaleLowerCase('tr-TR').trim()),
    directors: Array.from(new Set(directors)),
    cast: Array.from(new Set(cast)),
    studios: (data.production_companies || []).slice(0, 3).map((c: any) => c.name),
    originalLanguage: data.original_language || '',
    imdbId: data.external_ids?.imdb_id || data.imdb_id || undefined,
    watchProviders: providersOf(data),
  };
}

export async function fetchTMDBSeriesDetails(id: number): Promise<TMDBSeriesResult | null> {
  if (!TMDB_API_KEY) return null;
  const data = await tmdbJson(
    `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}&language=tr-TR&append_to_response=keywords,credits,watch/providers,external_ids`,
  );
  if (!data) return null;

  const kwList = data.keywords?.results || data.keywords?.keywords || [];
  const seasons = (data.seasons || [])
    .filter((s: any) => (s.season_number ?? 0) > 0 && (s.episode_count ?? 0) > 0)
    .sort((a: any, b: any) => a.season_number - b.season_number)
    .map((s: any) => Number(s.episode_count) || 0);
  const cast = (data.credits?.cast || []).slice(0, 5).map((c: any) => String(c.name || '').trim()).filter(Boolean);

  return {
    id: data.id,
    title: data.name || data.original_name || '',
    year: (data.first_air_date || '').split('-')[0],
    posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
    overview: data.overview || '',
    genres: (data.genres || []).map((g: any) => g.name),
    seasons: seasons.length > 0 ? seasons : [10],
    keywords: kwList.slice(0, 10).map((k: any) => String(k.name || '').toLocaleLowerCase('tr-TR').trim()),
    creators: (data.created_by || []).map((c: any) => String(c.name || '').trim()).filter(Boolean),
    cast: Array.from(new Set(cast)),
    studios: (data.production_companies || []).slice(0, 3).map((c: any) => c.name),
    originalLanguage: data.original_language || '',
    imdbId: data.external_ids?.imdb_id || undefined,
    watchProviders: providersOf(data),
    episodeRuntime: data.episode_run_time?.[0] ?? data.last_episode_to_air?.runtime ?? undefined,
    hasSeasonData: seasons.length > 0,
  };
}

/** IMDb ID'sini TMDB ID'sine çevirir (`/find` endpointi). */
export async function findTMDBByImdbId(
  imdbId: string,
  preferredType?: 'movie' | 'series',
): Promise<{ id: number; type: 'movie' | 'series' } | null> {
  if (!TMDB_API_KEY || !/^tt\d+$/i.test(imdbId)) return null;
  const data = await tmdbJson(
    `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=tr-TR`,
  );
  if (!data) return null;
  const movie = Array.isArray(data.movie_results) ? data.movie_results[0] : null;
  const tv = Array.isArray(data.tv_results) ? data.tv_results[0] : null;
  if (preferredType === 'series' && tv) return { id: tv.id, type: 'series' };
  if (preferredType === 'movie' && movie) return { id: movie.id, type: 'movie' };
  if (movie) return { id: movie.id, type: 'movie' };
  if (tv) return { id: tv.id, type: 'series' };
  return null;
}