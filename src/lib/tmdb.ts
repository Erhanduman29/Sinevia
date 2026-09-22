const TMDB_API_KEY = "a6230f08d495e326b7a89e52dc186a45";

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
}

const GENRE_MAP: Record<number, string> = {
  28: 'Aksiyon', 12: 'Macera', 16: 'Animasyon', 35: 'Komedi', 80: 'Suç',
  99: 'Belgesel', 18: 'Dram', 10751: 'Aile', 14: 'Fantastik', 36: 'Tarih', 
  27: 'Korku', 10402: 'Müzik', 9648: 'Gizem', 10749: 'Romantik', 878: 'Bilim Kurgu',
  10770: 'TV Filmi', 53: 'Gerilim', 10752: 'Savaş', 37: 'Vahşi Batı'
};

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
      
      try {
        const detailRes = await fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_API_KEY}&language=tr-TR&append_to_response=keywords,credits`);
        const detailData = await detailRes.json();
        
        runtime = detailData.runtime;
        
        if (detailData.production_companies) {
          studios = detailData.production_companies.slice(0, 3).map((c: any) => c.name);
        }
        
        // Anahtar kelimeler (Hem film keywords objesi hem de dizi results yapısı kontrol edilir)
        const kwList = detailData.keywords?.keywords || detailData.keywords?.results || [];
        keywords = kwList.slice(0, 10).map((k: any) => k.name.toLocaleLowerCase('tr-TR').trim());
        
        if (detailData.credits) {
          // Yönetmenleri güvenli şekilde topla
          directors = (detailData.credits.crew || [])
            .filter((c: any) => c.job === 'Director' || c.department === 'Directing')
            .map((d: any) => d.name.trim());
            
          // En iyi 5 oyuncuyu al
          cast = (detailData.credits.cast || [])
            .slice(0, 5)
            .map((a: any) => a.name.trim());
        }
      } catch (e) {
        console.error("Film DNA'sı çekilemedi:", e);
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
        originalLanguage: item.original_language || ''
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
      
      try {
        const detailRes = await fetch(`https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}&language=tr-TR&append_to_response=keywords,credits`);
        const detailData = await detailRes.json();
        
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
        console.error("Dizi DNA'sı çekilemedi:", e);
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
        originalLanguage: item.original_language || ''
      };
    }));
    
    return results;
  } catch (err) {
    console.error("TMDB Dizi Arama Hatası:", err);
    return [];
  }
}