const TMDB_API_KEY = "a6230f08d495e326b7a89e52dc186a45";

export interface TMDBResult {
  id: number;
  title: string;
  year: string;
  posterUrl: string | null;
  overview: string;
  genres: string[];
  runtime?: number;
}

export interface TMDBSeriesResult {
  id: number;
  title: string;
  year: string;
  posterUrl: string | null;
  overview: string;
  genres: string[];
  seasons: number[];
}

const GENRE_MAP: Record<number, string> = {
  28: 'Aksiyon', 12: 'Macera', 16: 'Animasyon', 35: 'Komedi', 80: 'Suç',
  99: 'Belgesel', 18: 'Dram', 10751: 'Aile', 14: 'Fantastik', 36: 'Tarih', // Drama -> Dram yapıldı
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
      let runtime;
      try {
        const detailRes = await fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_API_KEY}&language=tr-TR`);
        const detailData = await detailRes.json();
        runtime = detailData.runtime;
      } catch (e) {
        console.error("Süre çekilemedi:", e);
      }

      return {
        id: item.id,
        title: item.title || item.original_title,
        year: (item.release_date || '').split('-')[0],
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        overview: item.overview || '',
        genres: (item.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
        runtime: runtime
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
      try {
        const detailRes = await fetch(`https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}&language=tr-TR`);
        const detailData = await detailRes.json();
        
        seasonsCount = (detailData.seasons || [])
          .filter((s: any) => s.season_number > 0)
          .sort((a: any, b: any) => a.season_number - b.season_number)
          .map((s: any) => s.episode_count);
          
        genres = (detailData.genres || []).map((g: any) => g.name);
      } catch (e) {
        console.error("Dizi detayları çekilemedi:", e);
      }

      return {
        id: item.id,
        title: item.name || item.original_name,
        year: (item.first_air_date || '').split('-')[0],
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        overview: item.overview || '',
        genres: genres.length > 0 ? genres : (item.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
        seasons: seasonsCount.length > 0 ? seasonsCount : [10]
      };
    }));
    
    return results;
  } catch (err) {
    console.error("TMDB Dizi Arama Hatası:", err);
    return [];
  }
}