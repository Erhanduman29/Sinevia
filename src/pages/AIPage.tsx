import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Plus, Check, Film, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { AIMessage } from '../context/AppContext';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''; 
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || 'a6230f08d495e326b7a89e52dc186a45';

interface TMDBActionItem {
  tmdbData: any;
  action: 'recommend' | 'add';
  type: 'movie' | 'tv';
  status: 'pending' | 'added';
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export default function AIPage() {
  const { data, addMovie, addSeries, updateAIHistory } = useApp();
  
  const [messages, setMessages] = useState<AIMessage[]>(() => {
    const defaultWelcome: AIMessage = {
      id: 'welcome',
      sender: 'ai',
      text: 'Merhaba! Ben Sinevia AI. Ne izlemek istediğine karar veremedin mi? Veya "Bana Christopher Nolan\'ın tüm filmlerini ekle" mi demek istersin? Sana yardım etmek için buradayım.',
      timestamp: Date.now()
    };
    
    if (data.aiChatHistory && data.aiChatHistory.length > 0) {
      if (!data.aiChatHistory.find(m => m.id === 'welcome')) {
        return [defaultWelcome, ...data.aiChatHistory];
      }
      return data.aiChatHistory;
    }
    return [defaultWelcome];
  });
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getSystemPrompt = () => {
    const movieCount = data.movies.length;
    const seriesCount = data.series.length;
    
    const topMovies = [...data.movies]
      .filter(m => m.rating)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5)
      .map(m => `${m.title} (${m.rating} Puan)`);

    return `Senin adın "Sinevia AI". Sen bir sinema/dizi uzmanı ve kişisel asistansın.
Kullanıcının profil bilgileri:
- Kütüphanesinde ${movieCount} film ve ${seriesCount} dizi var.
- Favori filmleri şunlar: ${topMovies.join(', ')}. Bu tarzı sevdiğini unutma.

GÖREVLERİN VE KURALLAR:
1. Kullanıcıyla samimi, zeki ve sinema tutkunu gibi konuş. Kısa ve net ol.
2. EĞER KULLANICI FİLM/DİZİ ÖNERİSİ İSTERSE: Sadece birkaç cümleyle neden önerdiğini açıkla.
3. EĞER KULLANICI KÜTÜPHANESİNE BİR ŞEY EKLEMENİ İSTERSE: "Kütüphanene ekledim" şeklinde cevap ver.

ÇOK ÖNEMLİ KURAL (AJAN KOMUTU):
Eğer bir yapım öneriyorsan veya kütüphaneye eklemen gerekiyorsa, cevabının EN SONUNA KESİNLİKLE aşağıdaki formatta bir JSON bloğu eklemelisin. Başka hiçbir format kabul edilmez.

Örnek JSON Formatı:
\`\`\`json
[
  {"title": "The Matrix", "type": "movie", "action": "add"},
  {"title": "Breaking Bad", "type": "tv", "action": "recommend"}
]
\`\`\``;
  };

  const processWatchProviders = (detailData: any) => {
    const trProviders = detailData['watch/providers']?.results?.TR;
    if (trProviders) {
      const providersList = [...(trProviders.flatrate || []), ...(trProviders.rent || []), ...(trProviders.buy || [])];
      const uniqueProviders = Array.from(new Map(providersList.map(p => [p.provider_id, p])).values());
      return uniqueProviders.slice(0, 3).map((p: any) => ({
        logoUrl: `https://image.tmdb.org/t/p/w200${p.logo_path}`,
        providerName: p.provider_name,
        link: trProviders.link
      }));
    }
    return [];
  };

