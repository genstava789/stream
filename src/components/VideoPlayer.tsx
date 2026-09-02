'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertCircle,
  Flag,
  CheckCircle2,
  RotateCcw,
  Play,
  X,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cleanVideoUrl } from '@/lib/urls';
import 'plyr/dist/plyr.css';

export interface SubtitleTrackItem {
  src: string;
  label?: string;
  srcLang?: string;
  default?: boolean;
}

export type SubtitlesProp =
  | string
  | SubtitleTrackItem
  | SubtitleTrackItem[]
  | null
  | undefined;

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  poster?: string;
  subtitles?: SubtitlesProp;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  nextEpisodeTitle?: string;
  prevEpisodeTitle?: string;
}

interface DetectedSubtitle {
  id: string | number;
  label: string;
  language: string;
  type: 'native' | 'hls' | 'external' | 'mkv';
  trackIndex?: number;
  trackNumber?: number;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match && match[1] ? match[1] : null;
}

function getVimeoId(url: string): string | null {
  const match = url.match(/(?:vimeo\.com\/)(\d+)/);
  return match && match[1] ? match[1] : null;
}

function formatSeconds(sec: number): string {
  const totalSeconds = Math.floor(sec);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

function getLanguageLabel(code?: string, name?: string): string {
  if (name && name.trim()) {
    if (code) return `${name} (${code.toUpperCase()})`;
    return name;
  }
  if (!code) return 'Subtitel';
  const c = code.toLowerCase();
  const map: Record<string, string> = {
    ind: 'Indonesia',
    id: 'Indonesia',
    in: 'Indonesia',
    eng: 'English',
    en: 'English',
    may: 'Melayu',
    msa: 'Melayu',
    ms: 'Melayu',
    tha: 'Thai',
    th: 'Thai',
    vie: 'Vietnam',
    vi: 'Vietnam',
    chi: 'Mandarin (Tionghoa)',
    zho: 'Mandarin (Tionghoa)',
    zh: 'Mandarin (Tionghoa)',
    jpn: 'Jepang',
    ja: 'Jepang',
    kor: 'Korea',
    ko: 'Korea',
    spa: 'Spanyol',
    es: 'Spanyol',
    ara: 'Arab',
    ar: 'Arab',
    fre: 'Prancis',
    fra: 'Prancis',
    fr: 'Prancis',
    ger: 'Jerman',
    deu: 'Jerman',
    de: 'Jerman',
    por: 'Portugis',
    pt: 'Portugis',
    rus: 'Rusia',
    ru: 'Rusia',
    ita: 'Italia',
    it: 'Italia',
  };
  return map[c] || `Subtitel (${code.toUpperCase()})`;
}

function cleanSubtitleText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\{[^}]+\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\\N/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();
}

function srtToVtt(srtText: string): string {
  const text = srtText.replace(/\r\n|\r/g, '\n').trim();
  let vtt = 'WEBVTT\n\n';
  const converted = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return vtt + converted;
}

