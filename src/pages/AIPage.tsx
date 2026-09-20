import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Plus, Check, Film, Tv, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''; 
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  actionItems?: TMDBActionItem[]; 
}

interface TMDBActionItem {
  tmdbData: any;
  action: 'recommend' | 'add';
  type: 'movie' | 'tv';
  status: 'pending' | 'added';
}

export default function AIPage() {
  const { data, addMovie, addSeries } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Merhaba! Ben Sinevia AI. Ne izlemek istediğine karar veremedin mi? Veya "Bana Christopher Nolan\'ın tüm filmlerini ekle" mi demek istersin? Sana yardım etmek için buradayım.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
- Kütüphanesinde ${movieCount} film ve${seriesCount} dizi var.
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
              const fullDetailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${bestMatch.id}?api_key=${TMDB_API_KEY}&language=tr-TR`);
              const details = await fullDetailsRes.json();
              const posterFullUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
              const genres = details.genres ? details.genres.map((g: any) => g.name) : [];
              
              if (type === 'movie') {
                const year = details.release_date ? details.release_date.substring(0, 4) : '';
                addMovie(details.title || bestMatch.title, year, genres, null, details.runtime || 0, posterFullUrl, details.original_title, details.id);
              } else {
                const year = details.first_air_date ? details.first_air_date.substring(0, 4) : '';
                const seasons = (details.seasons || []).filter((s: any) => s.season_number > 0).map((s: any) => s.episode_count);
                addSeries(details.name || bestMatch.name, genres, seasons, posterFullUrl, details.original_name, details.id, year);
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

    const userMessage: Message = { id: Date.now().toString(), sender: 'user', text: input };
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

      // DÜZELTME BURADA: Google'ın hata mesajında bizden istediği gemini-3.6-flash modeline geçirildi
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
         } catch(e) { exactError = errText; }
         throw new Error(exactError);
      }

      const json = await response.json();
      const aiText = json.candidates[0].content.parts[0].text;

      const { cleanText, actionItems } = await processAIResponse(aiText);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: cleanText,
        actionItems: actionItems.length > 0 ? actionItems : undefined
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      console.error("Gemini Çalışma Hatası:", error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        sender: 'ai', 
        text: `Hata detayı: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualAdd = async (item: TMDBActionItem, messageId: string) => {
    try {
        const type = item.type;
        const fullDetailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${item.tmdbData.id}?api_key=${TMDB_API_KEY}&language=tr-TR`);
        const details = await fullDetailsRes.json();
        const posterFullUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
        const genres = details.genres ? details.genres.map((g: any) => g.name) : [];
        
        if (type === 'movie') {
          const year = details.release_date ? details.release_date.substring(0, 4) : '';
          addMovie(details.title || item.tmdbData.title, year, genres, null, details.runtime || 0, posterFullUrl, details.original_title, details.id);
        } else {
          const year = details.first_air_date ? details.first_air_date.substring(0, 4) : '';
          const seasons = (details.seasons || []).filter((s: any) => s.season_number > 0).map((s: any) => s.episode_count);
          addSeries(details.name || item.tmdbData.name, genres, seasons, posterFullUrl, details.original_name, details.id, year);
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
    } catch (error) {
      console.error("Manuel ekleme hatası:", error);
    }
  };

  return (
    <div className="h-[calc(100vh-10rem)] md:h-[calc(100vh-5rem)] flex flex-col bg-ink-950 border border-ink-800/50 rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in relative">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 p-5 border-b border-ink-800/50 bg-ink-900/80 backdrop-blur-md z-10">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-azure-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-azure-500/20">
          <Bot className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-lg font-black text-white tracking-widest uppercase">Sinevia AI</h1>
          <p className="text-xs text-ink-400 font-medium flex items-center gap-1"><Sparkles size={12} className="text-azure-400" /> Kişisel Sinema Asistanın</p>
        </div>
      </div>

      {/* SOHBET ALANI */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 hide-scrollbar relative">
        <div className="absolute inset-0 bg-gradient-to-b from-azure-500/5 to-transparent pointer-events-none" />
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} relative z-10`}>
            
            <div className={`max-w-[85%] md:max-w-[70%] flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              
              {/* AVATAR */}
              <div className="flex-shrink-0 mt-1">
                {msg.sender === 'user' ? (
                  <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center border border-ink-700">
                    <User size={16} className="text-ink-400" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-azure-500 to-indigo-500 flex items-center justify-center shadow-md">
                    <Bot size={16} className="text-white" />
                  </div>
                )}
              </div>

              {/* MESAJ İÇERİĞİ */}
              <div className="flex flex-col gap-3">
                <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-md ${
                  msg.sender === 'user' 
                    ? 'bg-ink-800 text-white rounded-tr-none border border-ink-700/50' 
                    : 'bg-ink-900/80 text-ink-200 rounded-tl-none border border-ink-800/50 backdrop-blur-sm'
                }`}>
                  {msg.text}
                </div>

                {/* EĞER AJAN FİLM/DİZİ BULDUYSA KARTLARI ÇİZ */}
                {msg.actionItems && msg.actionItems.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-1">
                    {msg.actionItems.map((item, idx) => {
                      const isAdded = item.status === 'added';
                      const title = item.tmdbData.title || item.tmdbData.name;
                      const date = item.tmdbData.release_date || item.tmdbData.first_air_date;
                      const poster = item.tmdbData.poster_path ? `https://image.tmdb.org/t/p/w200${item.tmdbData.poster_path}` : null;

                      return (
                        <div key={idx} className="w-40 bg-ink-950 border border-ink-800 rounded-xl overflow-hidden shadow-lg group">
                          <div className="relative h-56 bg-ink-900">
                            {poster ? (
                              <img src={poster} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-ink-700"><Film size={32}/></div>
                            )}
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white border border-white/10 uppercase">
                              {item.type === 'movie' ? 'Film' : 'Dizi'}
                            </div>
                          </div>
                          <div className="p-3 bg-ink-900 border-t border-ink-800">
                            <h4 className="text-xs font-bold text-white truncate mb-1" title={title}>{title}</h4>
                            <p className="text-[10px] text-gold-400 mb-3">{date?.substring(0, 4)}</p>
                            
                            <button 
                              onClick={() => !isAdded && handleManualAdd(item, msg.id)}
                              disabled={isAdded}
                              className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                isAdded 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                  : 'bg-gold-500 hover:bg-gold-400 text-ink-950 shadow-md shadow-gold-500/20'
                              }`}
                            >
                              {isAdded ? <><Check size={14} /> Ekli</> : <><Plus size={14} /> Ekle</>}
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
            <div className="max-w-[70%] flex gap-3 flex-row">
              <div className="flex-shrink-0 mt-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-azure-500 to-indigo-500 flex items-center justify-center shadow-md animate-pulse">
                  <Bot size={16} className="text-white" />
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-ink-900/80 rounded-tl-none border border-ink-800/50 flex items-center gap-2">
                <Loader2 size={16} className="text-azure-400 animate-spin" />
                <span className="text-sm font-medium text-ink-400">Düşünüyor...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* GİRDİ ALANI */}
      <div className="p-4 border-t border-ink-800/50 bg-ink-900/50 backdrop-blur-md z-10">
        {!GEMINI_API_KEY && (
          <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
            <Info size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-300">
              API Anahtarı bulunamadı! Lütfen <code className="bg-black/30 px-1 rounded">.env</code> dosyanıza <code className="bg-black/30 px-1 rounded text-white">VITE_GEMINI_API_KEY=senin_anahtarin</code> şeklinde Google Gemini API anahtarınızı ekleyin.
            </p>
          </div>
        )}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-3 relative"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || !GEMINI_API_KEY}
            placeholder="Ne izlesem? Veya 'Interstellar'ı kütüphaneme ekle'..."
            className="flex-1 bg-ink-950 border border-ink-800 rounded-xl px-5 py-4 text-sm text-white placeholder-ink-500 focus:outline-none focus:border-azure-500/50 focus:ring-1 focus:ring-azure-500/30 transition-all shadow-inner disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !GEMINI_API_KEY}
            className="w-14 h-14 bg-gradient-to-br from-azure-600 to-indigo-600 text-white rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-azure-500/20 disabled:opacity-50 disabled:hover:scale-100 flex-shrink-0"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-1" />}
          </button>
        </form>
      </div>
    </div>
  );
}