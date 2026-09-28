import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Bell,
  Bookmark,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Headphones,
  FileVideo2,
  Heart,
  History,
  Home as HomeIcon,
  Library,
  ListMusic,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Radio,
  Search,
  Send,
  Settings2,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Subtitles,
  ThumbsUp,
  UserRound,
  Volume2,
  Waves,
  X,
  Zap,
  Trash2,
} from "lucide-react";

const fallbackVideos = [
  {
    id: "M7lc1UVf-VE",
    title: "Immersive sound design · 360° listening session",
    channel: "SurroundTube Sessions",
    channelId: null,
    views: "124 B izlenme",
    age: "2 gün önce",
    duration: "08:42",
    category: "Studio",
    color: "from-cyan-400/40 via-sky-500/20 to-transparent",
  },
  {
    id: "aqz-KE-bpKQ",
    title: "Big Buck Bunny · cinematic reference mix",
    channel: "Blender Foundation",
    channelId: null,
    views: "14 Mn izlenme",
    age: "8 yıl önce",
    duration: "09:56",
    category: "Film",
    color: "from-lime-300/40 via-emerald-400/15 to-transparent",
  },
  {
    id: "ScMzIvxBSi4",
    title: "Night drive / analog synths / city lights",
    channel: "Neon Frequency",
    channelId: null,
    views: "2,8 Mn izlenme",
    age: "3 hafta önce",
    duration: "42:18",
    category: "Music",
    color: "from-fuchsia-400/40 via-violet-500/15 to-transparent",
  },
  {
    id: "ysz5S6PUM-U",
    title: "The craft of recording a live orchestra",
    channel: "Field Notes Audio",
    channelId: null,
    views: "862 B izlenme",
    age: "5 ay önce",
    duration: "18:07",
    category: "Education",
    color: "from-amber-300/40 via-orange-400/15 to-transparent",
  },
];

type Video = (typeof fallbackVideos)[number] & { processedUrl?: string | null; isUploaded?: boolean; mediaId?: number; viewsCount?: number };

type NavItem = { label: string; icon: typeof HomeIcon };
const navItems: NavItem[] = [
  { label: "Ana sayfa", icon: HomeIcon },
  { label: "Keşfet", icon: Compass },
  { label: "Abonelikler", icon: Radio },
];

