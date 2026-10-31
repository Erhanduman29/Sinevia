/**
 * Tutorial metinleri — tek dosyada, ileride i18n (çoklu dil) için hazır.
 * Her adımın başlığı, açıklaması ve (varsa) vurgulanacak öğesi burada.
 *
 * Adım türleri (step.type):
 *  - 'slide'    : Sini anlatır, "İleri" ile geçilir. Yumuşak.
 *  - 'spotlight': Bir öğe ışıklandırılır + anlatılır. Yumuşak.
 *  - 'direct'   : "Şuna dokun" — gerçek tıklama beklenir. Sert.
 *  - 'action'   : "Bunu yap" — gerçek işlem beklenir. Sert (en güçlü).
 *
 * `target`, registry'deki data-tutorial öğesinin anahtarını verir.
 */

export interface TutorialStepDef {
  type: 'slide' | 'spotlight' | 'direct' | 'action';
  title: string;
  desc: string;
  target?: string;
  /** direct/adım bekleme mesajı (isteğe bağlı) */
  hint?: string;
}

export interface TutorialDef {
  id: string;
  /** Karşılama turu / sayfa / pencere ayrımı */
  group: 'welcome' | 'page' | 'modal';
  /** Sayfa anahtar (page group için) — otomatik tetikmede kullanılır */
  page?: string;
  steps: TutorialStepDef[];
}

/* =========================================================================
   1. KARŞILAMA TURU — 7 adım (sıralı, ilk açılışta otomatik)
   ========================================================================= */
export const WELCOME_TUTORIAL: TutorialDef = {
  id: 'welcome',
  group: 'welcome',
  steps: [
    {
      type: 'slide',
      title: 'Merhaba! Ben Sini 🎬',
      desc: "Sinevia'nın rehber klaketiyim. Sinema tutkunuysan tam adresindesin. Hadi birlikte etrafı tanışalım — çok uzun sürmeyecek.",
    },
    {
      type: 'slide',
      title: 'Sinevia nasıl işler?',
      desc: 'Döngü basit: bir film izlersin → burada puanlarsın → deneyim (XP) kazanırsın → seviye atlar, rozet ve başarımlar açılır. Görevler ve haftalık plan ise disiplinli kalmanı sağlar.',
    },
    {
      type: 'spotlight',
      target: 'home-hero',
      title: 'İşte senin kahraman kartın',
      desc: 'Bu kart senin özetin: profilin, seviye halkan, izleme serin (streak) ve rozetin. Buradaki ilerleme tamamen sana ait.',
    },
    {
      type: 'spotlight',
      target: 'home-actions',
      title: 'Hızlı erişim butonları',
      desc: 'Kararsız kaldığında "Ne İzlesem?" çarkı, zevkine özel öneri için DNA Sentezle, hazır listeler için Katalog Ekle ve plan kurmak için Haftalığa Ekle — hepsi tek dokunuş uzağında.',
    },
    {
      type: 'spotlight',
      target: 'nav-tabs',
      title: 'Menü her yerde',
      desc: 'Soldaki (masaüstünde) veya alttaki (mobilde) menüden bölümlere geçersin. Filmler, diziler, plan, başarımlar, istatistikler ve daha fazlası burada.',
    },
    {
      type: 'direct',
      target: 'nav-movies',
      title: 'Hadi bir deneyelim',
      desc: "Şimdi bana \"Filmler\" bölümüne dokun. Koleksiyonun orada yaşayacak.",
      hint: 'Menüden Filmler\'e dokun →',
    },
    {
      type: 'slide',
      title: "Sinevia'yı farklı kılan 3 şey",
      desc: '1) İzleme Zamanlayıcısı: gerçek süreye göre puan dengele. 2) Görevler & Başarımlar: oyunlaştırılmış ilerleme. 3) Sinevia Ağı: arkadaşlarınla akış ve sıralama. Hepsini gezerken öğreneceksin.',
    },
    {
      type: 'slide',
      title: 'Hazırsın!',
      desc: 'Artık serbestsin. İstediğin gibi gez. Aklına bir şey takılırsa menüdeki "Tutorial Merkezi"nden beni tekrar çağırabilirsin. İyi seyirler!',
    },
  ],
};