  const processAIResponse = async (responseText: string): Promise<{ cleanText: string; actionItems: TMDBActionItem[] }> => {
    let cleanText = responseText;
    let actionItems: TMDBActionItem[] = [];

    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = responseText.match(jsonRegex);

    if (match && match[1]) {
      try {
        const jsonCommands = JSON.parse(match[1]);
        cleanText = responseText.replace(jsonRegex, '').trim();

        for (const cmd of jsonCommands) {
          const type = cmd.type === 'tv' ? 'tv' : 'movie';
          const res = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cmd.title)}&language=tr-TR&page=1`);
          const json = await res.json();
          
          if (json.results && json.results.length > 0) {
            const bestMatch = json.results[0]; 
            
            if (cmd.action === 'add') {
              const fullDetailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${bestMatch.id}?api_key=${TMDB_API_KEY}&language=tr-TR&append_to_response=watch/providers,external_ids`);
              const details = await fullDetailsRes.json();
              const posterFullUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
              const genres = details.genres ? details.genres.map((g: any) => g.name) : [];
              const watchProviders = processWatchProviders(details);
              const imdbId = details.external_ids?.imdb_id || details.imdb_id;
              
              if (type === 'movie') {
                const year = details.release_date ? details.release_date.substring(0, 4) : '';
                addMovie(details.title || bestMatch.title, year, genres, null, details.runtime || 0, posterFullUrl, details.original_title, details.id, imdbId, watchProviders);
              } else {
                const year = details.first_air_date ? details.first_air_date.substring(0, 4) : '';
                const seasons = (details.seasons || []).filter((s: any) => s.season_number > 0).map((s: any) => s.episode_count);
                addSeries(details.name || bestMatch.name, genres, seasons, posterFullUrl, details.original_name, details.id, year, imdbId, watchProviders);
              }
            }