export default function VideoPlayer({
  videoUrl,
  title,
  poster,
  subtitles,
  onNextEpisode,
  onPrevEpisode,
  nextEpisodeTitle,
  prevEpisodeTitle,
}: VideoPlayerProps) {
  const [hasError, setHasError] = useState(false);
  const [reported, setReported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [resumeTime, setResumeTime] = useState<number | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  // Next episode prompt state
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const [nextCountdown, setNextCountdown] = useState(8);
  const [isMounted, setIsMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerInstanceRef = useRef<any>(null);
  const hlsInstanceRef = useRef<any>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const effectiveVideoUrl = cleanVideoUrl(videoUrl) || videoUrl || '';
  const onNextEpisodeRef = useRef(onNextEpisode);
  onNextEpisodeRef.current = onNextEpisode;
  const onPrevEpisodeRef = useRef(onPrevEpisode);
  onPrevEpisodeRef.current = onPrevEpisode;
  const youtubeId = getYouTubeId(effectiveVideoUrl);
  const vimeoId = getVimeoId(effectiveVideoUrl);

  const storageKey =
    typeof window !== 'undefined' && effectiveVideoUrl
      ? `filmes_progress_${encodeURIComponent(effectiveVideoUrl.split('?')[0])}`
      : null;

  const mkvTracksMapRef = useRef<Map<number, TextTrack>>(new Map());

  // Helper to normalize subtitle prop into array
  const normalizeSubtitles = useCallback((): SubtitleTrackItem[] => {
    if (!subtitles) return [];
    if (typeof subtitles === 'string') {
      const isId = subtitles.toLowerCase().includes('id') || subtitles.toLowerCase().includes('indo');
      return [
        {
          src: subtitles,
          label: isId ? 'Indonesia' : 'Subtitles',
          srcLang: isId ? 'id' : 'en',
          default: true,
        },
      ];
    }
    if (Array.isArray(subtitles)) {
      return subtitles;
    }
    if (typeof subtitles === 'object' && subtitles.src) {
      return [subtitles];
    }
    return [];
  }, [subtitles]);

  const extSubs = normalizeSubtitles();
  const isHls = effectiveVideoUrl.includes('.m3u8');
  const isMkv = effectiveVideoUrl.toLowerCase().includes('.mkv') || effectiveVideoUrl.includes('matroska');

  // Main video player initialization effect - RUNS IMMEDIATELY on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (youtubeId || vimeoId) return;

    let isCancelled = false;
    const abortController = new AbortController();

    setIsMounted(true);
    setHasError(false);
    setReported(false);
    setIsPlaying(false);
    setIsBuffering(false);
    setShowResumePrompt(false);
    setShowNextPrompt(false);
    setResumeTime(null);

    // Check saved playback progress
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = parseFloat(saved);
          if (!isNaN(parsed) && parsed > 5) {
            setResumeTime(parsed);
            setShowResumePrompt(true);
          }
        }
      } catch (e) {
        console.error('Failed to read playback progress:', e);
      }
    }

    const videoElement = videoRef.current;
    if (!videoElement) return;

    const onWaiting = () => {
      if (!isCancelled) setIsBuffering(true);
    };

    const onError = () => {
      if (!isCancelled) setHasError(true);
    };

    const onPlaying = () => {
      if (!isCancelled) {
        setIsBuffering(false);
        setIsPlaying(true);
        // Requirement: dismiss continue watching popup on playback start
        setShowResumePrompt(false);
      }
    };

    videoElement.addEventListener('error', onError);
    videoElement.addEventListener('waiting', onWaiting);
    videoElement.addEventListener('playing', onPlaying);

    // Scan native HTML5 TextTracks & HLS subtitle tracks
    const scanSubtitleTracks = (hlsInstance?: any) => {
      if (isCancelled || !videoElement) return;
      const found: DetectedSubtitle[] = [];

      // 1. Check external and native softcoded TextTracks in HTML5 video
      if (videoElement.textTracks && videoElement.textTracks.length > 0) {
        for (let i = 0; i < videoElement.textTracks.length; i++) {
          const track = videoElement.textTracks[i];
          if (track.kind === 'subtitles' || track.kind === 'captions') {
            const label =
              track.label ||
              (track.language ? getLanguageLabel(track.language) : `Track ${i + 1}`);
            found.push({
              id: `native-${i}`,
              label,
              language: track.language || 'id',
              type: 'native',
              trackIndex: i,
            });
          }
        }
      }

      // 2. Check HLS subtitle tracks
      if (hlsInstance && hlsInstance.subtitleTracks && hlsInstance.subtitleTracks.length > 0) {
        hlsInstance.subtitleTracks.forEach((track: any, idx: number) => {
          const label = track.name || (track.lang ? getLanguageLabel(track.lang) : `Sub ${idx + 1}`);
          found.push({
            id: `hls-${idx}`,
            label,
            language: track.lang || 'id',
            type: 'hls',
            trackIndex: idx,
          });
        });
      }

      // Auto-enable Indonesian caption by default on HLS
      if (found.length > 0) {
        const indoTrack = found.find(
          (t) =>
            t.language === 'ind' ||
            t.language === 'id' ||
            t.label.toLowerCase().includes('indo')
        );
        const chosen = indoTrack || found[0];
        if (chosen && chosen.type === 'hls' && typeof chosen.trackIndex === 'number' && hlsInstance) {
          try {
            hlsInstance.subtitleTrack = chosen.trackIndex;
          } catch (e) {}
        }
      }
    };

    const onLoadedMetadata = () => {
      scanSubtitleTracks(hlsInstanceRef.current);
    };

    videoElement.addEventListener('loadedmetadata', onLoadedMetadata);

    if (videoElement.textTracks) {
      videoElement.textTracks.addEventListener('addtrack', () => {
        scanSubtitleTracks(hlsInstanceRef.current);
      });
    }

    // ── MKV EMBEDDED SOFTCODED SUBTITLES STREAMING DEMUXER (from commit cc9fab1) ──
    const initMkvDemuxer = async () => {
      if (!isMkv) return;
      try {
        const { SubtitleParser } = await import('matroska-subtitles');
        if (isCancelled) return;

        const parser = new SubtitleParser();

        parser.once('tracks', (tracks: any[]) => {
          if (isCancelled || !videoRef.current) return;
          const mkvDetected: DetectedSubtitle[] = [];

          const hasIndo = tracks.some((t) => {
            const l = (t.language || '').toLowerCase();
            const n = (t.name || '').toLowerCase();
            return l === 'ind' || l === 'id' || n.includes('indo');
          });

          tracks.forEach((t) => {
            const trackNumber = t.number;
            const rawLang = (t.language || '').toLowerCase();
            const rawName = (t.name || '').toLowerCase();

            const isId = rawLang === 'ind' || rawLang === 'id' || rawName.includes('indo');
            const isEn = rawLang === 'eng' || rawLang === 'en' || rawName.includes('eng') || (!rawLang && hasIndo);

            const langCode = isId ? 'id' : isEn ? 'en' : (rawLang || 'und');
            const langLabel = t.name || (isId ? 'Bahasa Indonesia' : isEn ? 'English' : getLanguageLabel(langCode, t.name));

            if (videoRef.current) {
              try {
                const textTrack = videoRef.current.addTextTrack(
                  'subtitles',
                  langLabel,
                  langCode
                );
                textTrack.mode = 'hidden';
                mkvTracksMapRef.current.set(trackNumber, textTrack);
              } catch (e) {
                console.error('Failed to addTextTrack for MKV subtitle:', e);
              }
            }

            mkvDetected.push({
              id: `mkv-${trackNumber}`,
              label: langLabel,
              language: langCode,
              type: 'mkv',
              trackNumber,
            });
          });

          // Auto-enable Indonesian subtitle by default if available, or first track
          if (mkvDetected.length > 0) {
            const indoTrack = mkvDetected.find(
              (t) =>
                t.language === 'ind' ||
                t.language === 'id' ||
                t.label.toLowerCase().includes('indo')
            );
            const chosen = indoTrack || mkvDetected[0];
            if (chosen && chosen.trackNumber) {
              const target = mkvTracksMapRef.current.get(chosen.trackNumber);
              if (target) {
                target.mode = 'showing';
              }
            }
          }

          // Register newly added text tracks in Plyr
          if (playerInstanceRef.current && (playerInstanceRef.current as any).captions) {
            try {
              (playerInstanceRef.current as any).captions.setup();
            } catch (e) {}
          }
        });

        parser.on('subtitle', (sub: any, trackNumber: number) => {
          if (isCancelled) return;
          const targetTrack = mkvTracksMapRef.current.get(trackNumber);
          if (targetTrack && typeof sub.time === 'number') {
            const startSec = sub.time / 1000;
            const endSec = Math.max(startSec + 0.5, (sub.time + (sub.duration || 3000)) / 1000);
            const cleanText = cleanSubtitleText(sub.text);
            if (cleanText && endSec > startSec) {
              try {
                const cue = new VTTCue(startSec, endSec, cleanText);
                targetTrack.addCue(cue);
              } catch (e) {}
            }
          }
        });

        // Fetch streaming chunks directly from MKV file (works universally for any S3 bucket)
        const res = await fetch(effectiveVideoUrl, {
          signal: abortController.signal,
        });

        if (res.body) {
          const reader = res.body.getReader();
          while (!isCancelled) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              parser.write(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.log('MKV subtitle stream complete or handled:', err?.message);
        }
      }
    };

    const initModules = async () => {
      try {
        if (isHls) {
          const HlsModule = (await import('hls.js')).default;
          if (HlsModule.isSupported() && !isCancelled && videoElement) {
            const hls = new HlsModule({
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 90,
            });
            hls.loadSource(effectiveVideoUrl);
            hls.attachMedia(videoElement);

            hls.on(HlsModule.Events.SUBTITLE_TRACKS_UPDATED, () => {
              scanSubtitleTracks(hls);
            });

            hls.on(HlsModule.Events.MANIFEST_PARSED, () => {
              scanSubtitleTracks(hls);
            });

            hls.on(HlsModule.Events.ERROR, (_: any, data: any) => {
              if (data.fatal) {
                switch (data.type) {
                  case HlsModule.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad();
                    break;
                  case HlsModule.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    if (!isCancelled) setHasError(true);
                    hls.destroy();
                    break;
                }
              }
            });

            hlsInstanceRef.current = hls;
          }
        }

        const PlyrModule = (await import('plyr')).default;
        if (isCancelled || !videoRef.current) return;

        const player = new PlyrModule(videoRef.current, {
          controls: [
            'play-large',
            'play',
            'rewind',
            'fast-forward',
            'progress',
            'current-time',
            'duration',
            'mute',
            'volume',
            'captions',
            'settings',
            'pip',
            'fullscreen',
          ],
          settings: ['captions', 'quality', 'speed', 'loop'],
          captions: {
            active: true,
            language: 'id',
            update: false,
          },
          seekTime: 10,
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
          keyboard: { focused: true, global: true },
          tooltips: { controls: true, seek: true },
          fullscreen: { enabled: true, fallback: true, iosNative: true },
        });

        player.on('canplay', () => {
          setIsBuffering(false);
        });

        player.on('canplaythrough', () => {
          setIsBuffering(false);
        });

        // Direct Play in Player Dismisses Continue Watching Prompt
        player.on('play', () => {
          setIsPlaying(true);
          setIsBuffering(false);
          setShowResumePrompt(false);
        });

        player.on('playing', () => {
          setIsPlaying(true);
          setIsBuffering(false);
          setShowResumePrompt(false);
        });

        player.on('seeking', () => {
          setShowResumePrompt(false);
        });

        player.on('seeked', () => {
          setIsBuffering(false);
        });

        player.on('pause', () => {
          setIsPlaying(false);
          setIsBuffering(false);
        });

        player.on('waiting', () => {
          if (videoRef.current && videoRef.current.paused) {
            setIsBuffering(true);
          }
        });

        // Track and persist playback progress
        player.on('timeupdate', () => {
          setIsBuffering(false);
          const cur = Math.floor(player.currentTime);
          const dur = Math.floor(player.duration || 0);

          if (cur > 5 && (dur === 0 || cur < dur - 10)) {
            if (Math.abs(cur - lastSavedTimeRef.current) >= 3 && storageKey) {
              lastSavedTimeRef.current = cur;
              try {
                localStorage.setItem(storageKey, String(cur));
              } catch (e) {}
            }
          }
        });

        player.on('ended', () => {
          setIsPlaying(false);
          setShowResumePrompt(false);
          if (storageKey) {
            try {
              localStorage.removeItem(storageKey);
            } catch (e) {}
          }

          // Trigger next episode prompt if handler is available
          if (onNextEpisodeRef.current) {
            setShowNextPrompt(true);
            setNextCountdown(8);
          }
        });

        player.on('languagechange', () => {
          const currentTrackIndex = (player as any).currentTrack;
          if (videoRef.current && videoRef.current.textTracks) {
            for (let i = 0; i < videoRef.current.textTracks.length; i++) {
              videoRef.current.textTracks[i].mode = (i === currentTrackIndex) ? 'showing' : 'hidden';
            }
          }
        });

        playerInstanceRef.current = player;
        scanSubtitleTracks(hlsInstanceRef.current);
        initMkvDemuxer();
      } catch (err) {
        console.error('Error loading video player modules:', err);
      }
    };

    initModules();

    return () => {
      isCancelled = true;
      abortController.abort();
      mkvTracksMapRef.current.clear();
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch (e) {}
        playerInstanceRef.current = null;
      }
      if (hlsInstanceRef.current) {
        try {
          hlsInstanceRef.current.destroy();
        } catch (e) {}
        hlsInstanceRef.current = null;
      }
      if (videoElement) {
        videoElement.removeEventListener('error', onError);
        videoElement.removeEventListener('waiting', onWaiting);
        videoElement.removeEventListener('playing', onPlaying);
        videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      }
    };
  }, [effectiveVideoUrl, youtubeId, vimeoId, storageKey, isHls, isMkv]);

  // Next episode countdown timer
  useEffect(() => {
    if (showNextPrompt) {
      countdownTimerRef.current = setInterval(() => {
        setNextCountdown((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            setShowNextPrompt(false);
            if (onNextEpisodeRef.current) {
              onNextEpisodeRef.current();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [showNextPrompt]);

  // Handle Resume Playback button action
  const handleResumePlayback = () => {
    if (playerInstanceRef.current && resumeTime) {
      try {
        playerInstanceRef.current.currentTime = resumeTime;
        playerInstanceRef.current.play();
      } catch (e) {
        console.error('Failed to seek player:', e);
      }
    }
    setShowResumePrompt(false);
  };

  // Handle Dismiss Resume button action
  const handleDismissResume = () => {
    setShowResumePrompt(false);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
    }
  };

  return (
    <div
      id="video-player-section"
      className="w-full transition-all duration-500 ease-in-out relative select-none"
    >
      {/* Ambient Backlight Glow */}
      <div className="relative group">
        <div
          className="absolute -inset-1 opacity-25 group-hover:opacity-40 transition duration-1000 blur-2xl -z-10"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(6, 182, 212, 0.4) 0%, rgba(124, 58, 237, 0.3) 50%, transparent 80%)',
          }}
        />

        {/* Clean Outer Player Frame */}
        <div
          className="relative rounded-none lg:rounded-2xl overflow-hidden shadow-2xl transition-all duration-300"
          style={{
            background: 'linear-gradient(180deg, #090e1f 0%, #050814 100%)',
            borderTop: '1px solid rgba(6, 182, 212, 0.35)',
            borderBottom: '1px solid rgba(6, 182, 212, 0.35)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(6, 182, 212, 0.18)',
          }}
        >
          {/* ── 1. Floating Preview Title (Always Top-Left, Multi-line Safe) ── */}
          {title && !hasError && !isPlaying && (
            <div className="absolute top-2.5 sm:top-4 left-2.5 sm:left-4 z-20 pointer-events-none max-w-[calc(100%-20px)] sm:max-w-[80%] transition-opacity duration-300 animate-in fade-in">
              <div
                className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl backdrop-blur-md"
                style={{
                  background: 'rgba(6, 10, 26, 0.82)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), 0 0 15px rgba(6, 182, 212, 0.15)',
                }}
              >
                <h2
                  className="text-xs sm:text-sm md:text-base font-bold tracking-tight text-white line-clamp-2 leading-snug break-words whitespace-normal"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #06b6d4 60%, #a78bfa 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.8))',
                  }}
                >
                  {title}
                </h2>
              </div>
            </div>
          )}

          {/* ── 2. Continue Watching Notification Banner in Player ── */}
          {showResumePrompt && resumeTime && !hasError && !isPlaying && (
            <div className="absolute bottom-16 sm:bottom-20 left-3 sm:left-6 z-30 animate-in fade-in slide-in-from-bottom-3 duration-300 max-w-[90%] sm:max-w-md">
              <div
                className="flex items-center gap-3 p-2.5 sm:p-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl"
                style={{
                  background: 'rgba(8, 12, 28, 0.92)',
                  borderColor: 'rgba(6, 182, 212, 0.45)',
                  boxShadow: '0 15px 35px rgba(0, 0, 0, 0.85), 0 0 25px rgba(6, 182, 212, 0.25)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(124, 58, 237, 0.25))',
                    border: '1px solid rgba(6, 182, 212, 0.4)',
                  }}
                >
                  <RotateCcw size={15} className="text-cyan-400 animate-pulse" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white leading-tight">
                    Lanjutkan Menonton?
                  </p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Tersimpan di menit <span className="font-bold text-cyan-300">{formatSeconds(resumeTime)}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleResumePlayback}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-md"
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                      boxShadow: '0 0 12px rgba(6, 182, 212, 0.4)',
                    }}
                  >
                    <Play size={11} fill="white" />
                    <span>Lanjut</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDismissResume}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Mulai dari awal"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 3. Next Episode Auto-Prompt Banner when Video Ends ── */}
          {showNextPrompt && onNextEpisode && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300 p-4">
              <div
                className="max-w-md w-full p-5 rounded-3xl border shadow-2xl text-center"
                style={{
                  background: 'rgba(9, 13, 30, 0.95)',
                  borderColor: 'rgba(6, 182, 212, 0.4)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(6, 182, 212, 0.25)',
                }}
              >
                <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-cyan-950/80 border border-cyan-400/50 shadow-lg">
                  <Play size={20} fill="#06b6d4" className="text-cyan-400 ml-0.5" />
                </div>

                <h3 className="text-base sm:text-lg font-black text-white mb-1">
                  Putar Episode Berikutnya?
                </h3>
                {nextEpisodeTitle && (
                  <p className="text-xs sm:text-sm text-cyan-300 font-bold mb-2 line-clamp-1">
                    {nextEpisodeTitle}
                  </p>
                )}
                <p className="text-xs text-slate-400 mb-5">
                  Memutar otomatis dalam <span className="text-white font-bold">{nextCountdown}s</span>
                </p>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNextPrompt(false);
                      onNextEpisode();
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                      boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
                    }}
                  >
                    <span>Putar Sekarang</span>
                    <ChevronRight size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowNextPrompt(false)}
                    className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}



          {/* ── 5. Video Canvas Container with Declarative <video> in JSX ── */}
          <div
            className="relative w-full overflow-hidden bg-black flex items-center justify-center plyr-custom-wrapper"
            style={{
              aspectRatio: '16/9',
              maxHeight: '800px',
            }}
          >
            {hasError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 text-center text-slate-300 max-w-sm mx-auto animate-fadeIn">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    boxShadow: '0 0 15px rgba(239, 68, 68, 0.2)',
                  }}
                >
                  <AlertCircle size={20} className="text-red-400" />
                </div>
                {title && (
                  <p className="text-xs font-bold text-cyan-400 mb-1 line-clamp-1 max-w-xs">
                    {title}
                  </p>
                )}
                <h3 className="text-sm sm:text-base font-bold text-white mb-1">
                  Gagal Memuat Video
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed mb-3 max-w-xs">
                  Video sedang tidak dapat diputar saat ini. Server streaming mungkin sedang mengalami gangguan jaringan.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                  <a
                    href={effectiveVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition-all duration-200 hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                      boxShadow: '0 0 12px rgba(6, 182, 212, 0.4)',
                    }}
                  >
                    <span>Buka Video Langsung</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setReported(true)}
                    disabled={reported}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-105"
                    style={{
                      background: reported
                        ? 'rgba(34, 197, 94, 0.2)'
                        : 'rgba(255, 255, 255, 0.08)',
                      border: reported ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                      color: reported ? '#4ade80' : 'white',
                    }}
                  >
                    {reported ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Laporan Terkirim</span>
                      </>
                    ) : (
                      <>
                        <Flag size={14} />
                        <span>Lapor Masalah</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : youtubeId ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0&modestbranding=1`}
                title={title || 'YouTube video player'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            ) : vimeoId ? (
              <iframe
                src={`https://player.vimeo.com/video/${vimeoId}?autoplay=0`}
                title={title || 'Vimeo video player'}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            ) : (
              /* Declarative <video> tag in JSX */
              <div
                className="w-full h-full flex items-center justify-center plyr-custom-wrapper bg-black overflow-hidden"
              >
                <video
                  ref={videoRef}
                  src={effectiveVideoUrl}
                  className="plyr-react w-full h-full object-cover"
                  playsInline
                  crossOrigin="anonymous"
                  poster={poster}
                >
                  {isHls ? (
                    <source src={effectiveVideoUrl} type="application/x-mpegURL" />
                  ) : isMkv ? (
                    <source src={effectiveVideoUrl} type="video/x-matroska" />
                  ) : (
                    <source src={effectiveVideoUrl} type="video/mp4" />
                  )}

                  {!isMkv &&
                    extSubs.map((sub, idx) => (
                      <track
                        key={`${sub.src}-${idx}`}
                        kind="subtitles"
                        label={sub.label || `Subtitle ${idx + 1}`}
                        srcLang={sub.srcLang || 'id'}
                        src={sub.src}
                        default={sub.default || idx === 0}
                      />
                    ))}
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