/* =========================================================================
   2. SAYFA TUTORIALERİ — 7 sayfa (Filmler, Haftalık Plan, Sinevia Ağı,
      Başarımlar, İstatistikler, Geçmiş, Pazar)
   Sayfaya İLK girişte otomatik tetiklenir.
   ========================================================================= */
export const PAGE_TUTORIALS: TutorialDef[] = [
  {
    id: 'page_movies',
    group: 'page',
    page: 'movies',
    steps: [
      {
        type: 'slide',
        title: 'Filmler — kütüphanen',
        desc: 'Buraya izlemek istediğin ve izlediğin filmleri eklersin. Koleksiyonlar, filtreler ve sıralama ile düzenli tutarsın. Hadi baştan sona bir bakalım.',
      },
      {
        type: 'spotlight',
        target: 'movies-add',
        title: 'Film ekle',
        desc: 'Şu altın "Film Ekle" butonu kapının anahtarı. TMDB üzerinden aratarak filmi saniyeler içinde koleksiyonuna katabilirsin.',
      },
      {
        type: 'spotlight',
        target: 'movies-list',
        title: 'Kartların burada',
        desc: 'Eklediğin filmler kartlar halinde listelenir. İzlemediklerin, izlediklerin ve geçmiş kuyruğun ayrı ayrı filtrelenebilir.',
      },
      {
        type: 'direct',
        target: 'movies-filter',
        title: 'Hadi bir filtre deneyelim',
        desc: 'Şimdi şu filtre şeridine dokun ("Tümü" veya "İzlenmedi"). Listeyi anında süzdüğünü göreceksin.',
        hint: 'Filtre şeridine dokun →',
      },
      {
        type: 'spotlight',
        target: 'movies-pick',
        title: 'Kararsız kaldıysan?',
        desc: '"Ne İzlesem" çarkı rastgele seçer, DNA Sentezleyici zevkine göre öneri üretir. Eğlenmek burada.',
      },
      {
        type: 'slide',
        title: 'İzleme Zamanlayıcısı',
        desc: 'Filmi izlemeye başlattığında zamanlayıcı gerçek süreye göre işler. Puan verdiğinde süre dalgalanmaları dengelenir: erken pes eden yüksek puanlar yumuşatılır, tamamını izleyen ödüllendirilir. Böylece puanların dürüst kalır.',
      },
      {
        type: 'slide',
        title: 'Bitti bile!',
        desc: 'Filmler sayfasını tanıdın. Filmi izlemeye başladığında zamanlayıcı devreye girer, puanlarken dengeli sonuç alırsın. Şimdi serbestçe keşfet.',
      },
    ],
  },
  {
    id: 'page_plan',
    group: 'page',
    page: 'plan',
    steps: [
      {
        type: 'slide',
        title: 'Haftalık Plan — disiplin senin',
        desc: 'Filmleri takvimine programla, izleme düzenini kur. Gerçekçi olmayan üst üste planlamalarda sistem seni uyarır.',
      },
      {
        type: 'spotlight',
        target: 'plan-add',
        title: 'Plana film ekle',
        desc: 'Şu renkli "Plana Film Ekle" butonu ile seçtiğin filmi bir güne ve saate yerleştirirsin.',
      },
      {
        type: 'direct',
        target: 'plan-view',
        title: 'Görünümü değiştir',
        desc: 'Şimdi şu Liste / Zaman Çizelgesi geçişine dokun. Planını iki farklı gözle görebilirsin.',
        hint: 'Liste/Zaman Çizelgesi geçişine dokun →',
      },
      {
        type: 'spotlight',
        target: 'plan-timeline',
        title: 'Zaman çizelgen',
        desc: 'Planladığın filmler gün gün burada görünür. Listelerden sürükleyip taşıyabilir, düzenleyebilirsin.',
      },
      {
        type: 'slide',
        title: "Planın altın kuralı",
        desc: 'Aynı güne üst üste çok film sıkıştırma — sistem seni uyarır. Haftada gerçekçi bir ritim kurarsan izleme serin bozulmaz, planlar zamanında tamamlanır ve XP akışın düzenli kalır.',
      },
      {
        type: 'slide',
        title: 'Harika planlar!',
        desc: 'Haftalık Planı öğrendin. Zamanlayın, izleyin, puanlayın — döngü tamamlansın. Artık planlama uzmanısın.',
      },
    ],
  },
  {
    id: 'page_network',
    group: 'page',
    page: 'network',
    steps: [
      {
        type: 'slide',
        title: 'Sinevia Ağı — yalnız değilsin',
        desc: "Arkadaşlarının ne izlediğini gör, akışı takip et, sıralamada yarış. Sinema sosyal bir tutku, paylaşınca güzel.",
      },
      {
        type: 'spotlight',
        target: 'network-feed',
        title: 'Arkadaş akışı',
        desc: 'Arkadaşlarının puanladığı, izlediği ve eklediği yapımlar burada akar. Beğendiğin bir filme dokunarak detaya geçebilirsin.',
      },
      {
        type: 'direct',
        target: 'network-friends',
        title: 'Sıralamaya bir bak',
        desc: 'Şimdi şu Arkadaşlar / sıralama bölümüne dokun. Kimin önde olduğunu göreceksin.',
        hint: 'Arkadaşlar bölümüne dokun →',
      },
      {
        type: 'slide',
        title: 'Profilin ve vitrinin',
        desc: 'Kendi profilinde rozetlerin, başarımların ve vitrine çıkardığın filmler görünür. Arkadaşların seni buradan tanır — güzel puanlar bırak, akışta fark edil.',
      },
      {
        type: 'slide',
        title: 'Ağ hazır!',
        desc: "Sinevia Ağı'nı tanıdın. Arkadaş ekleyip akışa katılabilirsin. İşte tüm temeller tamam — bol sinemalı günler!",
      },
    ],
  },
  {
    id: 'page_achievements',
    group: 'page',
    page: 'achievements',
    steps: [
      {
        type: 'slide',
        title: 'Ödüller & Kariyer',
        desc: "Burası Sinevia'nın ganimet odası: izleme alışkanlıkların, görevlerin ve hedeflerin altın kupalara dönüşür. Kupalar yalnızca süs değil — her kupa senin sinema geçmişinin bir kanıtı.",
      },
      {
        type: 'spotlight',
        target: 'ach-tabs',
        title: 'İki sekme, iki dünya',
        desc: 'Üstteki sekmelerden "Kupa Kasası" kalıcı başarımlarını, "Görev Panosu" ise sıradaki görevlerini ve ödüllerini gösterir. İkisi arasında sık sık geçiş yapacaksın.',
      },
      {
        type: 'direct',
        target: 'ach-tabs',
        title: 'Hadi bir sekme deneyelim',
        desc: 'Şimdi şu sekmelerden "Görev Panosu"na dokun. Kabul ettiğin görevler, ilerlemen ve ödül seviyen orada listelenir.',
        hint: 'Görev Panosu sekmesine dokun →',
      },
      {
        type: 'spotlight',
        target: 'ach-grid',
        title: 'Kupa kartların',
        desc: 'Her başarımın birden çok kademesi vardır (bronzdan zümrüte); kartlardaki ilerleme çubukları hedefe ne kadar yaklaştığını gösterir. Kilitli kupalar bulanık durur — açılmayı beklerler.',
      },
      {
        type: 'slide',
        title: 'Kariyerin senin mirasın',
        desc: 'Puanladıkça, izledikçe ve planladıkça kupalar kendiliğinden açılır; her kademe XP verir. Görev panosundaki görevleri kabul ederek ilerlemeyi hızlandırabilirsin.',
      },
    ],
  },
  {
    id: 'page_stats',
    group: 'page',
    page: 'stats',
    steps: [
      {
        type: 'slide',
        title: 'İstatistik Stüdyosu',
        desc: "Bu laboratuarda izleme alışkanlıklarının haritası çıkar: ne zaman, ne kadar ve nasıl izlediğini rakamlara döker. Eğilimlerini görünce düzenini daha iyi kurarsın.",
      },
      {
        type: 'direct',
        target: 'stats-modes',
        title: 'Kapsam seçici',
        desc: 'Şimdi şu "Güncel / Önceden / Tümü" geçişlerinden birine dokun. Eski izlemeleri güncel istatistiklerinden ayırmak ya da hepsini birleştirmek senin elinde.',
        hint: 'Güncel/Önceden/Tümü butonlarından birine dokun →',
      },
      {
        type: 'spotlight',
        target: 'stats-heatmap',
        title: 'İzleme haritası',
        desc: 'Yıllık, aylık, haftalık ve günlük görünümlerde izleme haritan: bir kutucuk ne kadar parlaksa o gün o kadar çok izlemişsindir. Yoğun ritmini görünce planını ona göre ayarlayabilirsin.',
      },
      {
        type: 'spotlight',
        target: 'stats-header',
        title: 'Wrapped Özeti & puanlama kimliğin',
        desc: 'Buradaki "Wrapped Özeti" yıl sonu izleme özetenı tek bakışta verir; yanındaki Kimlik rozeti ise puanlama tarzını özetler (ör. titiz, dengeli, cömert).',
      },
      {
        type: 'slide',
        title: 'Veri senin, yorum senin',
        desc: 'En çok hangi türde vakit geçirdiğin, hangi saatlerde izlediğin, rekorların... Hepsi burada. İstatistiklerine bakıp sıradaki hedefini seçmeye hazırsın.',
      },
    ],
  },
  {
    id: 'page_history',
    group: 'page',
    page: 'history',
    steps: [
      {
        type: 'slide',
        title: 'Sinema Günlüğü & Geçmiş',
        desc: "Buraya izlediğin her şeyin kronolojik zaman tüneli ve inceleme arşivin düşer. Yıllar sonra \"ne izlemiştim?\" dediğin an burası imdadına yetişir.",
      },
      {
        type: 'spotlight',
        target: 'history-stats',
        title: 'Günlük özet vitrini',
        desc: 'Toplam kayıt, izlenen film, dizi bölümü, inceleme ve aktif gün kartları — arşivinin nabzı ilk satırda atar.',
      },
      {
        type: 'spotlight',
        target: 'history-views',
        title: 'Üç farklı görünüm',
        desc: 'Zaman Tüneli kronolojik akışı, Poster Vitrini görsel listeyi, "Önceden" ise sadece daha önce izlediklerini gösterir. Geçmişini dilediğin gözle süzebilirsin.',
      },
      {
        type: 'slide',
        title: 'Arşivin elinin altında',
        desc: 'Notların ve inceleme etiketlerinle kendi film eleştirmenliğini yaz. Kayıtları filtreleyip aradığın yapıma saniyeler içinde ulaşabilirsin.',
      },
    ],
  },
  {
    id: 'page_market',
    group: 'page',
    page: 'market',
    steps: [
      {
        type: 'slide',
        title: 'Pazar & Envanter — emeğinin karşılığı',
        desc: 'Görevlerden ve başarımlardan kazandığın SineCoin\'leri burada harcarsın. Pazar; pazar görevleri, güçlendirmeler, kozmetikler ve koleksiyon parçalarıyla dolu.',
      },
      {
        type: 'spotlight',
        target: 'market-header',
        title: 'Bütçen ve haftalık fırsatlar',
        desc: 'Üstteki coin göstergesi bakiyeni gösterir; yanındaki alan bu haftanın yenilenme zamanını ve aktif kuponunu bildirir. Coin\'e dokunarak cüzdanına geçebilirsin.',
      },
      {
        type: 'direct',
        target: 'market-tab-gorevler',
        title: 'Önce pazar görevlerine bak',
        desc: 'Şimdi "Görevler" sekmesine dokun. Pazar görevleri; izleme, puanlama veya plan hedefleri karşılığında ekstra coin ve XP kazandırır.',
        hint: 'Görevler sekmesine dokun →',
      },
      {
        type: 'spotlight',
        target: 'market-contracts',
        title: 'Pazar görevleri',
        desc: 'Bir görevi satın aldığında aktif görevin yoksa otomatik başlar; varsa envanterine eklenir. Süre bitmeden hedefi tamamla, ödülünü kap.',
      },
      {
        type: 'direct',
        target: 'market-tab-pazar',
        title: 'Ürünlere geri dön',
        desc: 'Şimdi "Pazar" sekmesine dokun. Burada işlevsel itemler, kalıcı gelişimler ve kozmetikler seni bekliyor.',
        hint: 'Pazar sekmesine dokun →',
      },
      {
        type: 'spotlight',
        target: 'market-items',
        title: 'Satın alınabilir ürünler',
        desc: 'İşlevsel itemler görev ve XP akışını etkiler; kozmetikler profilini kişiselleştirir. Bir ürüne tıklayınca detay penceresi açılır ve satın alma onayını orada verirsin.',
      },
      {
        type: 'slide',
        title: 'Envanter senin çantan',
        desc: 'Satın aldığın her şey Envanter sekmesine düşer. Bir eşyaya tıklayarak detayını görüp kullanabilir, kuşanabilir veya bekleyen pazar görevini başlatabilirsin. Harcarken keyfini çıkar!',
      },
    ],
  },
];