function durationToLabel(duration?: string | null) {
  if (!duration) return "—";
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;
  const h = Number(match[1] ?? 0);
  const m = String(Number(match[2] ?? 0)).padStart(h ? 2 : 1, "0");
  const s = String(Number(match[3] ?? 0)).padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<Video>(fallbackVideos[0]);
  const [liked, setLiked] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [playing, setPlaying] = useState(false);
  const surroundMode = selectedVideo.isUploaded ? "7.1 Surround" : "YouTube original";
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [comment, setComment] = useState("");
  const [uploadState, setUploadState] = useState<{ status: "idle" | "uploading" | "ready" | "failed"; progress: number; name?: string; message?: string }>({ status: "idle", progress: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const youtubeConnection = trpc.youtube.connection.useQuery(undefined, { enabled: isAuthenticated });
  const youtubeAuthUrl = trpc.youtube.authUrl.useMutation();
  const rateYoutubeVideo = trpc.youtube.rate.useMutation();
  const toggleYoutubeSubscription = trpc.youtube.toggleSubscription.useMutation();
  const createComment = trpc.youtube.comment.useMutation();
  const deleteYoutubeComment = trpc.youtube.deleteComment.useMutation();
  const mediaList = trpc.media.list.useQuery(undefined, { enabled: Boolean(isAuthenticated) });
  const publicMedia = trpc.media.publicList.useQuery();
  const deleteMedia = trpc.media.delete.useMutation();
  const selectedMediaId = selectedVideo.mediaId ?? 0;
  const mediaSocialInput = useMemo(() => ({ id: selectedMediaId }), [selectedMediaId]);
  const mediaSocial = trpc.media.social.useQuery(mediaSocialInput, { enabled: selectedMediaId > 0 });
  const recordMediaView = trpc.media.view.useMutation();
  const toggleMediaLike = trpc.media.like.useMutation();
  const createMediaComment = trpc.media.comment.useMutation();
  const deleteMediaComment = trpc.media.deleteComment.useMutation();
  const trpcUtils = trpc.useUtils();
  const ownedMediaIds = useMemo(() => new Set((mediaList.data ?? []).map((item) => item.id)), [mediaList.data]);
  const channelInput = useMemo(() => ({ channelId: selectedVideo.channelId ?? "" }), [selectedVideo.channelId]);
  const youtubeReady = Boolean(isAuthenticated && youtubeConnection.data?.connected);
  const subscriptionStatus = trpc.youtube.subscriptionStatus.useQuery(channelInput, { enabled: Boolean(youtubeReady && !selectedVideo.isUploaded && selectedVideo.channelId) });
  const youtubeLikeInput = useMemo(() => ({ videoId: selectedVideo.id }), [selectedVideo.id]);
  const youtubeLikeStatus = trpc.youtube.likeStatus.useQuery(youtubeLikeInput, { enabled: Boolean(youtubeReady && !selectedVideo.isUploaded), retry: false });
  const youtubeComments = trpc.youtube.comments.useQuery(youtubeLikeInput, { enabled: Boolean(youtubeReady && !selectedVideo.isUploaded), retry: false });

  const uploadedVideos = useMemo<Video[]>(() => (publicMedia.data ?? []).map((item) => ({
    id: `media-${item.id}`,
    title: item.originalFilename,
    channel: "SurroundTube · 7.1",
    channelId: null,
    views: `${item.viewsCount} görüntülenme`,
    age: "Yeni işlendi",
    duration: "7.1",
    category: "My media",
    color: "from-cyan-400/35 via-blue-500/20 to-transparent",
    processedUrl: item.processedUrl,
    isUploaded: true,
    mediaId: item.id,
    viewsCount: item.viewsCount,
  })), [publicMedia.data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("youtube");
    if (params.get("lab") === "1") setShowSettings(true);
    if (status === "connected") toast.success("YouTube hesabın bağlandı.");
    if (status === "error") toast.error("YouTube hesabı bağlanamadı.");
  }, []);

  useEffect(() => {
    if (selectedMediaId > 0) recordMediaView.mutate({ id: selectedMediaId }, { onSuccess: () => trpcUtils.media.publicList.invalidate() });
  }, [selectedMediaId]);

  useEffect(() => {
    setLiked(selectedVideo.isUploaded ? Boolean(mediaSocial.data?.liked) : Boolean(youtubeLikeStatus.data?.liked));
  }, [selectedVideo.isUploaded, selectedMediaId, mediaSocial.data?.liked, youtubeLikeStatus.data?.liked]);

  useEffect(() => {
    setSubscribed(Boolean(subscriptionStatus.data?.subscribed));
  }, [subscriptionStatus.data?.subscribed, selectedVideo.channelId]);

  const searchQuery = trpc.youtube.search.useQuery(
    { query: submittedQuery, maxResults: 8 },
    { enabled: Boolean(submittedQuery), retry: false },
  );

  const searchResults = useMemo<Video[]>(() => {
    if (!submittedQuery || !searchQuery.data?.items?.length) return fallbackVideos;
    return searchQuery.data.items.map((item: any, index: number) => ({
      id: item.id?.videoId ?? fallbackVideos[index % fallbackVideos.length].id,
      title: item.snippet?.title ?? "YouTube video",
      channel: item.snippet?.channelTitle ?? "YouTube creator",
      channelId: typeof item.snippet?.channelId === "string" ? item.snippet.channelId : null,
      views: "YouTube",
      age: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt).toLocaleDateString("tr-TR") : "—",
      duration: durationToLabel(item.contentDetails?.duration),
      category: index % 2 === 0 ? "Search result" : "YouTube",
      color: fallbackVideos[index % fallbackVideos.length].color,
    }));
  }, [searchQuery.data, submittedQuery]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next = query.trim();
    if (!next) {
      toast.info("Bir arama terimi yazmalısın.");
      return;
    }
    setSubmittedQuery(next);
    toast.success(`“${next}” için arama başlatıldı`);
  };

  const selectVideo = (video: Video) => {
    setSelectedVideo(video);
    setPlaying(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const connectYouTube = () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    youtubeAuthUrl.mutate(undefined, {
      onSuccess: ({ url }) => { window.location.assign(url); },
      onError: (error) => toast.error(error.message),
    });
  };

  const requireYouTube = () => {
    if (!isAuthenticated) {
      toast.info("Önce SurroundTube oturumunu açmalısın.");
      startLogin();
      return false;
    }
    if (!youtubeConnection.data?.connected) {
      toast.info("YouTube hesabını bağlamak için Google yetkilendirmesi açılıyor.");
      connectYouTube();
      return false;
    }
    return true;
  };

  const toggleLike = () => {
    if (selectedVideo.isUploaded) {
      if (!isAuthenticated) { startLogin(); return; }
      toggleMediaLike.mutate({ id: selectedMediaId }, {
        onSuccess: ({ liked: nextLiked }) => {
          setLiked(nextLiked);
          toast.success(nextLiked ? "Video beğenildi" : "Beğeni kaldırıldı");
          trpcUtils.media.social.invalidate(mediaSocialInput);
          trpcUtils.media.publicList.invalidate();
        },
        onError: (error) => toast.error(error.message),
      });
      return;
    }
    if (!requireYouTube()) return;
    setLiked((value) => !value);
    const nextLiked = !liked;
    rateYoutubeVideo.mutate({ videoId: selectedVideo.id, liked: nextLiked }, {
      onSuccess: () => { setLiked(nextLiked); toast.success(nextLiked ? "Video beğenildi" : "Beğeni kaldırıldı"); },
      onError: (error) => toast.error(error.message),
    });
  };

  const handleSubscribe = () => {
    if (!requireYouTube()) return;
    if (!selectedVideo.channelId) {
      toast.info("Bu örnek kartın kanal kimliği yok; gerçek YouTube aramasından bir video seç.");
      return;
    }
    toggleYoutubeSubscription.mutate({ channelId: selectedVideo.channelId }, {
      onSuccess: ({ subscribed: nextSubscribed }) => { setSubscribed(nextSubscribed); toast.success(nextSubscribed ? "Kanala abone olundu." : "Abonelikten çıkıldı."); },
      onError: (error) => toast.error(error.message),
    });
  };

  const submitComment = () => {
    if (!comment.trim()) return;
    if (selectedVideo.isUploaded) {
      if (!isAuthenticated) { startLogin(); return; }
      createMediaComment.mutate({ id: selectedMediaId, text: comment.trim() }, {
        onSuccess: () => { setComment(""); toast.success("Yorum eklendi."); trpcUtils.media.social.invalidate(mediaSocialInput); },
        onError: (error) => toast.error(error.message),
      });
      return;
    }
    if (!requireYouTube()) return;
    createComment.mutate({ videoId: selectedVideo.id, text: comment.trim() }, {
      onSuccess: () => { toast.success("Yorum YouTube'a gönderildi."); setComment(""); },
      onError: (error) => toast.error(error.message),
    });
  };

  const openOwnerFilePicker = () => {
    if (!isAuthenticated) {
      toast.info("Video yüklemek için önce SurroundTube oturumunu açmalısın.");
      startLogin();
      return;
    }
    fileInputRef.current?.click();
  };

  const uploadOwnerVideo = (file: File) => {
    if (file.size > 128 * 1024 * 1024) {
      toast.error("Video 128 MB sınırını aşamaz.");
      return;
    }
    const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
    if (!allowed.includes(file.type)) {
      toast.error("MP4, WebM, MOV veya MKV yükleyebilirsin.");
      return;
    }
    setUploadState({ status: "uploading", progress: 0, name: file.name });
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/owner/media");
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setUploadState((current) => ({ ...current, progress: Math.round((event.loaded / event.total) * 100) }));
    };
    xhr.onload = () => {
      let payload: { status?: string; error?: string } = {};
      try { payload = JSON.parse(xhr.responseText); } catch { /* keep empty payload */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadState({ status: "ready", progress: 100, name: file.name, message: "7.1 sesli çıktı hazır." });
        toast.success("Video işlendi ve 7.1 ses düzeniyle kaydedildi.");
        trpcUtils.media.list.invalidate();
        trpcUtils.media.publicList.invalidate();
      } else {
        setUploadState({ status: "failed", progress: 0, name: file.name, message: payload.error ?? "Video işlenemedi." });
        toast.error(payload.error ?? "Video işlenemedi.");
      }
    };
    xhr.onerror = () => {
      setUploadState({ status: "failed", progress: 0, name: file.name, message: "Ağ hatası." });
      toast.error("Yükleme sırasında ağ hatası oluştu.");
    };
    xhr.send(file);
  };

  const deleteOwnerVideo = (mediaId: number, filename: string) => {
    if (!window.confirm(`“${filename}” videosu silinsin mi?`)) return;
    deleteMedia.mutate({ id: mediaId }, {
      onSuccess: () => {
        toast.success("Video silindi.");
        trpcUtils.media.list.invalidate();
        trpcUtils.media.publicList.invalidate();
        if (selectedVideo.mediaId === mediaId) setSelectedVideo(fallbackVideos[0]);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="min-h-screen bg-[#070a0f] text-white selection:bg-cyan-300 selection:text-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#070a0f]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-5 px-5 lg:px-8">
          <button className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white lg:hidden" aria-label="Menüyü aç">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-fit items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-cyan-300 to-blue-600 shadow-[0_0_35px_rgba(34,211,238,.25)]">
              <Waves className="h-5 w-5 text-slate-950" strokeWidth={2.5} />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#070a0f] bg-lime-300" />
            </div>
            <div className="hidden sm:block">
              <div className="font-display text-[17px] font-semibold tracking-tight">Surround<span className="text-cyan-300">Tube</span></div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/35">listen wider</div>
            </div>
          </div>

          <form onSubmit={handleSearch} className="mx-auto flex w-full max-w-[650px] items-center rounded-2xl border border-white/10 bg-white/[0.055] p-1.5 shadow-inner shadow-black/20">
            <Search className="ml-3 h-4 w-4 text-white/35" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Videoları, kanalları ve listeleri ara"
              className="h-10 border-0 bg-transparent px-3 text-sm text-white placeholder:text-white/30 focus-visible:ring-0"
              aria-label="Video ara"
            />
            <Button type="submit" size="sm" className="h-10 rounded-xl bg-white text-slate-950 hover:bg-cyan-200">
              Ara
            </Button>
          </form>

          <div className="flex min-w-fit items-center gap-1.5">
            <Button variant="ghost" size="icon" className="hidden rounded-xl text-white/55 hover:bg-white/10 hover:text-white sm:inline-flex" onClick={() => toast.info("Bildirimler yakında burada.")} aria-label="Bildirimler">
              <Bell className="h-[18px] w-[18px]" />
            </Button>
            {isAuthenticated ? (
              <button onClick={() => setShowMenu((value) => !value)} className="flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-white/10">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-pink-400 text-xs font-bold text-slate-950">{user?.name?.slice(0, 1) ?? "A"}</div>
                <span className="hidden max-w-24 truncate text-xs text-white/70 lg:block">{user?.name ?? "Hesabım"}</span>
              </button>
            ) : (
              <Button onClick={() => startLogin()} size="sm" className="rounded-xl bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                Oturum aç
              </Button>
            )}
            {showMenu && (
              <div className="absolute right-5 top-[62px] w-48 rounded-2xl border border-white/10 bg-[#131923] p-2 shadow-2xl lg:right-8">
                <button onClick={() => setShowSettings(true)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 hover:bg-white/10"><Settings2 className="h-4 w-4" /> Ayarlar</button>
                <button onClick={() => logout()} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-rose-300 hover:bg-rose-300/10"><X className="h-4 w-4" /> Çıkış yap</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px]">
        <aside className="hidden w-[235px] shrink-0 border-r border-white/[0.06] px-5 py-7 lg:block">
          <nav className="space-y-1">
            {navItems.map(({ label, icon: Icon }, index) => (
              <button key={label} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${index === 0 ? "bg-white/[0.1] text-white" : "text-white/50 hover:bg-white/[0.06] hover:text-white"}`}>
                <Icon className={`h-[18px] w-[18px] ${index === 0 ? "text-cyan-300" : ""}`} />
                {label}
                {index === 2 && <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/45">12</span>}
              </button>
            ))}
          </nav>
          <div className="my-8 h-px bg-white/[0.07]" />
          <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Senin alanın</div>
          <nav className="space-y-1">
            {[{ label: "Kitaplık", icon: Library }, { label: "Geçmiş", icon: History }, { label: "Oynatma listeleri", icon: ListMusic }].map(({ label, icon: Icon }) => (
              <button key={label} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/50 transition hover:bg-white/[0.06] hover:text-white"><Icon className="h-[18px] w-[18px]" />{label}</button>
            ))}
          </nav>
          <div className="mt-10 rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/[0.09] to-blue-500/[0.03] p-4">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-300"><Headphones className="h-4 w-4" /></div>
            <p className="text-xs font-semibold text-white/85">Spatial Lab</p>
            <p className="mt-1 text-[11px] leading-5 text-white/40">Kendi lisanslı stem dosyalarınla 7.1 mikslerini yönet.</p>
            <button onClick={() => setShowSettings(true)} className="mt-3 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200">Laboratuvarı aç →</button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-6 lg:px-9 lg:py-8">
          <section className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[#101721] p-6 sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-170px] left-[35%] h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_0.92fr] lg:items-center">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200"><Sparkles className="h-3.5 w-3.5" /> 7.1 listening, done right</div>
                <h1 className="max-w-[650px] font-display text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl lg:text-[64px]">Dinlemeyi değil,<br /><span className="bg-gradient-to-r from-cyan-200 via-white to-blue-300 bg-clip-text text-transparent">uzayı aç.</span></h1>
                <p className="mt-5 max-w-[500px] text-sm leading-6 text-white/50 sm:text-base">YouTube keşfini, üretici dostu bir ses deneyimiyle birleştir. Videoları YouTube’un kendi oynatıcında izle; lisanslı projelerini gerçek stem ayrımıyla Spatial Lab’da genişlet.</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button onClick={() => document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200"><Play className="mr-2 h-4 w-4 fill-current" /> Keşfe başla</Button>
                  <Button onClick={() => setShowSettings(true)} variant="outline" className="rounded-xl border-white/15 bg-white/[0.04] px-5 text-sm text-white hover:bg-white/10 hover:text-white"><Headphones className="mr-2 h-4 w-4 text-cyan-300" /> Spatial Lab</Button>
                </div>
                <div className="mt-8 flex items-center gap-6 text-[11px] text-white/35"><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-lime-300" /> YouTube policy-aware</span><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-lime-300" /> Creator-safe</span></div>
              </div>
              <div className="relative mx-auto w-full max-w-[520px]">
                <div className="absolute -inset-3 rounded-[24px] bg-cyan-300/10 blur-xl" />
                <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[#080d13] shadow-2xl">
                  <div className={`relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br ${selectedVideo.color}`}>
                    <div className="absolute inset-0 opacity-35" style={{ backgroundImage: "radial-gradient(circle at 30% 20%, white 0 1px, transparent 1px), radial-gradient(circle at 75% 60%, white 0 1px, transparent 1px)", backgroundSize: "74px 74px, 112px 112px" }} />
                    <div className="absolute left-5 top-5 flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5 text-[10px] font-semibold text-white/75 backdrop-blur"><span className="h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_8px_#bef264]" /> LIVE MIX</div>
                    <button onClick={() => setPlaying((value) => !value)} className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_0_0_10px_rgba(255,255,255,.12)] transition hover:scale-105" aria-label={playing ? "Durdur" : "Oynat"}>{playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-1 h-6 w-6 fill-current" />}</button>
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between"><div><div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">Now exploring</div><div className="max-w-[250px] truncate text-sm font-medium">{selectedVideo.title}</div></div><div className="rounded-md bg-black/40 px-2 py-1 text-[10px] text-white/70">{selectedVideo.duration}</div></div>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-3"><div className="flex items-center gap-2"><div className="flex gap-0.5">{[0, 1, 2, 3, 4, 5, 6].map((bar) => <span key={bar} className="w-1 rounded-full bg-cyan-300/70" style={{ height: `${10 + ((bar * 7) % 15)}px` }} />)}</div><span className="ml-2 text-[10px] font-semibold tracking-[0.16em] text-cyan-200/70">ORIGINAL PLAYER</span></div><span className="text-[10px] text-white/35">Spatial Lab ready</span></div>
                </div>
              </div>
            </div>
          </section>

          {uploadedVideos.length > 0 && <section className="mt-10"><div className="mb-5 flex items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300"><FileVideo2 className="h-3.5 w-3.5" /> İşlenen videolar</div><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-white">Topluluğun 7.1 arşivi</h2></div><span className="text-[11px] text-white/35">Kaynak 7.1 · cihazda otomatik downmix</span></div><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{uploadedVideos.map((video) => <article key={video.id} className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 transition hover:border-cyan-300/30" onClick={() => selectVideo(video)}><div className="relative overflow-hidden rounded-xl bg-black"><video src={video.processedUrl ?? undefined} className="aspect-video w-full object-cover" controls preload="metadata" onClick={(event) => event.stopPropagation()} /><div className="absolute left-2 top-2 rounded-md bg-cyan-300/90 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-950">7.1</div></div><div className="mt-3 flex items-start gap-2"><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-medium text-white/85">{video.title}</h3><p className="mt-1 text-[11px] text-white/35">{video.channel}</p><p className="mt-0.5 text-[11px] text-white/30">{video.views}</p></div>{isAuthenticated && video.mediaId && ownedMediaIds.has(video.mediaId) && <button onClick={(event) => { event.stopPropagation(); deleteOwnerVideo(video.mediaId!, video.title); }} className="rounded-lg p-2 text-white/35 transition hover:bg-rose-300/10 hover:text-rose-300" aria-label="Videoyu sil"><Trash2 className="h-4 w-4" /></button>}</div></article>)}</div></section>}

          <section id="feed" className="mt-10">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300"><Zap className="h-3.5 w-3.5" /> {submittedQuery ? "Arama sonuçları" : "Senin için seçtik"}</div><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-white">Bugünün sesleri</h2></div><button onClick={() => toast.info("Daha fazla keşif yakında.")} className="flex items-center gap-1 text-xs font-medium text-white/45 transition hover:text-cyan-200">Tümünü gör <ChevronRight className="h-4 w-4" /></button></div>
            {submittedQuery && searchQuery.isLoading && <div className="mb-4 rounded-xl border border-cyan-300/15 bg-cyan-300/5 px-4 py-3 text-xs text-cyan-100/70">YouTube araması getiriliyor…</div>}
            {submittedQuery && searchQuery.isError && <div className="mb-4 rounded-xl border border-amber-300/15 bg-amber-300/5 px-4 py-3 text-xs text-amber-100/70">API anahtarı bağlanmadan örnek keşif akışı gösteriliyor. Secret eklendiğinde gerçek YouTube sonuçları gelecektir.</div>}
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {searchResults.map((video, index) => <article key={`${video.id}-${index}`} className="group cursor-pointer" onClick={() => selectVideo(video)}>
                <div className={`relative aspect-video overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br ${video.color} transition duration-300 group-hover:-translate-y-1 group-hover:border-cyan-300/30 group-hover:shadow-[0_15px_40px_rgba(0,0,0,.35)]`}>
                  <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55 mix-blend-screen transition duration-500 group-hover:scale-105 group-hover:opacity-75" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
                  <div className="absolute left-3 top-3 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/75 backdrop-blur">{video.category}</div>
                  <div className="absolute bottom-3 right-3 rounded-md bg-black/70 px-1.5 py-1 text-[10px] text-white/80">{video.duration}</div>
                  <button className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-950 opacity-0 shadow-lg transition group-hover:opacity-100" aria-label="Videoyu seç"><Play className="ml-0.5 h-4 w-4 fill-current" /></button>
                </div>
                <div className="mt-3 flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-[10px] font-bold text-white/80">{video.channel.slice(0, 1)}</div><div className="min-w-0"><h3 className="line-clamp-2 text-sm font-medium leading-5 text-white/85 transition group-hover:text-cyan-100">{video.title}</h3><p className="mt-1 truncate text-[11px] text-white/40">{video.channel}</p><p className="mt-0.5 text-[11px] text-white/30">{video.views} · {video.age}</p></div><button onClick={(event) => { event.stopPropagation(); toast.info("Video menüsü yakında."); }} className="ml-auto h-6 shrink-0 text-white/30 hover:text-white" aria-label="Daha fazla"><MoreHorizontal className="h-4 w-4" /></button></div>
              </article>)}
            </div>
          </section>

          <section className="mt-12 grid gap-6 xl:grid-cols-[1fr_340px]">
            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0f151e]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35"><Volume2 className="h-3.5 w-3.5 text-cyan-300" /> Oynatma alanı</div><h3 className="mt-1 max-w-[500px] truncate text-base font-semibold text-white">{selectedVideo.title}</h3></div><div className="flex items-center gap-1"><Button onClick={toggleLike} variant="ghost" size="sm" className={`rounded-lg text-xs ${liked ? "text-cyan-200 hover:text-cyan-100" : "text-white/50 hover:text-white"}`}><ThumbsUp className={`mr-1.5 h-4 w-4 ${liked ? "fill-cyan-300" : ""}`} /> {liked ? "Beğenildi" : "Beğen"}{selectedVideo.isUploaded && mediaSocial.data ? ` · ${mediaSocial.data.likeCount}` : ""}</Button><Button onClick={() => setSaved((value) => !value)} variant="ghost" size="sm" className={`rounded-lg text-xs ${saved ? "text-cyan-200 hover:text-cyan-100" : "text-white/50 hover:text-white"}`}><Bookmark className={`mr-1.5 h-4 w-4 ${saved ? "fill-cyan-300" : ""}`} /> Kaydet</Button><Button onClick={() => toast.success("Paylaşım bağlantısı hazırlandı.")} variant="ghost" size="sm" className="rounded-lg text-xs text-white/50 hover:text-white"><Share2 className="mr-1.5 h-4 w-4" /> Paylaş</Button></div></div>
              <div className="grid gap-0 lg:grid-cols-[1fr_245px]">
                <div className="aspect-video bg-black">{selectedVideo.isUploaded && selectedVideo.processedUrl ? <video className="h-full w-full" src={selectedVideo.processedUrl} controls playsInline preload="metadata" /> : <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${selectedVideo.id}?rel=0&modestbranding=1`} title={selectedVideo.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />}</div>
                <div className="border-t border-white/[0.07] p-5 lg:border-l lg:border-t-0"><div className="flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Ses modu</div><div className="mt-1 text-sm font-semibold text-white">{surroundMode}</div></div><SlidersHorizontal className="h-4 w-4 text-cyan-300" /></div><div className="mt-5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-3 text-xs text-cyan-100"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />7.1 Surround zorunlu</div><p className="mt-2 text-[10px] leading-4 text-cyan-100/60">Cihaz 7.1 desteklemiyorsa işletim sistemi veya tarayıcı otomatik downmix yapar; kaynak her zaman 7.1 kalır.</p></div><p className="mt-5 text-[10px] leading-4 text-white/30">YouTube videolarında orijinal kaynak ve oynatıcı korunur. Yüklediğin lisanslı videolar 7.1 AAC olarak işlenir.</p></div>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-600 text-xs font-bold text-slate-950">{selectedVideo.channel.slice(0, 1)}</div><div><div className="text-sm font-medium text-white">{selectedVideo.channel}</div><div className="text-[11px] text-white/35">YouTube creator</div></div><Button onClick={handleSubscribe} size="sm" className="ml-2 rounded-lg bg-white text-[11px] font-semibold text-slate-950 hover:bg-cyan-200">{subscribed ? "Abonelikten çık" : "Abone ol"}</Button></div><div className="hidden items-center gap-3 text-[11px] text-white/35 sm:flex"><span>Orijinal video</span><a className="text-cyan-300 hover:text-cyan-200" href={`https://www.youtube.com/watch?v=${selectedVideo.id}`} target="_blank" rel="noreferrer">YouTube’da aç ↗</a></div></div>
            </div>

            <aside className="rounded-[22px] border border-cyan-300/15 bg-gradient-to-br from-[#12202a] to-[#0c1017] p-5"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200"><Waves className="h-3.5 w-3.5" /> Spatial Lab</div><h3 className="mt-2 text-lg font-semibold text-white">Stem’lerini genişlet.</h3></div><div className="rounded-xl bg-cyan-300/10 p-2 text-cyan-200"><Headphones className="h-4 w-4" /></div></div><p className="mt-3 text-xs leading-5 text-white/45">Davul, bas, vokal ve ambiyansı ayrı kanallarla yükle. Hoparlör düzenini seç, miksini tarayıcıda kontrol et.</p><div className="mt-5 grid grid-cols-4 gap-1.5">{["L", "R", "C", "LFE", "Ls", "Rs", "Lb", "Rb"].map((channel, index) => <div key={channel} className={`rounded-lg border p-2 text-center ${index < 2 ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-white/35"}`}><div className="mx-auto mb-1 h-1.5 w-1.5 rounded-full bg-current" /><div className="text-[9px] font-bold">{channel}</div></div>)}</div><Button onClick={() => setShowSettings(true)} variant="outline" className="mt-5 w-full rounded-xl border-cyan-300/20 bg-cyan-300/[0.06] text-xs text-cyan-100 hover:bg-cyan-300/15 hover:text-white"><Settings2 className="mr-2 h-3.5 w-3.5" /> Projeyi yapılandır</Button></aside>
          </section>

          <section className="mt-6 rounded-[22px] border border-white/10 bg-[#0f151e] p-5"><div className="mb-4 flex items-center gap-2"><MessageCircle className="h-4 w-4 text-cyan-300" /><h3 className="text-sm font-semibold text-white">Yorumlar</h3><span className="text-[11px] text-white/30">{selectedVideo.isUploaded ? ((mediaSocial.data?.comments.length ?? 0) + " yorum") : "YouTube yorumları"}</span></div><div className="flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-white/60"><UserRound className="h-4 w-4" /></div><div className="flex min-w-0 flex-1 gap-2"><Input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitComment(); }} placeholder={selectedVideo.isUploaded ? "Yorumunu yaz…" : "Yorum eklemek için YouTube’da oturum aç…"} className="h-9 border-white/10 bg-white/[0.04] text-xs text-white placeholder:text-white/30 focus-visible:ring-cyan-300/30" /><Button onClick={submitComment} size="icon" className="h-9 w-9 shrink-0 rounded-lg bg-cyan-300 text-slate-950 hover:bg-cyan-200" aria-label="Yorum gönder"><Send className="h-3.5 w-3.5" /></Button></div></div>{selectedVideo.isUploaded && Boolean(mediaSocial.data?.comments.length) && <div className="mt-5 space-y-3">{mediaSocial.data?.comments.map((item) => <div key={item.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="flex items-center justify-between gap-3"><span className="text-[11px] font-medium text-cyan-100/80">{item.userName}</span>{item.canDelete && <button onClick={() => deleteMediaComment.mutate({ commentId: item.id }, { onSuccess: () => { toast.success("Yorum silindi."); trpcUtils.media.social.invalidate(mediaSocialInput); }, onError: (error) => toast.error(error.message) })} className="text-white/30 hover:text-rose-300" aria-label="Yorumu sil"><Trash2 className="h-3.5 w-3.5" /></button>}</div><p className="mt-1 text-xs leading-5 text-white/60">{item.text}</p></div>)}</div>}{!selectedVideo.isUploaded && Boolean(youtubeComments.data?.length) && <div className="mt-5 space-y-3">{youtubeComments.data?.map((item) => <div key={item.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="flex items-center justify-between gap-3"><span className="text-[11px] font-medium text-cyan-100/80">{item.userName}</span><button onClick={() => deleteYoutubeComment.mutate({ commentId: item.id }, { onSuccess: () => { toast.success("YouTube yorumu silindi."); trpcUtils.youtube.comments.invalidate(youtubeLikeInput); }, onError: (error) => toast.error(error.message) })} className="text-white/30 hover:text-rose-300" aria-label="YouTube yorumunu sil"><Trash2 className="h-3.5 w-3.5" /></button></div><p className="mt-1 text-xs leading-5 text-white/60">{item.text}</p></div>)}</div>}</section>

          <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] py-6 text-[10px] text-white/25"><div>© 2026 SurroundTube · YouTube API Services uyumlu deneyim</div><div className="flex gap-4"><button onClick={() => toast.info("Gizlilik politikası hazırlanıyor.")} className="hover:text-white/60">Gizlilik</button><button onClick={() => toast.info("Kullanım koşulları hazırlanıyor.")} className="hover:text-white/60">Koşullar</button><button onClick={() => toast.info("Yardım merkezi yakında.")} className="flex items-center gap-1 hover:text-white/60"><CircleHelp className="h-3 w-3" /> Yardım</button></div></footer>
        </main>
      </div>

      {showSettings && <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/60 p-0 backdrop-blur-sm sm:p-5"><div className="h-full w-full max-w-[440px] overflow-y-auto border-l border-white/10 bg-[#0d131b] p-6 shadow-2xl sm:h-auto sm:max-h-[calc(100vh-40px)] sm:rounded-[24px] sm:border"><div className="flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Spatial Lab / Settings</div><h2 className="mt-2 text-xl font-semibold text-white">Ses alanını kur</h2></div><button onClick={() => setShowSettings(false)} className="rounded-xl p-2 text-white/45 hover:bg-white/10 hover:text-white" aria-label="Kapat"><X className="h-5 w-5" /></button></div><div className="mt-7 space-y-5"><div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4"><div className="flex gap-3"><Subtitles className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" /><p className="text-xs leading-5 text-amber-100/65">YouTube videolarının ses parçalarını ayırmak veya alternatif ses eklemek YouTube API politikalarıyla yasaktır. Bu panel sadece sana ait veya açık lisanslı stem’ler için kullanılacaktır.</p></div></div><div><label className="text-xs font-medium text-white/70">Hoparlör düzeni</label><div className="mt-2 grid grid-cols-3 gap-2"><div className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-xs text-cyan-100"><div className="flex items-center justify-between"><span>7.1 Surround</span><span className="rounded bg-cyan-300/15 px-1.5 py-0.5 text-[9px] text-cyan-200">zorunlu</span></div><p className="mt-2 text-[10px] leading-4 text-cyan-100/60">Stereo seçilemez. 7.1 desteklenmeyen cihazlarda otomatik downmix yapılır.</p></div></div></div><div><label className="text-xs font-medium text-white/70">Dinamik aralık</label><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[72%] rounded-full bg-gradient-to-r from-cyan-300 to-blue-500" /></div><div className="mt-2 flex justify-between text-[10px] text-white/30"><span>Sinematik</span><span>72%</span><span>Stüdyo</span></div></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center gap-2 text-sm text-white"><LockIcon /> Licensed project mode</div><p className="mt-2 text-[11px] leading-5 text-white/35">Kendi ses dosyalarını yüklediğinde L/R/C/LFE/Ls/Rs/Lb/Rb kanallarını ayrı ayrı izleyebileceğin üretim alanı.</p><input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) uploadOwnerVideo(file); }} />
                  <Button onClick={openOwnerFilePicker} className="mt-4 w-full rounded-xl bg-white text-xs text-slate-950 hover:bg-cyan-200"><FileVideo2 className="mr-2 h-3.5 w-3.5" /> Videoyu seç ve işle</Button>
                  <p className="mt-2 text-[10px] leading-4 text-white/30">Her giriş yapmış hesap yükleyebilir. MP4/WebM/MOV/MKV · maksimum 128 MB.</p>
                  {uploadState.status !== "idle" && <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-center justify-between text-[11px] text-white/70"><span className="truncate">{uploadState.name}</span><span>{uploadState.status === "uploading" ? ("%" + uploadState.progress) : uploadState.status === "ready" ? "Hazır" : "Hata"}</span></div>{uploadState.status === "uploading" && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: "%" + uploadState.progress }} /></div>}{uploadState.message && <p className="mt-2 text-[10px] text-cyan-100/60">{uploadState.message}</p>}</div>}
                  {Boolean(mediaList.data?.length) && <div className="mt-4 space-y-2"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">İşlenmiş projelerin</div>{mediaList.data?.slice(0, 3).map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-center gap-2"><FileVideo2 className="h-3.5 w-3.5 shrink-0 text-cyan-300" /><span className="min-w-0 flex-1 truncate text-[11px] text-white/70">{item.originalFilename}</span><span className={"text-[9px] uppercase tracking-wider " + (item.status === "ready" ? "text-lime-300" : item.status === "failed" ? "text-rose-300" : "text-amber-200")}>{item.status === "ready" ? "7.1 hazır" : item.status === "failed" ? "hata" : "işleniyor"}</span></div>{item.status === "ready" && item.processedUrl && <video className="mt-2 w-full rounded-lg" src={item.processedUrl} controls preload="metadata" />}</div>)}</div>}</div></div></div></div>}
    </div>
  );
}

function LockIcon() {
  return <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-lime-300/10 text-lime-300"><Check className="h-3.5 w-3.5" /></span>;
}
