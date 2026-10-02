import * as Icons from 'lucide-react';

export interface RankTier {
  minLevel: number;
  maxLevel: number;
  title: string;
  subtitle: string;
  color: string;
  border: string;
  badgeBg: string;
  bgGlow: string;
  gradient: string;
  barGradient: string;
  strokeColor: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}

export const RANK_TIERS: RankTier[] = [
  {
    minLevel: 1, maxLevel: 4, title: 'Çaylak İzleyici', subtitle: 'Sinema yolculuğunun ilk adımları',
    color: 'text-slate-300', border: 'border-slate-500/40', badgeBg: 'bg-slate-500/15', bgGlow: 'bg-slate-500/15',
    gradient: 'from-slate-500 via-slate-400 to-zinc-300', barGradient: 'from-slate-600 via-slate-400 to-white',
    strokeColor: '#94a3b8', icon: Icons.Film,
  },
  {
    minLevel: 5, maxLevel: 9, title: 'Film Meraklısı', subtitle: 'Kült yapımların ve seçkin hikayelerin kaşifi',
    color: 'text-sky-400', border: 'border-sky-500/40', badgeBg: 'bg-sky-500/15', bgGlow: 'bg-sky-500/20',
    gradient: 'from-blue-600 via-sky-500 to-cyan-300', barGradient: 'from-blue-700 via-sky-500 to-cyan-300',
    strokeColor: '#38bdf8', icon: Icons.Popcorn,
  },
  {
    minLevel: 10, maxLevel: 14, title: 'Düzenli Seyirci', subtitle: 'Sinema artık hayatının ayrılmaz bir parçası',
    color: 'text-emerald-400', border: 'border-emerald-500/40', badgeBg: 'bg-emerald-500/15', bgGlow: 'bg-emerald-500/20',
    gradient: 'from-emerald-600 via-green-500 to-teal-300', barGradient: 'from-emerald-700 via-green-500 to-teal-300',
    strokeColor: '#34d399', icon: Icons.Eye,
  },
  {
    minLevel: 15, maxLevel: 19, title: 'Tutkulu Sinefil', subtitle: 'Yönetmen imzalarını ve alt metinleri okuyan göz',
    color: 'text-violet-400', border: 'border-violet-500/40', badgeBg: 'bg-violet-500/15', bgGlow: 'bg-violet-500/20',
    gradient: 'from-violet-600 via-purple-500 to-fuchsia-400', barGradient: 'from-violet-700 via-purple-500 to-fuchsia-300',
    strokeColor: '#a78bfa', icon: Icons.Heart,
  },
  {
    minLevel: 20, maxLevel: 29, title: 'Sinema Otoritesi', subtitle: 'Eleştirileri ve arşiviyle referans noktası',
    color: 'text-gold-400', border: 'border-gold-500/50', badgeBg: 'bg-gold-500/15', bgGlow: 'bg-gold-500/25',
    gradient: 'from-amber-600 via-gold-500 to-yellow-300', barGradient: 'from-amber-600 via-gold-500 to-yellow-200',
    strokeColor: '#f59e0b', icon: Icons.Award,
  },
  {
    minLevel: 30, maxLevel: 39, title: 'Eleştirmenler Birliği', subtitle: 'Puanları kanun sayılan acımasız vizyoner',
    color: 'text-rose-400', border: 'border-rose-500/50', badgeBg: 'bg-rose-500/15', bgGlow: 'bg-rose-500/30',
    gradient: 'from-red-600 via-rose-500 to-pink-400', barGradient: 'from-red-700 via-rose-500 to-pink-400',
    strokeColor: '#fb7185', icon: Icons.PenTool,
  },
  {
    minLevel: 40, maxLevel: 49, title: 'Sinevia Efsanesi', subtitle: 'Yedinci sanatın zirvesine ulaşmış saygın usta',
    color: 'text-cyan-300', border: 'border-cyan-400/50', badgeBg: 'bg-cyan-500/15', bgGlow: 'bg-cyan-500/25',
    gradient: 'from-cyan-500 via-teal-400 to-emerald-300', barGradient: 'from-cyan-600 via-teal-400 to-emerald-200',
    strokeColor: '#22d3ee', icon: Icons.Crown,
  },
  {
    minLevel: 50, maxLevel: 59, title: 'Evren Fatihi', subtitle: 'Tüm kurgusal evrenlere hükmeden mitik koleksiyoner',
    color: 'text-fuchsia-300', border: 'border-fuchsia-400/60', badgeBg: 'bg-fuchsia-500/20', bgGlow: 'bg-fuchsia-500/35',
    gradient: 'from-fuchsia-600 via-pink-500 to-purple-400', barGradient: 'from-fuchsia-700 via-pink-500 to-purple-300',
    strokeColor: '#f0abfc', icon: Icons.Globe2,
  },
  {
    minLevel: 60, maxLevel: 74, title: 'Kozmik Yönetmen', subtitle: 'Sinema tarihini yeniden yazan yıldızlarüstü irade',
    color: 'text-indigo-300', border: 'border-indigo-400/60', badgeBg: 'bg-indigo-500/20', bgGlow: 'bg-indigo-500/40',
    gradient: 'from-indigo-600 via-blue-500 to-violet-400', barGradient: 'from-indigo-700 via-blue-500 to-violet-300',
    strokeColor: '#818cf8', icon: Icons.Sparkles,
  },
  {
    minLevel: 75, maxLevel: 999, title: 'Sinema Tanrısı', subtitle: 'Ölümsüzlüğe ulaşmış, evrenin nihai ekran yüzü',
    color: 'text-zinc-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]', border: 'border-zinc-200/70', badgeBg: 'bg-zinc-100/20', bgGlow: 'bg-zinc-300/40',
    gradient: 'from-zinc-400 via-zinc-100 to-white', barGradient: 'from-zinc-500 via-zinc-200 to-white',
    strokeColor: '#ffffff', icon: Icons.Gem,
  },
];