/* =========================================================================
   3. PENCERE TUTORIALERİ — V1'de 1 pencere (Puanlama). Sert eylem.
   ========================================================================= */
export const MODAL_TUTORIALS: TutorialDef[] = [
  {
    id: 'modal_rating',
    group: 'modal',
    // Merkezden başlatılınca nereye gidileceği (puanlama en çok Filmler'de)
    page: 'movies',
    steps: [
      {
        type: 'slide',
        title: 'Değerlendirme Stüdyosu',
        desc: 'Bir filmi bitirdiğinde buradan puanlarsın. Puanın, izleme süresine göre dengelenir — hadi önemli noktalara bakalım.',
      },
      {
        type: 'spotlight',
        target: 'rating-stars',
        title: 'Puanını ver',
        desc: 'Yıldızlarla veya 1-10 butonlarıyla puan seç. Yarım puanlar da mümkün. İstediğin notu ve inceleme etiketlerini ekle.',
      },
      {
        type: 'action',
        target: 'rating-submit',
        title: 'Zamanlayıcı kuralı',
        desc: 'Filmi gerçek süresinin en az %60\'ı kadar izlemeden puanlayamazsın — bu, ciddi puanların değerini korur. Puanını kaydetmeyi dene.',
        hint: 'Puanını seçip "Kaydet" ile tamamla →',
      },
    ],
  },
];