            actionItems.push({
              tmdbData: bestMatch,
              action: cmd.action,
              type: type,
              status: cmd.action === 'add' ? 'added' : 'pending'
            });
          }
        }
      } catch (err) {
        console.error("JSON Çözümleme veya TMDB Hatası:", err);
      }
    }

    return { cleanText, actionItems };
  };

  const handleSend = async () => {
    if (!input.trim() || !GEMINI_API_KEY) return;

    const userMessage: AIMessage = { 
      id: Date.now().toString(), 
      sender: 'user', 
      text: input,
      timestamp: Date.now()
    };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const chatHistory = newMessages
        .filter(m => m.id !== 'welcome' && !m.text.includes('Hata detayı:'))
        .map(m => ({
          role: m.sender === 'ai' ? 'model' : 'user',
          parts: [{ text: m.text }]
        }));

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: getSystemPrompt() }] },
          contents: chatHistory,
          generationConfig: { temperature: 0.7 }
        })
      });

      if (!response.ok) {
         const errText = await response.text();
         let exactError = "Bilinmeyen API Hatası";
         try {
           const errJson = JSON.parse(errText);
           exactError = errJson.error?.message || errText;
         } catch { exactError = errText; }
         throw new Error(exactError);
      }

      const json = await response.json();
      const aiText = json.candidates[0].content.parts[0].text;

      const { cleanText, actionItems } = await processAIResponse(aiText);

      const aiMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: cleanText,
        timestamp: Date.now(),
        actionItems: actionItems.length > 0 ? actionItems : undefined
      };

      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);
      
      updateAIHistory(finalMessages.filter(m => m.id !== 'welcome'));
      
    } catch (error: any) {
      console.error("Gemini Çalışma Hatası:", error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        sender: 'ai', 
        text: `Hata detayı: ${error.message}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualAdd = async (item: TMDBActionItem, messageId: string) => {
    try {
        const type = item.type;
        const fullDetailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${item.tmdbData.id}?api_key=${TMDB_API_KEY}&language=tr-TR&append_to_response=watch/providers,external_ids`);
        const details = await fullDetailsRes.json();
        const posterFullUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
        const genres = details.genres ? details.genres.map((g: any) => g.name) : [];
        const watchProviders = processWatchProviders(details);
        const imdbId = details.external_ids?.imdb_id || details.imdb_id;
        
        if (type === 'movie') {
          const year = details.release_date ? details.release_date.substring(0, 4) : '';
          addMovie(details.title || item.tmdbData.title, year, genres, null, details.runtime || 0, posterFullUrl, details.original_title, details.id, imdbId, watchProviders);
        } else {
          const year = details.first_air_date ? details.first_air_date.substring(0, 4) : '';
          const seasons = (details.seasons || []).filter((s: any) => s.season_number > 0).map((s: any) => s.episode_count);
          addSeries(details.name || item.tmdbData.name, genres, seasons, posterFullUrl, details.original_name, details.id, year, imdbId, watchProviders);
        }

        setMessages(prev => prev.map(m => {
          if (m.id === messageId && m.actionItems) {
            return {
              ...m,
              actionItems: m.actionItems.map(a => a.tmdbData.id === item.tmdbData.id ? { ...a, status: 'added' } : a)
            };
          }
          return m;
        }));
        
        updateAIHistory(messages.filter(m => m.id !== 'welcome'));
        
    } catch (error) {
      console.error("Manuel ekleme hatası:", error);
    }
  };

  const handleClearHistory = () => {
    setMessages([{
      id: 'welcome',
      sender: 'ai',
      text: 'Sohbet geçmişi temizlendi. Sana nasıl yardımcı olabilirim?',
      timestamp: Date.now()
    }]);
    updateAIHistory([]);
  };

  const isWaveActive = isInputFocused || input.length > 0;

  return (
    <div className="h-[calc(100dvh-11rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:h-[calc(100dvh-5rem)] flex flex-col bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in relative">

      {/* ortam ışığı */}
      <div className="absolute inset-x-0 top-0 h-56 pointer-events-none z-0" style={{ background: 'radial-gradient(600px 240px at 85% -10%, var(--blob-1), transparent 65%)' }} />

      {/* Üst bar */}
      <div className="relative flex items-center justify-between p-4 md:p-5 border-b border-[var(--border-dim)] bg-[var(--bg-surface)] backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(140deg, var(--color-2), var(--color-3))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 8px 22px -8px var(--blob-1)' }}>
            <Bot className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black tracking-widest uppercase" style={{ background: 'linear-gradient(100deg, var(--text-main) 20%, var(--text-main) 60%, var(--color-2))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Sinevia AI</h1>
            <p className="text-[10px] md:text-xs font-bold tracking-[.18em] uppercase flex items-center gap-1" style={{ color: 'var(--color-2)' }}><Sparkles size={12} /> Kişisel Sinema Asistanın</p>
          </div>
        </div>
        
        {messages.length > 1 && (
          <button 
            onClick={handleClearHistory}
            className="text-[10px] md:text-xs font-extrabold tracking-[.12em] uppercase px-3 py-2.5 md:py-1.5 min-h-11 md:min-h-0 rounded-lg transition-colors whitespace-nowrap"
            style={{ color: 'var(--color-2)', background: 'var(--blob-1)', border: '1px solid var(--border-dim)' }}
          >
            Sohbeti Temizle
          </button>
        )}
        <div className="absolute left-0 right-0 -bottom-px h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, var(--color-1) 40%, var(--color-2) 65%, transparent)', opacity: .6 }} />
      </div>

      {/* Mesaj akışı */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 hide-scrollbar relative">
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} relative z-10`}>
            
            <div className={`max-w-[90%] md:max-w-[70%] flex gap-2 md:gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              
              <div className="flex-shrink-0 mt-1">
                {msg.sender === 'user' ? (
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-[var(--bg-card)] flex items-center justify-center" style={{ border: '1px solid var(--border-dim)' }}>
                    <User size={14} style={{ color: 'var(--color-2)' }} className="md:w-4 md:h-4" />
                  </div>
                ) : (
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(140deg, var(--color-2), var(--color-3))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 6px 18px -6px var(--blob-1)' }}>
                    <Bot size={14} className="text-white md:w-4 md:h-4" />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 md:gap-3">
                <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl text-xs md:text-sm leading-relaxed break-words ${
                  msg.sender === 'user' 
                    ? 'rounded-tr-none text-white' 
                    : 'rounded-tl-none'
                }`}
                  style={ msg.sender === 'user' 
                    ? { background: 'linear-gradient(150deg, var(--color-2) 0%, var(--color-1) 55%, var(--color-3) 130%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3), inset 0 -2px 6px rgba(0,0,0,.2), 0 10px 28px -12px var(--blob-1)' }
                    : { background: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderLeft: '2px solid var(--color-1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 14px 34px -18px rgba(0,0,0,.8)', backdropFilter: 'blur(10px)', color: 'var(--text-main)' }
                  }
                >
                  {msg.text}
                </div>

                <span className={`font-mono text-[9px] md:text-[10px] tracking-[.14em] uppercase ${msg.sender === 'user' ? 'text-right self-end' : 'self-start'}`} style={{ color: 'var(--color-2)', opacity: 0.75 }}>
                  {formatTime(msg.timestamp)}
                </span>

                {msg.actionItems && msg.actionItems.length > 0 && (
                  <div className="flex flex-wrap gap-2 md:gap-3 mt-1">
                    {msg.actionItems.map((item, idx) => {
                      const isAdded = item.status === 'added';
                      const title = item.tmdbData.title || item.tmdbData.name;
                      const date = item.tmdbData.release_date || item.tmdbData.first_air_date;
                      const poster = item.tmdbData.poster_path ? `https://image.tmdb.org/t/p/w200${item.tmdbData.poster_path}` : null;

                      return (
                        <div key={idx} className="w-32 md:w-40 bg-[var(--bg-card)] rounded-xl overflow-hidden shadow-lg group" style={{ border: '1px solid var(--border-dim)' }}>
                          <div className="relative h-44 md:h-56 bg-[var(--bg-surface)]">
                            {poster ? (
                              <img src={poster} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--color-3)' }}><Film size={28} className="md:w-8 md:h-8"/></div>
                            )}
                            <div className="absolute top-1.5 left-1.5 md:top-2 md:left-2 backdrop-blur-md px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[8px] md:text-[10px] font-bold text-white uppercase" style={{ background: 'linear-gradient(135deg, var(--color-2), var(--color-3))', boxShadow: '0 4px 12px -4px var(--blob-1)' }}>
                              {item.type === 'movie' ? 'Film' : 'Dizi'}
                            </div>
                          </div>
                          <div className="p-2 md:p-3 border-t border-[var(--border-dim)]">
                            <h4 className="text-[11px] md:text-xs font-bold truncate mb-0.5 md:mb-1" style={{ color: 'var(--text-main)' }} title={title}>{title}</h4>
                            <p className="text-[9px] md:text-[10px] mb-2 md:mb-3" style={{ color: 'var(--color-2)' }}>{date?.substring(0, 4)}</p>
                            
                            <button 
                              onClick={() => !isAdded && handleManualAdd(item, msg.id)}
                              disabled={isAdded}
                              className={`w-full py-1.5 md:py-2 min-h-11 md:min-h-0 rounded-lg text-[10px] md:text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                isAdded ? '' : 'hover:brightness-110'
                              }`}
                              style={ isAdded
                                ? { background: 'var(--blob-1)', color: 'var(--color-2)', border: '1px solid var(--border-dim)' }
                                : { background: 'linear-gradient(150deg, var(--color-2), var(--color-3))', color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 8px 20px -8px var(--blob-1)' }
                              }
                            >
                              {isAdded ? <><Check size={12} className="md:w-3.5 md:h-3.5"/> Ekli</> : <><Plus size={12} className="md:w-3.5 md:h-3.5"/> Ekle</>}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        ))}

        {isLoading && (
          <div className="flex w-full justify-start relative z-10">
            <div className="max-w-[90%] md:max-w-[70%] flex gap-2 md:gap-3 flex-row">
              <div className="flex-shrink-0 mt-1">
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center animate-pulse" style={{ background: 'linear-gradient(140deg, var(--color-2), var(--color-3))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35)' }}>
                  <Bot size={14} className="text-white md:w-4 md:h-4" />
                </div>
              </div>
              <div className="p-3 md:p-4 rounded-xl md:rounded-2xl rounded-tl-none flex items-center gap-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderLeft: '2px solid var(--color-1)', backdropFilter: 'blur(10px)' }}>
                <Loader2 size={14} style={{ color: 'var(--color-2)' }} className="animate-spin md:w-4 md:h-4" />
                <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--color-2)' }}>Düşünüyor...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Giriş alanı — uv-wave floating label */}
      <div className="p-3 md:p-5 border-t border-[var(--border-dim)] bg-[var(--bg-surface)] backdrop-blur-md z-10 relative">
        <div className="absolute left-0 right-0 -top-px h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, var(--color-1) 45%, transparent)' , opacity: .5 }} />
        {!GEMINI_API_KEY && (
          <div className="mb-3 p-2.5 md:p-3 rounded-xl flex items-start gap-2" style={{ background: 'var(--blob-1)', border: '1px solid var(--border-dim)' }}>
            <Info size={14} style={{ color: 'var(--color-2)' }} className="mt-0.5 flex-shrink-0 md:w-4 md:h-4" />
            <p className="text-[10px] md:text-xs" style={{ color: 'var(--text-main)' }}>
              API Anahtarı bulunamadı! Lütfen <code className="bg-black/30 px-1 rounded">.env</code> dosyanıza <code className="bg-black/30 px-1 rounded" style={{ color: 'var(--color-2)' }}>VITE_GEMINI_API_KEY=senin_anahtarin</code> şeklinde Google Gemini API anahtarınızı ekleyin.
            </p>
          </div>
        )}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-end gap-2 md:gap-3 relative"
        >
          <div className="relative flex-1">
            <input
              type="text"
              id="ai-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              disabled={isLoading || !GEMINI_API_KEY}
              placeholder=" "
              className="peer w-full bg-transparent border-0 border-b-2 px-1 pt-5 pb-2 text-xs md:text-sm text-[var(--text-main)] placeholder-transparent focus:outline-none disabled:opacity-50 transition-colors"
              style={{ borderBottomColor: isWaveActive ? 'var(--color-1)' : 'var(--border-dim)', boxShadow: isWaveActive ? '0 6px 18px -12px var(--color-1)' : 'none' }}
            />
            <label 
              htmlFor="ai-chat-input"
              className="pointer-events-none absolute left-1 font-bold tracking-[.14em] uppercase transition-all duration-200"
              style={ isWaveActive
                ? { top: '2px', fontSize: '9px', color: 'var(--color-2)' }
                : { top: '1.15rem', fontSize: '11px', color: 'var(--text-main)', opacity: 0.55 }
              }
            >
              Ne izlesem? Veya 'The Matrix'i ekle'...
            </label>
            {/* odak dalgası */}
            <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 pointer-events-none overflow-hidden">
              <span className={`block h-full mx-auto transition-all duration-300 ${isWaveActive ? 'w-full' : 'w-0'}`} style={{ background: 'linear-gradient(90deg, var(--color-1), var(--color-2))', boxShadow: '0 0 10px var(--blob-1)' }} />
            </span>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !GEMINI_API_KEY}
            aria-label="Gönder"
            className="group relative overflow-hidden w-12 h-12 md:w-14 md:h-14 text-white rounded-xl flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-lg disabled:opacity-40 disabled:hover:translate-y-0 flex-shrink-0"
            style={{ background: 'linear-gradient(150deg, var(--color-2) 0%, var(--color-1) 45%, var(--color-3) 130%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), inset 0 -2px 6px rgba(0,0,0,.25), 0 10px 28px -10px var(--blob-1)' }}
          >
            <span className="absolute top-0 -left-[80%] w-[55%] h-full pointer-events-none group-hover:left-[130%] transition-all duration-500" style={{ background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent)', transform: 'skewX(-20deg)' }} />
            {isLoading ? <Loader2 size={18} className="animate-spin md:w-5 md:h-5" /> : <Send size={18} className="ml-1 md:w-5 md:h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
