import { useState, useRef } from 'react';
import { Settings, Plus, Trash2, Tag, Boxes, Download, Upload, Edit2, Check, X, AlertTriangle, Wrench, SlidersHorizontal, Smartphone, PlayCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { RatingCriterion } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import { uid } from '../lib/utils';
import { usePWAInstall } from '../hooks/usePWAInstall';

export default function SettingsPage() {
  const { data, addGenre, deleteGenre, renameGenre, addCollection, deleteCollection, renameCollection, exportData, importData, resetData, toggleLockedNames, addCriterion, editCriterion, deleteCriterion, updateAltWatchTemplate } = useApp();
  
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
  const fileRef = useRef<HTMLInputElement>(null);

  const [critName, setCritName] = useState('');
  const [critWeight, setCritWeight] = useState(5);
  const [critAppliesTo, setCritAppliesTo] = useState<'movie' | 'series' | 'both'>('both');
  const [critGenres, setCritGenres] = useState<string[]>([]);
  const [isAddingCrit, setIsAddingCrit] = useState(false);
  const [editingCritId, setEditingCritId] = useState<string | null>(null);
  const [deleteCritTarget, setDeleteCritTarget] = useState<string | null>(null);

  const [altTemplate, setAltTemplate] = useState(data.altWatchTemplate || '');

  const handleAddGenre = () => {
    if (!newGenre.trim()) return;
    addGenre(newGenre);
    setNewGenre('');
  };

  const handleAddCollection = () => {
    if (!newCollection.trim()) return;
    addCollection(newCollection);
    setNewCollection('');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      importData(reader.result as string);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveCriterion = () => {
    if (!critName.trim()) return;
    
    const payload: RatingCriterion = {
      id: editingCritId || uid(),
      name: critName.trim(),
      weight: critWeight,
      appliesTo: critAppliesTo,
      genres: critGenres
    };

    if (editingCritId) {
      editCriterion(editingCritId, payload);
    } else {
      addCriterion(payload);
    }

    resetCritForm();
  };

  const handleEditCrit = (c: RatingCriterion) => {
    setCritName(c.name);
    setCritWeight(c.weight);
    setCritAppliesTo(c.appliesTo);
    setCritGenres(c.genres || []);
    setEditingCritId(c.id);
    setIsAddingCrit(true);
  };

  const resetCritForm = () => {
    setCritName('');
    setCritWeight(5);
    setCritAppliesTo('both');
    setCritGenres([]);
    setIsAddingCrit(false);
    setEditingCritId(null);
  };

  const toggleCritGenre = (g: string) => {
    setCritGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-ink-100 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-700/20 border border-violet-500/30 flex items-center justify-center">
          <Settings size={22} className="text-violet-300" />
        </div>
        Ayarlar
      </h1>

      {/* İZLEME KAYNAĞI ŞABLONU */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
        <h2 className="text-lg font-semibold text-ink-100 mb-1 flex items-center gap-2">
          <PlayCircle size={18} className="text-azure-400" />
          Alternatif İzleme Kaynağı
        </h2>
        <div className="text-sm text-ink-500 mb-4 space-y-1.5">
          <p>Uygulama içinde filmleri yerli/yabancı alternatif sunuculardan izlemek istiyorsan bir şablon belirle.</p>
          <div className="text-xs p-3 bg-ink-950 rounded-lg border border-ink-800 space-y-2">
            <div>
              <span className="font-bold text-ink-300 block mb-1">Parametreler:</span>
              <span className="text-gold-400 font-mono">{"{imdb}"}</span> : IMDB Kodu (Örn: tt1375666) | 
              <span className="text-gold-400 font-mono ml-2">{"{title}"}</span> : Film Adı | 
              <span className="text-gold-400 font-mono ml-2">{"{year}"}</span> : Çıkış Yılı
            </div>
            
            <div className="pt-2 border-t border-ink-800">
              <span className="text-emerald-400 font-bold block mb-1 flex items-center gap-1.5">
                🔥 KESİN ÇÖZÜM (Otomatik İlk Sonuca Gitme)
              </span>
              <p className="text-ink-400 mb-1">Sitelerin linkleri sürekli değiştiği için doğrudan sitenin içine yönlendirme yapar. (hdfilmcehennemi.nl kısmını istediğin siteyle değiştir)</p>
              <code className="text-azure-300 bg-azure-900/20 px-2 py-1 rounded block select-all">
                https://duckduckgo.com/?q=\site:hdfilmcehennemi.nl+{"{title}"}+{"{year}"}
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
            className="flex-1 bg-ink-800/80 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-azure-500/50 transition-all text-sm font-mono"
          />
          <button
            onClick={() => updateAltWatchTemplate(altTemplate)}
            className="flex items-center gap-1.5 bg-ink-700 hover:bg-azure-600 text-white px-4 py-2.5 rounded-lg font-medium transition-all"
          >
            <Check size={18} />
            Kaydet
          </button>
        </div>
      </div>

      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-100 mb-1 flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-pink-400" />
              Puanlama Kriterleri
            </h2>
            <p className="text-sm text-ink-500">Detaylı puanlama sisteminde kullanılacak alt kırılımları ve etki ağırlıklarını (1-10) belirle.</p>
          </div>
          <button
            onClick={() => {
              if (isAddingCrit) {
                resetCritForm();
              } else {
                setIsAddingCrit(true);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-all text-sm ${isAddingCrit ? 'bg-ink-800 text-ink-300 border border-ink-700' : 'bg-pink-500/20 text-pink-400 border border-pink-500/30 hover:bg-pink-500/30'}`}
          >
            {isAddingCrit ? <X size={16} /> : <Plus size={16} />}
            {isAddingCrit ? 'İptal' : 'Yeni Kriter'}
          </button>
        </div>

        {isAddingCrit && (
          <div className="mb-6 bg-ink-950/50 border border-pink-900/30 rounded-xl p-4 space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-400 mb-1.5 uppercase tracking-wider">Kriter Adı</label>
                <input
                  type="text"
                  value={critName}
                  onChange={(e) => setCritName(e.target.value)}
                  placeholder="Örn: Senaryo, Müzik, Atmosfer..."
                  className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-sm text-white focus:border-pink-500/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-400 mb-1.5 uppercase tracking-wider flex justify-between">
                  <span>Etki Ağırlığı</span>
                  <span className="text-pink-400">{critWeight} / 10</span>
                </label>
                <input
                  type="range"
                  min="1" max="10"
                  value={critWeight}
                  onChange={(e) => setCritWeight(Number(e.target.value))}
                  className="w-full mt-2 accent-pink-500"
                />
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
              <label className="block text-xs font-bold text-ink-400 mb-1.5 uppercase tracking-wider">Özel Tür Filtresi <span className="text-[10px] text-ink-600 font-normal lowercase">(Boş bırakırsan her türde çıkar)</span></label>
              <div className="flex flex-wrap gap-1.5">
                {data.genres.map(g => (
                  <button
                    key={g}
                    onClick={() => toggleCritGenre(g)}
                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${critGenres.includes(g) ? 'bg-pink-500/20 text-pink-300 border-pink-500/40' : 'bg-ink-900 text-ink-500 border-ink-800 hover:border-ink-600'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleSaveCriterion}
              disabled={!critName.trim()}
              className="w-full bg-pink-600 hover:bg-pink-500 text-white py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
            >
              {editingCritId ? 'Kriteri Güncelle' : 'Kriteri Kaydet'}
            </button>
          </div>
        )}

        {(!data.criteria || data.criteria.length === 0) ? (
          <p className="text-sm text-ink-500">Henüz hiçbir kriter eklenmedi.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.criteria.map((c) => (
              <div key={c.id} className={`border rounded-xl p-3 flex flex-col gap-2 transition-all ${editingCritId === c.id ? 'bg-pink-900/10 border-pink-500/50 shadow-md shadow-pink-500/10' : 'bg-ink-800/50 border-ink-700/50'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{c.name}</h4>
                    <div className="text-[10px] text-ink-400 mt-0.5 flex gap-2">
                      <span className="bg-ink-900 px-1.5 py-0.5 rounded border border-ink-800 text-pink-400 font-bold">Ağırlık: {c.weight}</span>
                      <span className="bg-ink-900 px-1.5 py-0.5 rounded border border-ink-800">{c.appliesTo === 'both' ? 'Film + Dizi' : c.appliesTo === 'movie' ? 'Sadece Film' : 'Sadece Dizi'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEditCrit(c)} className="p-1.5 text-ink-500 hover:text-pink-400 bg-ink-900 rounded-md transition-all">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => setDeleteCritTarget(c.id)} className="p-1.5 text-ink-500 hover:text-red-400 bg-ink-900 rounded-md transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {c.genres.length > 0 && (
                  <div className="text-[9px] text-ink-500 truncate mt-1">
                    Sadece: {c.genres.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteCritTarget && (
        <ConfirmDialog
          title="Kriteri Sil"
          message="Bu kriteri silmek istediğine emin misin? Önceki yapıtlara verdiğin detaylı puanlar geçmişte kalır ancak yeni puanlamalarda bu kriteri kullanamazsın."
          onConfirm={() => {
            deleteCriterion(deleteCritTarget);
            setDeleteCritTarget(null);
          }}
          onCancel={() => setDeleteCritTarget(null)}
        />
      )}

      {/* TÜR YÖNETİMİ */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
        <h2 className="text-lg font-semibold text-ink-100 mb-1 flex items-center gap-2">
          <Tag size={18} className="text-teal-400" />
          Tür Yönetimi
        </h2>
        <p className="text-sm text-ink-500 mb-4">Film ve dizi eklerken seçilecek türleri ekle veya sil.</p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newGenre}
            onChange={(e) => setNewGenre(e.target.value)}
            placeholder="Yeni tür adı..."
            className="flex-1 bg-ink-800/80 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && handleAddGenre()}
          />
          <button
            onClick={handleAddGenre}
            disabled={!newGenre.trim()}
            className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white px-4 py-2.5 rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-teal-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
            Ekle
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.genres.map((g) => (
            <div
              key={g}
              className="flex items-center gap-1.5 bg-teal-900/20 border border-teal-700/30 rounded-full pl-3 pr-1.5 py-1.5 hover:border-teal-600/50 transition-colors"
            >
              {editingGenre === g ? (
                <>
                  <input
                    type="text"
                    value={editGenreName}
                    onChange={(e) => setEditGenreName(e.target.value)}
                    className="bg-ink-950 border border-teal-600 rounded px-1.5 py-0.5 text-sm text-ink-100 focus:outline-none focus:border-teal-500 w-24"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editGenreName.trim()) {
                        renameGenre(g, editGenreName);
                        setEditingGenre(null);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (editGenreName.trim()) {
                        renameGenre(g, editGenreName);
                        setEditingGenre(null);
                      }
                    }}
                    className="text-green-400 hover:text-green-300 transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingGenre(null)}
                    className="text-ink-500 hover:text-ink-300 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm text-teal-200">{g}</span>
                  <button
                    onClick={() => {
                      setEditingGenre(g);
                      setEditGenreName(g);
                    }}
                    className="text-teal-500 hover:text-teal-300 transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteGenreTarget(g)}
                    className="text-teal-500 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
        <h2 className="text-lg font-semibold text-ink-100 mb-1 flex items-center gap-2">
          <Boxes size={18} className="text-azure-400" />
          Koleksiyon Yönetimi
        </h2>
        <p className="text-sm text-ink-500 mb-4">Koleksiyonların (evren/seri) adını düzenle veya sil.</p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newCollection}
            onChange={(e) => setNewCollection(e.target.value)}
            placeholder="Yeni koleksiyon adı..."
            className="flex-1 bg-ink-800/80 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-azure-500/50 focus:ring-1 focus:ring-azure-500/30 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && handleAddCollection()}
          />
          <button
            onClick={handleAddCollection}
            disabled={!newCollection.trim()}
            className="flex items-center gap-1.5 bg-gradient-to-r from-azure-600 to-azure-500 hover:from-azure-500 hover:to-azure-400 text-white px-4 py-2.5 rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-azure-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
            Ekle
          </button>
        </div>

        {data.collections.length === 0 ? (
          <p className="text-sm text-ink-500">Henüz koleksiyon yok.</p>
        ) : (
          <div className="space-y-2">
            {data.collections.map((c) => {
              const movieCount = data.movies.filter((m) => m.collectionId === c.id).length;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2 bg-ink-800/80 border border-ink-700 rounded-lg px-3 py-2.5 hover:border-azure-600/50 transition-colors"
                >
                  {editingColl === c.id ? (
                    <>
                      <input
                        type="text"
                        value={editCollName}
                        onChange={(e) => setEditCollName(e.target.value)}
                        className="flex-1 bg-ink-950 border border-ink-600 rounded px-2 py-1 text-ink-100 focus:outline-none focus:border-azure-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            renameCollection(c.id, editCollName);
                            setEditingColl(null);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          renameCollection(c.id, editCollName);
                          setEditingColl(null);
                        }}
                        className="text-green-400 hover:text-green-300 transition-colors"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => setEditingColl(null)}
                        className="text-ink-500 hover:text-ink-300 transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Boxes size={16} className="text-azure-500" />
                      <span className="flex-1 text-sm text-ink-200">{c.name}</span>
                      <span className="text-xs text-ink-600">{movieCount} film</span>
                      <button
                        onClick={() => {
                          setEditingColl(c.id);
                          setEditCollName(c.name);
                        }}
                        className="text-ink-500 hover:text-ink-300 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirmDeleteColl === c.id) {
                            deleteCollection(c.id);
                            setConfirmDeleteColl(null);
                          } else {
                            setConfirmDeleteColl(c.id);
                            setTimeout(() => setConfirmDeleteColl(null), 2000);
                          }
                        }}
                        className="text-ink-500 hover:text-red-400 transition-colors"
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
        <div className="bg-gradient-to-r from-azure-950/40 to-indigo-950/40 border border-azure-500/30 rounded-2xl p-5 shadow-xl shadow-ink-950/30 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Smartphone size={20} className="text-azure-400" />
              Sinevia'yı Cihazına Yükle
            </h2>
            <p className="text-sm text-ink-400 mt-0.5">
              Tarayıcı çubuğu olmadan tam ekran ve internet olmadan da kullanmak için uygulamayı ana ekranına ekle.
            </p>
          </div>
          <button
            onClick={installPWA}
            className="bg-gradient-to-r from-azure-600 to-indigo-600 hover:from-azure-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-azure-500/20 transition-all text-sm"
          >
            Uygulamayı İndir
          </button>
        </div>
      )}

      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
        <h2 className="text-lg font-semibold text-ink-100 mb-1 flex items-center gap-2">
          <Download size={18} className="text-emerald-400" />
          Yedekle / Geri Yükle
        </h2>
        <p className="text-sm text-ink-500 mb-4">Verilerini JSON dosyası olarak dışa veya içe aktar.</p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportData}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-4 py-2.5 rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-emerald-500/30"
          >
            <Download size={18} />
            Yedek Al
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 bg-ink-700 hover:bg-ink-600 text-ink-200 px-4 py-2.5 rounded-lg font-medium transition-all"
          >
            <Upload size={18} />
            Geri Yükle
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            onChange={handleFileImport}
            className="hidden"
          />
        </div>
      </div>

      {deleteGenreTarget && (
        <ConfirmDialog
          title="Türü Sil"
          message={`"${deleteGenreTarget}" türü silinecek. Bu türü kullanan film ve dizilerde bu tür etiketi kaldırılacak. Emin misin?`}
          onConfirm={() => {
            deleteGenre(deleteGenreTarget);
            setDeleteGenreTarget(null);
          }}
          onCancel={() => setDeleteGenreTarget(null)}
        />
      )}

      <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
        <h2 className="text-lg font-semibold text-amber-500 mb-1 flex items-center gap-2">
          <Wrench size={18} />
          Geliştirici / Test Ayarları
        </h2>
        <p className="text-sm text-ink-500 mb-4">Henüz kazanılmamış (kilitli) başarımların isimlerini "???" yerine açıkça gösterir.</p>
        
        <button
          onClick={toggleLockedNames}
          className={`px-5 py-2.5 rounded-lg font-bold transition-all ${
            data.showLockedNames 
              ? 'bg-amber-500 text-ink-900 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
              : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
          }`}
        >
          {data.showLockedNames ? 'Görünürlüğü Kapat (Normal Mod)' : 'Kilitli İsimleri Göster (Test Modu)'}
        </button>
      </div>

      <div className="bg-crimson-950/30 border border-crimson-800/40 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
        <h2 className="text-lg font-semibold text-crimson-400 mb-1 flex items-center gap-2">
          <AlertTriangle size={18} className="text-crimson-400" />
          Verileri Sıfırla
        </h2>
        <p className="text-sm text-crimson-400/60 mb-4">Tüm filmler, diziler, geçmiş, başarım ve seviye verileri kalıcı olarak silinir. Bu işlem geri alınamaz.</p>

        {confirmReset ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-crimson-400 font-medium">Emin misin? Bu işlem geri alınamaz!</span>
            <button
              onClick={() => {
                resetData();
                setConfirmReset(false);
              }}
              className="flex items-center gap-1.5 bg-crimson-600 hover:bg-crimson-500 text-white px-4 py-2.5 rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-crimson-500/30"
            >
              <Trash2 size={18} />
              Evet, Sıfırla
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="flex items-center gap-1.5 bg-ink-700 hover:bg-ink-600 text-ink-200 px-4 py-2.5 rounded-lg font-medium transition-all"
            >
              <X size={18} />
              İptal
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-2 bg-crimson-600/80 hover:bg-crimson-500 text-white px-4 py-2.5 rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-crimson-500/30"
          >
            <Trash2 size={18} />
            Tüm Verileri Sıfırla
          </button>
        )}
      </div>
    </div>
  );
}