/* =========================================================================
   TÜM TUTORIALLER — tek liste (ilerleme takibi için)
   ========================================================================= */
export const ALL_TUTORIALS: TutorialDef[] = [
  WELCOME_TUTORIAL,
  ...PAGE_TUTORIALS,
  ...MODAL_TUTORIALS,
];

/* =========================================================================
   AKADEMİ — 13 sıralı ders (XP'siz, görev panosunda altın blok)
   Her ders bir "eylem"dir; kullanıcı gerçekten yaparak tamamlar.
   NOT: Yeni dersler SONA eklenir — academyStep bir indeks olduğu için
   araya ders koymak mevcut kullanıcıların ilerlemesini kaydırır.
   ========================================================================= */
export interface AcademyQuestDef {
  id: string;
  title: string;
  desc: string;
  /** Görevin tamamlanması için gereken olay anahtarı */
  trigger:
    | 'movie_added'
    | 'movie_rated'
    | 'quest_accepted'
    | 'plan_added'
    | 'stats_mode_changed'
    | 'dna_used'
    | 'showcase_updated'
    | 'series_added'
    | 'history_rating_edited'
    | 'badge_equipped'
    | 'ai_message_sent'
    | 'backup_created'
    | 'market_item_bought';
  /** Görevin tamamlanması için kaç kez tetiklenmeli (default 1).
   *  Orta zorluk için kolay tekrarlanabilir dersler 2-3 ister. */
  count?: number;
}

