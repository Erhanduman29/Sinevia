import { useState, useRef } from 'react';
import { Settings, Plus, Trash2, Tag, Boxes, Download, Upload, Edit2, Check, X, AlertTriangle, Wrench } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ConfirmDialog from '../components/ConfirmDialog';

export default function SettingsPage() {
  const { data, addGenre, deleteGenre, renameGenre, addCollection, deleteCollection, renameCollection, exportData, importData, resetData, toggleLockedNames } = useApp();
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-ink-100 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-700/20 border border-violet-500/30 flex items-center justify-center">
          <Settings size={22} className="text-violet-300" />
        </div>
        Ayarlar
      </h1>

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

      {/* --- YENİ EKLENEN: TEST AYARLARI --- */}
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