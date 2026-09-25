import { useState, useRef } from 'react';
import { Settings, Plus, Trash2, Tag, Boxes, Download, Upload, Edit2, Check, X, AlertTriangle, Wrench, SlidersHorizontal, Smartphone, PlayCircle, Palette, Sparkles, Moon, Sun, Award, Share2, FolderPlus } from 'lucide-react';
import { useApp, DEFAULT_REVIEW_TAGS } from '../context/AppContext';
import type { RatingCriterion } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import { uid } from '../lib/utils';
import { usePWAInstall } from '../hooks/usePWAInstall';

export default function SettingsPage() {
  const {
    data, addGenre, deleteGenre, renameGenre, addReviewTag, deleteReviewTag, renameReviewTag,
    addCollection, deleteCollection, renameCollection, exportData, importData, resetData,
    exportShareList, importShareList, toggleLockedNames, addCriterion, editCriterion,
    deleteCriterion, updateAltWatchTemplate, updateTheme,
  } = useApp();

  const { isInstallable, installPWA } = usePWAInstall();

  const [newGenre, setNewGenre] = useState('');
  const [newCollection, setNewCollection] = useState('');
  const [editingColl, setEditingColl] = useState<string | null>(null);
  const [editCollName, setEditCollName] = useState('');
  const [confirmDeleteColl, setConfirmDeleteColl] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const [editingGenre, setEditingGenre] = useState<string | null>(null);
  const [editGenreName, setEditGenreName] = useState('');
  const [deleteGenreTarget, setDeleteGenreTarget] = useState<string | null>(null);

  const [newReviewTag, setNewReviewTag] = useState('');
  const [editingReviewTag, setEditingReviewTag] = useState<string | null>(null);
  const [editReviewTagName, setEditReviewTagName] = useState('');
  const [deleteReviewTagTarget, setDeleteReviewTagTarget] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const shareFileRef = useRef<HTMLInputElement>(null);

  const [critName, setCritName] = useState('');
  const [critWeight, setCritWeight] = useState(5);
  const [critAppliesTo, setCritAppliesTo] = useState<'movie' | 'series' | 'both'>('both');
  const [critGenres, setCritGenres] = useState<string[]>([]);
  const [isAddingCrit, setIsAddingCrit] = useState(false);
  const [editingCritId, setEditingCritId] = useState<string | null>(null);
  const [deleteCritTarget, setDeleteCritTarget] = useState<string | null>(null);

  const [altTemplate, setAltTemplate] = useState(data.altWatchTemplate || '');
  const reviewTagsList = data.reviewTags && data.reviewTags.length > 0 ? data.reviewTags : DEFAULT_REVIEW_TAGS;

  const THEMES = [
    { id: 'default', name: 'Karanlık (Orijinal)', desc: 'Kehribar, Safir & Mor', icon: Moon, previewBg: '#0a0a0e', textMode: 'dark', colors: ['#f59e0b', '#0ea5e9', '#8b5cf6'] },
    { id: 'light', name: 'Aydınlık (Ferah)', desc: 'Amber, Mavi & Pembe', icon: Sun, previewBg: '#f8fafc', textMode: 'light', colors: ['#f59e0b', '#3b82f6', '#ec4899'] },
    { id: 'cyberpunk', name: 'Cyberpunk', desc: 'Neon Pembe, Mavi & Sarı', icon: Sparkles, previewBg: '#070312', textMode: 'dark', colors: ['#ec4899', '#06b6d4', '#eab308'] },
    { id: 'blood', name: 'Dracula', desc: 'Kızıl, Mor & Turuncu', icon: Moon, previewBg: '#0a0204', textMode: 'dark', colors: ['#e11d48', '#a855f7', '#f97316'] },
    { id: 'matrix', name: 'Matrix Terminal', desc: 'Zümrüt & Camgöbeği', icon: Sparkles, previewBg: '#020804', textMode: 'dark', colors: ['#10b981', '#84cc16', '#14b8a6'] },
    { id: 'ocean', name: 'Aurora', desc: 'Buz Mavisi & İndigo', icon: Sparkles, previewBg: '#020617', textMode: 'dark', colors: ['#38bdf8', '#6366f1', '#2dd4bf'] },
  ];

  const handleAddGenre = () => { if (!newGenre.trim()) return; addGenre(newGenre); setNewGenre(''); };
  const handleAddReviewTag = () => { if (!newReviewTag.trim()) return; addReviewTag(newReviewTag); setNewReviewTag(''); };
  const handleAddCollection = () => { if (!newCollection.trim()) return; addCollection(newCollection); setNewCollection(''); };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importData(reader.result as string);
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleShareFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importShareList(reader.result as string);
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveCriterion = () => {
    if (!critName.trim()) return;
    const payload: RatingCriterion = { id: editingCritId || uid(), name: critName.trim(), weight: critWeight, appliesTo: critAppliesTo, genres: critGenres };
    if (editingCritId) editCriterion(editingCritId, payload);
    else addCriterion(payload);
    resetCritForm();
  };

  const handleEditCrit = (c: RatingCriterion) => {
    setCritName(c.name); setCritWeight(c.weight); setCritAppliesTo(c.appliesTo);
    setCritGenres(c.genres || []); setEditingCritId(c.id); setIsAddingCrit(true);
  };

  const resetCritForm = () => {
    setCritName(''); setCritWeight(5); setCritAppliesTo('both');
    setCritGenres([]); setIsAddingCrit(false); setEditingCritId(null);
  };

  const toggleCritGenre = (g: string) => {
    setCritGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-ink-100 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
          <Settings size={22} className="text-gold-400" />
        </div>
        Ayarlar
      </h1>

      {/* GÖRSEL ATMOSFER & TEMA MOTORU */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-ink-100 flex items-center gap-2">
            <Palette size={18} className="text-gold-400" /> Görsel Atmosfer & Tema Motoru
          </h2>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-gold-500/20 text-gold-400 border border-gold-500/30 flex items-center gap-1">
            <Sparkles size={11} /> Tam Dönüşüm
          </span>
        </div>
        <p className="text-sm text-ink-400 mb-5">
          Seçtiğin tema arka planları, kartları, tüm buton renklerini ve ışık efektlerini anında dönüştürür. Aydınlık mod seçeneği de mevcuttur.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {THEMES.map((theme) => {
            const isSelected = (data.theme || 'default') === theme.id;
            const ThemeIcon = theme.icon;
            return (
              <button
                key={theme.id}
                onClick={() => updateTheme(theme.id)}
                className={`relative flex flex-col justify-between p-4 rounded-2xl border text-left transition-all duration-300 overflow-hidden group ${
                  isSelected ? 'border-gold-500 ring-2 ring-gold-500/30 scale-[1.03] shadow-2xl' : 'border-ink-700/60 hover:border-ink-500 hover:scale-[1.01]'
                }`}
                style={{ backgroundColor: theme.previewBg }}
              >
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity" style={{ backgroundColor: theme.colors[0] }} />
                <div className="absolute top-1/2 -left-8 w-20 h-20 rounded-full blur-2xl opacity-30 group-hover:opacity-60 transition-opacity" style={{ backgroundColor: theme.colors[1] }} />
                <div className="absolute -bottom-8 right-10 w-24 h-24 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity" style={{ backgroundColor: theme.colors[2] }} />

                <div className="relative z-10 flex items-center justify-between w-full mb-6">
                  <div className="flex items-center -space-x-2">
                    {theme.colors.map((color, i) => (
                      <span key={i} className="w-6 h-6 rounded-full border-2 border-black/40 shadow-sm" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <ThemeIcon size={18} color={theme.colors[0]} className="opacity-80" />
                </div>

                <div className="relative z-10">
                  <div className={`font-black text-sm tracking-wide ${theme.textMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{theme.name}</div>
                  <div className={`text-[11px] font-medium mt-1 ${theme.textMode === 'light' ? 'text-slate-600' : 'text-zinc-400'}`}>{theme.desc}</div>
                </div>

                {isSelected && <div className="absolute inset-0 border-2 border-gold-500 rounded-2xl pointer-events-none" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* İZLEME KAYNAĞI ŞABLONU */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-ink-100 mb-1 flex items-center gap-2">
          <PlayCircle size={18} className="text-azure-400" /> Alternatif İzleme Kaynağı
        </h2>
        <div className="text-sm text-ink-400 mb-4 space-y-1.5">
          <p>Uygulama içinde filmleri yerli/yabancı alternatif sunuculardan izlemek istiyorsan bir şablon belirle. Film kartlarında sabit bir Google'da Ara butonu zaten mevcuttur.</p>
          <div className="text-xs p-3 bg-ink-950 rounded-lg border border-ink-800 space-y-2">
            <div>
              <span className="font-bold text-ink-300 block mb-1">Parametreler:</span>
              <span className="text-gold-400 font-mono">{'{imdb}'}</span> : IMDB Kodu (Örn: tt1375666) |
              <span className="text-gold-400 font-mono ml-2">{'{title}'}</span> : Film Adı |
              <span className="text-gold-400 font-mono ml-2">{'{year}'}</span> : Çıkış Yılı
            </div>
            <div className="pt-2 border-t border-ink-800">
              <span className="text-emerald-400 font-bold block mb-1 flex items-center gap-1.5">🔥 KESİN ÇÖZÜM (Otomatik İlk Sonuca Gitme)</span>
              <p className="text-ink-400 mb-1">Sitelerin linkleri sürekli değiştiği için doğrudan sitenin içine yönlendirme yapar. (hdfilmcehennemi.nl kısmını istediğin siteyle değiştir)</p>
              <code className="text-azure-300 bg-ink-900 px-2 py-1 rounded block select-all border border-ink-800">
                https://duckduckgo.com/?q=\site:hdfilmcehennemi.nl+{'{title}'}+{'{year}'}
              </code>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={altTemplate}
            onChange={(e) => setAltTemplate(e.target.value)}
            placeholder="Örn: https://duckduckgo.com/?q=\site:hdfilmcehennemi.nl+{title}+{year}"
            className="flex-1 bg-ink-800/80 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 transition-all text-sm font-mono"
          />
          <button onClick={() => updateAltWatchTemplate(altTemplate)} className="flex items-center gap-1.5 bg-gold-500 hover:bg-gold-600 text-white px-4 py-2.5 rounded-lg font-bold transition-all">
            <Check size={18} /> Kaydet
          </button>
        </div>
      </div>

      {/* PUANLAMA KRİTERLERİ */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-100 mb-1 flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-gold-400" /> Puanlama Kriterleri
            </h2>
            <p className="text-sm text-ink-400">Detaylı puanlama sisteminde kullanılacak alt kırılımları ve etki ağırlıklarını (1-10) belirle.</p>
          </div>
          <button
            onClick={() => (isAddingCrit ? resetCritForm() : setIsAddingCrit(true))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
              isAddingCrit ? 'bg-ink-800 text-ink-300 border border-ink-700' : 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
            }`}
          >
            {isAddingCrit ? <X size={16} /> : <Plus size={16} />}
            {isAddingCrit ? 'İptal' : 'Yeni Kriter'}
          </button>
        </div>

        {isAddingCrit && (
          <div className="mb-6 bg-ink-950/50 border border-ink-800 rounded-xl p-4 space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-400 mb-1.5 uppercase tracking-wider">Kriter Adı</label>
                <input
                  type="text"
                  value={critName}
                  onChange={(e) => setCritName(e.target.value)}
                  placeholder="Örn: Senaryo, Müzik, Atmosfer..."
                  className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-400 mb-1.5 uppercase tracking-wider flex justify-between">
                  <span>Etki Ağırlığı</span>
                  <span className="text-gold-400">{critWeight} / 10</span>
                </label>
                <input type="range" min="1" max="10" value={critWeight} onChange={(e) => setCritWeight(Number(e.target.value))} className="w-full mt-2 accent-gold-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-400 mb-1.5 uppercase tracking-wider">Geçerli Olduğu Tip</label>
                <div className="flex bg-ink-900 rounded-lg p-1 border border-ink-800">
                  <button onClick={() => setCritAppliesTo('both')} className={`flex-1 text-xs py-1.5 rounded-md font-bold transition-all ${critAppliesTo === 'both' ? 'bg-ink-700 text-white' : 'text-ink-500 hover:text-ink-300'}`}>Tümü</button>
                  <button onClick={() => setCritAppliesTo('movie')} className={`flex-1 text-xs py-1.5 rounded-md font-bold transition-all ${critAppliesTo === 'movie' ? 'bg-ink-700 text-white' : 'text-ink-500 hover:text-ink-300'}`}>Sadece Film</button>
                  <button onClick={() => setCritAppliesTo('series')} className={`flex-1 text-xs py-1.5 rounded-md font-bold transition-all ${critAppliesTo === 'series' ? 'bg-ink-700 text-white' : 'text-ink-500 hover:text-ink-300'}`}>Sadece Dizi</button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-400 mb-1.5 uppercase tracking-wider">
                Özel Tür Filtresi <span className="text-[10px] text-ink-500 font-normal lowercase">(Boş bırakırsan her türde çıkar)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {data.genres.map((g) => (
                  <button
                    key={g}
                    onClick={() => toggleCritGenre(g)}
                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                      critGenres.includes(g) ? 'bg-gold-500/20 text-gold-300 border-gold-500/40' : 'bg-ink-900 text-ink-500 border-ink-800 hover:border-ink-600'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleSaveCriterion} disabled={!critName.trim()} className="w-full bg-gold-500 hover:bg-gold-600 text-white py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50">
              {editingCritId ? 'Kriteri Güncelle' : 'Kriteri Kaydet'}
            </button>
          </div>
        )}

        {!data.criteria || data.criteria.length === 0 ? (
          <p className="text-sm text-ink-500">Henüz hiçbir kriter eklenmedi.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.criteria.map((c) => (
              <div key={c.id} className={`border rounded-xl p-3 flex flex-col gap-2 transition-all ${editingCritId === c.id ? 'bg-gold-500/10 border-gold-500/50 shadow-md' : 'bg-ink-800/50 border-ink-700/50'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{c.name}</h4>
                    <div className="text-[10px] text-ink-400 mt-0.5 flex gap-2">
                      <span className="bg-ink-900 px-1.5 py-0.5 rounded border border-ink-800 text-gold-400 font-bold">Ağırlık: {c.weight}</span>
                      <span className="bg-ink-900 px-1.5 py-0.5 rounded border border-ink-800">{c.appliesTo === 'both' ? 'Film + Dizi' : c.appliesTo === 'movie' ? 'Sadece Film' : 'Sadece Dizi'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEditCrit(c)} className="p-1.5 text-ink-400 hover:text-gold-400 bg-ink-900 rounded-md transition-all"><Edit2 size={13} /></button>
                    <button onClick={() => setDeleteCritTarget(c.id)} className="p-1.5 text-ink-400 hover:text-red-400 bg-ink-900 rounded-md transition-all"><Trash2 size={14} /></button>
                  </div>
                </div>
                {c.genres.length > 0 && <div className="text-[9px] text-ink-400 truncate mt-1">Sadece: {c.genres.join(', ')}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteCritTarget && (
        <ConfirmDialog
          title="Kriteri Sil"
          message="Bu kriteri silmek istediğine emin misin? Önceki yapıtlara verdiğin detaylı puanlar geçmişte kalır ancak yeni puanlamalarda bu kriteri kullanamazsın."
          onConfirm={() => { deleteCriterion(deleteCritTarget); setDeleteCritTarget(null); }}
          onCancel={() => setDeleteCritTarget(null)}
        />
      )}

      {/* DEĞERLENDİRME BAŞLIKLARI YÖNETİMİ */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-ink-100 mb-1 flex items-center gap-2">
          <Award size={18} className="text-gold-400" /> Değerlendirme Başlıkları Yönetimi
        </h2>
        <p className="text-sm text-ink-400 mb-4">Film ve dizi puanlarken seçebileceğin hızlı değerlendirme rozetlerini (örn. 🔥 Başyapıt, 🎭 Oyunculuk Muazzam) ekle, düzenle veya sil.</p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newReviewTag}
            onChange={(e) => setNewReviewTag(e.target.value)}
            placeholder="Yeni başlık (örn. 🧠 Beyin Yakan Kurgu)..."
            className="flex-1 bg-ink-800/80 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && handleAddReviewTag()}
          />
          <button onClick={handleAddReviewTag} disabled={!newReviewTag.trim()} className="flex items-center gap-1.5 bg-gold-500 hover:bg-gold-600 text-white px-4 py-2.5 rounded-lg font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus size={18} /> Ekle
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {reviewTagsList.map((tag) => (
            <div key={tag} className="flex items-center gap-1.5 bg-ink-800 border border-ink-700 rounded-xl pl-3 pr-2 py-1.5 hover:border-gold-500/50 transition-colors">
              {editingReviewTag === tag ? (
                <>
                  <input
                    type="text"
                    value={editReviewTagName}
                    onChange={(e) => setEditReviewTagName(e.target.value)}
                    className="bg-ink-950 border border-gold-500 rounded px-2 py-0.5 text-sm text-ink-100 focus:outline-none w-40"
                    onKeyDown={(e) => { if (e.key === 'Enter' && editReviewTagName.trim()) { renameReviewTag(tag, editReviewTagName); setEditingReviewTag(null); } }}
                  />
                  <button onClick={() => { if (editReviewTagName.trim()) { renameReviewTag(tag, editReviewTagName); setEditingReviewTag(null); } }} className="text-green-400 hover:text-green-300 transition-colors p-0.5" title="Kaydet"><Check size={14} /></button>
                  <button onClick={() => setEditingReviewTag(null)} className="text-ink-400 hover:text-ink-200 transition-colors p-0.5" title="İptal"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-ink-100">{tag}</span>
                  <button onClick={() => { setEditingReviewTag(tag); setEditReviewTagName(tag); }} className="text-ink-400 hover:text-gold-400 transition-colors p-0.5" title="Başlığı Düzenle"><Edit2 size={13} /></button>
                  <button onClick={() => setDeleteReviewTagTarget(tag)} className="text-ink-400 hover:text-red-400 transition-colors p-0.5" title="Başlığı Sil"><X size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {deleteReviewTagTarget && (
        <ConfirmDialog
          title="Değerlendirme Başlığını Sil"
          message={`"${deleteReviewTagTarget}" başlığı seçim listesinden kaldırılacak. Emin misin?`}
          onConfirm={() => { deleteReviewTag(deleteReviewTagTarget); setDeleteReviewTagTarget(null); }}
          onCancel={() => setDeleteReviewTagTarget(null)}
        />
      )}

      {/* TÜR YÖNETİMİ */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-ink-100 mb-1 flex items-center gap-2">
          <Tag size={18} className="text-gold-400" /> Tür Yönetimi
        </h2>
        <p className="text-sm text-ink-400 mb-4">Film ve dizi eklerken seçilecek türleri ekle veya sil.</p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newGenre}
            onChange={(e) => setNewGenre(e.target.value)}
            placeholder="Yeni tür adı..."
            className="flex-1 bg-ink-800/80 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && handleAddGenre()}
          />
          <button onClick={handleAddGenre} disabled={!newGenre.trim()} className="flex items-center gap-1.5 bg-gold-500 hover:bg-gold-600 text-white px-4 py-2.5 rounded-lg font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus size={18} /> Ekle
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.genres.map((g) => (
            <div key={g} className="flex items-center gap-1.5 bg-ink-800 border border-ink-700 rounded-full pl-3 pr-1.5 py-1.5 hover:border-gold-500/50 transition-colors">
              {editingGenre === g ? (
                <>
                  <input
                    type="text"
                    value={editGenreName}
                    onChange={(e) => setEditGenreName(e.target.value)}
                    className="bg-ink-950 border border-gold-500 rounded px-1.5 py-0.5 text-sm text-ink-100 focus:outline-none w-24"
                    onKeyDown={(e) => { if (e.key === 'Enter' && editGenreName.trim()) { renameGenre(g, editGenreName); setEditingGenre(null); } }}
                  />
                  <button onClick={() => { if (editGenreName.trim()) { renameGenre(g, editGenreName); setEditingGenre(null); } }} className="text-green-400 hover:text-green-300 transition-colors"><Check size={14} /></button>
                  <button onClick={() => setEditingGenre(null)} className="text-ink-400 hover:text-ink-200 transition-colors"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="text-sm text-ink-200">{g}</span>
                  <button onClick={() => { setEditingGenre(g); setEditGenreName(g); }} className="text-ink-400 hover:text-gold-400 transition-colors"><Edit2 size={13} /></button>
                  <button onClick={() => setDeleteGenreTarget(g)} className="text-ink-400 hover:text-red-400 transition-colors"><X size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* KOLEKSİYON YÖNETİMİ */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-ink-100 mb-1 flex items-center gap-2">
          <Boxes size={18} className="text-azure-400" /> Koleksiyon Yönetimi
        </h2>
        <p className="text-sm text-ink-400 mb-4">Koleksiyonların (evren/seri) adını düzenle veya sil.</p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newCollection}
            onChange={(e) => setNewCollection(e.target.value)}
            placeholder="Yeni koleksiyon adı..."
            className="flex-1 bg-ink-800/80 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-azure-500/50 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && handleAddCollection()}
          />
          <button onClick={handleAddCollection} disabled={!newCollection.trim()} className="flex items-center gap-1.5 bg-azure-500 hover:bg-azure-600 text-white px-4 py-2.5 rounded-lg font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus size={18} /> Ekle
          </button>
        </div>

        {data.collections.length === 0 ? (
          <p className="text-sm text-ink-500">Henüz koleksiyon yok.</p>
        ) : (
          <div className="space-y-2">
            {data.collections.map((c) => {
              const movieCount = data.movies.filter((m) => m.collectionId === c.id).length;
              return (
                <div key={c.id} className="flex items-center gap-2 bg-ink-800/80 border border-ink-700 rounded-lg px-3 py-2.5 hover:border-azure-500/50 transition-colors">
                  {editingColl === c.id ? (
                    <>
                      <input
                        type="text"
                        value={editCollName}
                        onChange={(e) => setEditCollName(e.target.value)}
                        className="flex-1 bg-ink-950 border border-ink-600 rounded px-2 py-1 text-ink-100 focus:outline-none"
                        onKeyDown={(e) => { if (e.key === 'Enter') { renameCollection(c.id, editCollName); setEditingColl(null); } }}
                      />
                      <button onClick={() => { renameCollection(c.id, editCollName); setEditingColl(null); }} className="text-green-400 hover:text-green-300 transition-colors"><Check size={18} /></button>
                      <button onClick={() => setEditingColl(null)} className="text-ink-400 hover:text-ink-200 transition-colors"><X size={18} /></button>
                    </>
                  ) : (
                    <>
                      <Boxes size={16} className="text-azure-400" />
                      <span className="flex-1 text-sm text-ink-200">{c.name}</span>
                      <span className="text-xs text-ink-400">{movieCount} film</span>
                      <button onClick={() => { setEditingColl(c.id); setEditCollName(c.name); }} className="text-ink-400 hover:text-ink-200 transition-colors"><Edit2 size={16} /></button>
                      <button
                        onClick={() => {
                          if (confirmDeleteColl === c.id) { deleteCollection(c.id); setConfirmDeleteColl(null); }
                          else { setConfirmDeleteColl(c.id); setTimeout(() => setConfirmDeleteColl(null), 2000); }
                        }}
                        className="text-ink-400 hover:text-red-400 transition-colors"
                      >
                        {confirmDeleteColl === c.id ? <span className="text-xs text-red-400">Emin misin?</span> : <Trash2 size={16} />}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isInstallable && (
        <div className="bg-ink-900/80 border border-azure-500/30 rounded-2xl p-5 shadow-xl flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Smartphone size={20} className="text-azure-400" /> Sinevia'yı Cihazına Yükle
            </h2>
            <p className="text-sm text-ink-400 mt-0.5">Tarayıcı çubuğu olmadan tam ekran ve internet olmadan da kullanmak için uygulamayı ana ekranına ekle.</p>
          </div>
          <button onClick={installPWA} className="bg-gradient-to-r from-azure-500 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all text-sm">
            Uygulamayı İndir
          </button>
        </div>
      )}

      {/* YENİ: ARKADAŞLA LİSTE PAYLAŞ / EKSİKLERİ EKLE */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-azure-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h2 className="text-lg font-semibold text-ink-100 flex items-center gap-2">
            <Share2 size={18} className="text-azure-400" /> Arkadaşla Liste Paylaş / Eksikleri Ekle
          </h2>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-azure-500/20 text-azure-300 border border-azure-500/30">
            Geçmiş & Başarımlar Korunur
          </span>
        </div>
        <p className="text-sm text-ink-400 mb-4">
          Kendi puanların, geçmişin ve başarımların silinmeden arkadaşına film/dizi listeni gönderebilir veya onun listesindeki sende olmayan yapımları tek tıkla kütüphanene ekleyebilirsin. Eklenen yapımlar başarım kazandırır!
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportShareList}
            className="flex items-center gap-2 bg-azure-600 hover:bg-azure-500 text-white px-4 py-2.5 rounded-lg font-bold transition-all shadow-md shadow-azure-500/10"
          >
            <Share2 size={18} /> Paylaşım Listesi İndir
          </button>
          <button
            onClick={() => shareFileRef.current?.click()}
            className="flex items-center gap-2 bg-ink-800 hover:bg-ink-700 text-azure-300 border border-azure-500/40 px-4 py-2.5 rounded-lg font-bold transition-all"
          >
            <FolderPlus size={18} /> Arkadaş Listesi Yükle (Eksikleri Ekle)
          </button>
          <input
            ref={shareFileRef}
            type="file"
            accept="application/json"
            onChange={handleShareFileImport}
            className="hidden"
          />
        </div>
      </div>

      {/* YEDEKLE / GERİ YÜKLE */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-ink-100 mb-1 flex items-center gap-2">
          <Download size={18} className="text-emerald-400" /> Tam Yedekle / Geri Yükle
        </h2>
        <p className="text-sm text-ink-400 mb-4">
          Tüm kişisel verilerini (geçmiş, puanlar ve başarımlar dahil) JSON dosyası olarak dışa veya içe aktar.
        </p>

        <div className="flex flex-wrap gap-3">
          <button onClick={exportData} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg font-bold transition-all">
            <Download size={18} /> Yedek Al
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 bg-ink-800 hover:bg-ink-700 text-ink-200 border border-ink-700 px-4 py-2.5 rounded-lg font-bold transition-all">
            <Upload size={18} /> Geri Yükle
          </button>
          <input ref={fileRef} type="file" accept="application/json" onChange={handleFileImport} className="hidden" />
        </div>
      </div>

      {deleteGenreTarget && (
        <ConfirmDialog
          title="Türü Sil"
          message={`"${deleteGenreTarget}" türü silinecek. Bu türü kullanan film ve dizilerde bu tür etiketi kaldırılacak. Emin misin?`}
          onConfirm={() => { deleteGenre(deleteGenreTarget); setDeleteGenreTarget(null); }}
          onCancel={() => setDeleteGenreTarget(null)}
        />
      )}

      {/* GELİŞTİRİCİ / TEST AYARLARI */}
      <div className="bg-ink-900/60 border border-gold-500/30 rounded-2xl p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-gold-400 mb-1 flex items-center gap-2">
          <Wrench size={18} /> Geliştirici / Test Ayarları
        </h2>
        <p className="text-sm text-ink-400 mb-4">Henüz kazanılmamış (kilitli) başarımların isimlerini "???" yerine açıkça gösterir.</p>
        <button
          onClick={toggleLockedNames}
          className={`px-5 py-2.5 rounded-lg font-bold transition-all ${
            data.showLockedNames ? 'bg-gold-500 text-white shadow-lg' : 'bg-ink-800 text-ink-300 hover:bg-ink-700 border border-ink-700'
          }`}
        >
          {data.showLockedNames ? 'Görünürlüğü Kapat (Normal Mod)' : 'Kilitli İsimleri Göster (Test Modu)'}
        </button>
      </div>

      {/* VERİLERİ SIFIRLA */}
      <div className="bg-red-950/20 border border-red-800/40 rounded-2xl p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-red-400 mb-1 flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-400" /> Verileri Sıfırla
        </h2>
        <p className="text-sm text-red-400/60 mb-4">Tüm filmler, diziler, geçmiş, başarım ve seviye verileri kalıcı olarak silinir. Bu işlem geri alınamaz.</p>

        {confirmReset ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-red-400 font-medium">Emin misin? Bu işlem geri alınamaz!</span>
            <button onClick={() => { resetData(); setConfirmReset(false); }} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-lg font-bold transition-all">
              <Trash2 size={18} /> Evet, Sıfırla
            </button>
            <button onClick={() => setConfirmReset(false)} className="flex items-center gap-1.5 bg-ink-800 hover:bg-ink-700 text-ink-200 px-4 py-2.5 rounded-lg font-bold transition-all">
              <X size={18} /> İptal
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} className="flex items-center gap-2 bg-red-600/80 hover:bg-red-500 text-white px-4 py-2.5 rounded-lg font-bold transition-all">
            <Trash2 size={18} /> Tüm Verileri Sıfırla
          </button>
        )}
      </div>
    </div>
  );
}