export const ACADEMY_QUESTS: AcademyQuestDef[] = [
  { id: 'ac_movie', title: 'Katalogdan Film Ekle', desc: 'Ana sayfadaki "Katalog Ekle" ile katalogdan koleksiyonuna iki film ekle.', trigger: 'movie_added', count: 2 },
  { id: 'ac_rate', title: 'Ona Puan Ver', desc: 'İzleme zamanlayıcısı kuralını öğren: iki filmi puanla ve dengele.', trigger: 'movie_rated', count: 2 },
  { id: 'ac_quest', title: 'Bir Görev Kabul Et', desc: 'Görev panosundan sıradaki iki görevini kabul et.', trigger: 'quest_accepted', count: 2 },
  { id: 'ac_plan', title: 'Haftalık Planla', desc: 'İki filmi haftalık plana ekle, disiplinli kal.', trigger: 'plan_added', count: 2 },
  { id: 'ac_stats', title: 'İstatistik Kapsamını Değiştir', desc: 'İstatistiklerde Güncel/Önceden/Tümü üç kapsamı da sırayla dene; verini farklı gözlerden gör.', trigger: 'stats_mode_changed', count: 3 },
  { id: 'ac_dna', title: 'DNA Sentezleyiciyi Dene', desc: 'DNA Sentezleyici ile zevkine göre bir öneri üret.', trigger: 'dna_used' },
  { id: 'ac_network', title: 'Vitrinini Düzenle', desc: "Sinevia Ağı'nda profil vitrinini birkaç kez güncelle — film veya dizi ekleyip çıkar; arkadaşların seni buradan tanır.", trigger: 'showcase_updated', count: 2 },
  { id: 'ac_series', title: 'Bir Dizi Ekle', desc: 'Sıra dizilerde: Katalogdan iki dizi ekle, sezonlarını takibe al.', trigger: 'series_added', count: 2 },
  { id: 'ac_history', title: 'Geçmişte Puanı Düzenle', desc: "Geçmişinde iki puanı düzenle (ör. 10'dan 8'e) — kayıtların anında güncellensin.", trigger: 'history_rating_edited', count: 2 },
  { id: 'ac_achievements', title: 'Bir Rozet Tak', desc: 'Görev Panosu\'nda tamamladığın görevlerden ikisini profil rozeti olarak tak.', trigger: 'badge_equipped', count: 2 },
  { id: 'ac_ai', title: "AI Asistan'a Mesaj Yaz", desc: "AI Asistan'a iki soru yaz ve gönder; katalog ve öneri ipuçları kap.", trigger: 'ai_message_sent', count: 2 },
  { id: 'ac_backup', title: 'Verini Yedekle', desc: 'Ayarlar → Tam Yedekle bölümünden "Yedek Al" ile verini dosya olarak indir.', trigger: 'backup_created' },
  { id: 'ac_market', title: 'Pazardan Bir İtem Satın Al', desc: 'Pazar sekmesinden bir ürün seç ve satın al. Görevlerden kazandığın SineCoin\'leri harcayarak envanterini güçlendir.', trigger: 'market_item_bought' },
];

/* =========================================================================
   TUTORIAL MERKEZİ — başlıklar ve maskot replikleri
   ========================================================================= */
export const TUTORIAL_CENTER = {
  title: 'Tutorial Merkezi',
  subtitle: 'Uygulamayı adım adım öğren. İstediğin zaman tekrar izleyebilirsin.',
  progressLabel: 'İlerleme',
  close: 'Kapat',
  steps: 'adım',
  groups: {
    welcome: 'Karşılama Turu',
    page: 'Sayfa Turları',
    modal: 'Pencere Turları',
    academy: 'Sinevia Akademisi',
  },
  groupDescs: {
    welcome: 'İlk açılışta otomatik başlar; buradan istediğin an baştan izleyebilirsin.',
    page: 'Her sayfanın kendi turları var. Bir sayfaya ilk girdiğinde otomatik de başlarlar.',
    modal: 'Pencerelerdeki (puanlama vb.) akışları tanıtır.',
    academy: 'On üç gerçek görevle uygulamayı yaparak öğren — XP yok, sadece deneyim. Her dersi buradan ayrı ayrı başlatabilir, bitmiş bir dersi yeniden yapabilirsin.',
  },
  startHint: 'Seçtiğin tur, ilgili sayfayı açıp oradan başlar.',
  status: {
    done: 'Tamamlandı',
    todo: 'Başla',
    repeat: 'Tekrar İzle',
    current: 'Devam Et',
  },
  // Maskot, eksik tutorial kaldığında nazikçe hatırlatır (başarım SEZDİRMEZ)
  nudges: [
    'Henüz gezilmemiş köşeler var gibi görünüyor...',
    'Bir tur daha atalım mı? Her yer berrak olsun.',
    'Küçük bir gezinti, büyük bir fark yaratır.',
  ],
  allDone: 'Her yeri gezdin, her köşeyi gördün. Mükemmel!',
};
