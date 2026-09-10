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
  type: 'native' | 'hls' | 'external' | 'mkv' | 'mp4';
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
  let text = raw;
  // If ASS/SSA event format (8 comma-separated metadata fields before dialogue text)
  const assMatch = text.match(/^\d+,\d*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,(.*)$/s);
  if (assMatch) {
    text = assMatch[1];
  }
  return text
    .replace(/\{[^}]+\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\\N/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\h/g, ' ')
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
    .trim();
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
  const mkvTracksMapRef = useRef<Map<number, TextTrack>>(new Map());
  const mp4TracksMapRef = useRef<Map<number, TextTrack>>(new Map());
  const lastSavedTimeRef = useRef<number>(0);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mkvSeekCleanupRef = useRef<(() => void) | null>(null);
  const mp4SeekCleanupRef = useRef<(() => void) | null>(null);
  const savedResumeTimeRef = useRef<number | null>(null);
  const fetchClusterForTimeRef = useRef<((t: number) => void) | null>(null);
  const fetchMp4CuesForTimeRef = useRef<((t: number) => void) | null>(null);

  const effectiveVideoUrl = cleanVideoUrl(videoUrl) || videoUrl || '';
  const onNextEpisodeRef = useRef(onNextEpisode);
  onNextEpisodeRef.current = onNextEpisode;
  const onPrevEpisodeRef = useRef(onPrevEpisode);
  onPrevEpisodeRef.current = onPrevEpisode;
  const youtubeId = getYouTubeId(effectiveVideoUrl);
  const vimeoId = getVimeoId(effectiveVideoUrl);

  const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
  const storageKey =
    typeof window !== 'undefined' && effectiveVideoUrl
      ? `filmes_progress_${encodeURIComponent(pagePath || effectiveVideoUrl.split('?')[0])}`
      : null;
  const legacyStorageKey =
    typeof window !== 'undefined' && effectiveVideoUrl
      ? `filmes_progress_${encodeURIComponent(effectiveVideoUrl.split('?')[0])}`
      : null;

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
  const isMp4 = !isHls && !isMkv && (effectiveVideoUrl.toLowerCase().includes('.mp4') || effectiveVideoUrl.toLowerCase().includes('.m4v') || !effectiveVideoUrl.includes('.'));

  // Main video player initialization effect
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
    savedResumeTimeRef.current = null;
    mkvTracksMapRef.current.clear();
    mp4TracksMapRef.current.clear();

    // Check saved playback progress
    if (storageKey) {
      try {
        let saved = localStorage.getItem(storageKey);
        if (!saved && legacyStorageKey) {
          saved = localStorage.getItem(legacyStorageKey);
        }
        if (saved) {
          const parsed = parseFloat(saved);
          if (!isNaN(parsed) && parsed > 5) {
            setResumeTime(parsed);
            savedResumeTimeRef.current = parsed;
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
      }
    };

    const saveProgress = () => {
      if (!storageKey) return;
      const curTime = playerInstanceRef.current
        ? playerInstanceRef.current.currentTime
        : (videoElement ? videoElement.currentTime : 0);
      const dur =
        (playerInstanceRef.current && playerInstanceRef.current.duration) ||
        (videoElement && videoElement.duration) ||
        0;

      if (typeof curTime === 'number' && !isNaN(curTime) && curTime > 5 && (dur === 0 || curTime < dur - 10)) {
        try {
          const floored = Math.floor(curTime);
          localStorage.setItem(storageKey, String(floored));
          if (legacyStorageKey) localStorage.setItem(legacyStorageKey, String(floored));
          lastSavedTimeRef.current = floored;
        } catch (e) {}
      } else if (typeof curTime === 'number' && dur > 0 && curTime >= dur - 10) {
        try {
          localStorage.removeItem(storageKey);
          if (legacyStorageKey) localStorage.removeItem(legacyStorageKey);
        } catch (e) {}
      }
    };

    const handlePageExit = () => {
      saveProgress();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveProgress();
      }
    };

    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);
    document.addEventListener('visibilitychange', handleVisibilityChange);

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

      // Auto-enable Indonesian or first available caption by default
      if (found.length > 0) {
        const indoTrack = found.find(
          (t) =>
            t.language === 'ind' ||
            t.language === 'id' ||
            t.label.toLowerCase().includes('indo')
        );
        const chosen = indoTrack || found[0];
        if (chosen) {
          if (chosen.type === 'native' && typeof chosen.trackIndex === 'number' && videoElement.textTracks) {
            try {
              videoElement.textTracks[chosen.trackIndex].mode = 'showing';
            } catch (e) {}
          } else if (chosen.type === 'hls' && typeof chosen.trackIndex === 'number' && hlsInstance) {
            try {
              hlsInstance.subtitleTrack = chosen.trackIndex;
            } catch (e) {}
          }
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

    // ── MKV EMBEDDED SOFTCODED SUBTITLES DEMUXER WITH ON-DEMAND SEEK ──
    const initMkvDemuxer = async () => {
      if (!isMkv) return;
      try {
        const { SubtitleParser } = await import('matroska-subtitles');
        const ebmlStream = await import('ebml-stream');
        if (isCancelled) return;

        const parser = new SubtitleParser();
        const addedCuesSet = new Set<string>();

        const addParsedCue = (
          trackNumber: number,
          startSec: number,
          endSec: number,
          rawText: string
        ) => {
          if (isCancelled) return;
          const targetTrack = mkvTracksMapRef.current.get(trackNumber);
          if (targetTrack && typeof startSec === 'number' && !isNaN(startSec)) {
            const safeEndSec = Math.max(startSec + 0.5, endSec || startSec + 3.0);
            const cleanText = cleanSubtitleText(rawText);
            const cueKey = `${trackNumber}_${Math.round(startSec * 10)}_${cleanText.slice(0, 20)}`;
            if (cleanText && safeEndSec > startSec && !addedCuesSet.has(cueKey)) {
              addedCuesSet.add(cueKey);
              try {
                const cue = new VTTCue(startSec, safeEndSec, cleanText);
                targetTrack.addCue(cue);
              } catch (e) {}
            }
          }
        };

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

          // Inform Plyr to refresh captions menu so newly added tracks are recognized
          if (playerInstanceRef.current && (playerInstanceRef.current as any).captions) {
            try {
              (playerInstanceRef.current as any).captions.setup();
            } catch (e) {}
          }
        });

        parser.on('subtitle', (sub: any, trackNumber: number) => {
          if (typeof sub.time === 'number') {
            const startSec = sub.time / 1000;
            const endSec = (sub.time + (sub.duration || 3000)) / 1000;
            addParsedCue(trackNumber, startSec, endSec, sub.text);
          }
        });

        let cuePoints: { time: number; clusterPos: number; track?: number }[] = [];
        let segStart = 52;
        const fetchedClusterOffsets = new Set<number>();

        // Pre-fetch header and Cues in background so user skips are instant
        (async () => {
          try {
            const headRes = await fetch(effectiveVideoUrl, {
              headers: { Range: 'bytes=0-262143' },
              signal: abortController.signal,
            });
            if (!headRes.ok || isCancelled) return;
            const headBuf = new Uint8Array(await headRes.arrayBuffer());

            // Feed parser to emit tracks immediately
            try {
              parser.write(headBuf);
            } catch (e) {}

            // Locate segment data start (0x18538067)
            for (let i = 0; i < Math.min(headBuf.length - 4, 200); i++) {
              if (headBuf[i] === 0x18 && headBuf[i + 1] === 0x53 && headBuf[i + 2] === 0x80 && headBuf[i + 3] === 0x67) {
                segStart = i + 12;
                break;
              }
            }

            // Find Cues seek pos from SeekHead
            let cuesSeekPos: number | null = null;
            const seekDecoder = new ebmlStream.EbmlStreamDecoder({
              bufferTagIds: [ebmlStream.EbmlTagId.SeekHead, ebmlStream.EbmlTagId.Seek],
            });
            seekDecoder.on('data', (chunk: any) => {
              if (chunk.id === ebmlStream.EbmlTagId.SeekHead) {
                for (const s of chunk.Children?.filter((c: any) => c.id === ebmlStream.EbmlTagId.Seek) || []) {
                  const seekId = s.Children?.find((c: any) => c.id === ebmlStream.EbmlTagId.SeekID)?.data;
                  const pos = s.Children?.find((c: any) => c.id === ebmlStream.EbmlTagId.SeekPosition)?.data;
                  const hex = seekId ? (typeof seekId.toString === 'function' ? seekId.toString('hex') : '') : '';
                  if (hex === '1c53bb6b' && typeof pos === 'number') {
                    cuesSeekPos = pos;
                  }
                }
              }
            });
            seekDecoder.write(headBuf);

            if (cuesSeekPos !== null && !isCancelled) {
              const cuesByteOffset = segStart + cuesSeekPos;
              const cuesRes = await fetch(effectiveVideoUrl, {
                headers: { Range: `bytes=${cuesByteOffset}-${cuesByteOffset + 1048576}` },
                signal: abortController.signal,
              });
              if (cuesRes.ok && !isCancelled) {
                const cuesBuf = new Uint8Array(await cuesRes.arrayBuffer());
                const cuesDecoder = new ebmlStream.EbmlStreamDecoder({
                  bufferTagIds: [ebmlStream.EbmlTagId.CuePoint],
                });
                cuesDecoder.on('data', (chunk: any) => {
                  if (chunk.id === ebmlStream.EbmlTagId.CuePoint) {
                    const time = chunk.Children?.find((x: any) => x.id === ebmlStream.EbmlTagId.CueTime)?.data;
                    const trackPos = chunk.Children?.find((x: any) => x.id === ebmlStream.EbmlTagId.CueTrackPositions);
                    const clusterPos = trackPos?.Children?.find((x: any) => x.id === ebmlStream.EbmlTagId.CueClusterPosition)?.data;
                    const track = trackPos?.Children?.find((x: any) => x.id === ebmlStream.EbmlTagId.CueTrack)?.data;
                    if (typeof time === 'number' && typeof clusterPos === 'number') {
                      cuePoints.push({ time, clusterPos, track });
                    }
                  }
                });
                cuesDecoder.write(cuesBuf);

                // Initial fetch for beginning of video (time 0-10s)
                if (videoElement && !isCancelled) {
                  fetchClusterForTime(videoElement.currentTime || 0);
                  fetchClusterForTime((videoElement.currentTime || 0) + 6);
                }
              }
            }
          } catch (e) {}
        })();

        const fetchClusterForTime = async (targetSec: number) => {
          if (isCancelled) return;
          if (cuePoints.length === 0) {
            setTimeout(() => {
              if (!isCancelled && videoElement) {
                fetchClusterForTime(videoElement.currentTime || 0);
              }
            }, 600);
            return;
          }

          const targetMs = Math.max(0, targetSec * 1000);
          let chosen = cuePoints[0];
          for (let i = 0; i < cuePoints.length; i++) {
            const pt = cuePoints[i];
            if (pt.time <= targetMs) {
              chosen = pt;
            } else {
              break;
            }
          }

          if (!chosen) return;
          const clusterOffset = segStart + chosen.clusterPos;
          if (fetchedClusterOffsets.has(clusterOffset)) return;
          fetchedClusterOffsets.add(clusterOffset);

          try {
            const res = await fetch(effectiveVideoUrl, {
              headers: { Range: `bytes=${clusterOffset}-${clusterOffset + 3670016}` },
              signal: abortController.signal,
            });
            if (!res.ok || isCancelled) return;
            const clusterBuf = new Uint8Array(await res.arrayBuffer());

            const clusterDecoder = new ebmlStream.EbmlStreamDecoder({
              bufferTagIds: [
                ebmlStream.EbmlTagId.Timecode,
                ebmlStream.EbmlTagId.BlockGroup,
                ebmlStream.EbmlTagId.Block,
                ebmlStream.EbmlTagId.BlockDuration,
              ],
            });

            let clusterTimecode = 0;
            clusterDecoder.on('data', (chunk: any) => {
              if (chunk.id === ebmlStream.EbmlTagId.Timecode) {
                clusterTimecode = chunk.data;
              }
              if (chunk.id === ebmlStream.EbmlTagId.BlockGroup) {
                const block = chunk.Children?.find((c: any) => c.id === ebmlStream.EbmlTagId.Block);
                const duration =
                  chunk.Children?.find((c: any) => c.id === ebmlStream.EbmlTagId.BlockDuration)?.data || 3000;
                if (block && typeof block.track === 'number') {
                  const startSec = (clusterTimecode + block.value) / 1000;
                  const endSec = startSec + (duration / 1000);
                  const payloadStr =
                    block.payload && typeof block.payload.toString === 'function'
                      ? block.payload.toString('utf8')
                      : '';
                  addParsedCue(block.track, startSec, endSec, payloadStr);
                }
              }
            });

            clusterDecoder.write(clusterBuf);
          } catch (e) {}
        };

        fetchClusterForTimeRef.current = (t: number) => {
          fetchClusterForTime(t);
        };

        // Listen to seeked event: fetch cluster at new seek location immediately
        let seekDebounce: NodeJS.Timeout | null = null;
        const onUserSeeked = () => {
          if (seekDebounce) clearTimeout(seekDebounce);
          seekDebounce = setTimeout(() => {
            if (!isCancelled && videoElement && typeof videoElement.currentTime === 'number') {
              fetchClusterForTime(videoElement.currentTime);
              fetchClusterForTime(videoElement.currentTime + 6);
            }
          }, 80);
        };

        // Gentle background lookahead every 4 seconds during continuous playback (zero lag)
        let lastCheckedTime = 0;
        const onTimeUpdate = () => {
          if (!videoElement || isCancelled) return;
          const now = videoElement.currentTime;
          if (Math.abs(now - lastCheckedTime) > 4) {
            lastCheckedTime = now;
            fetchClusterForTime(now + 6);
          }
        };

        videoElement.addEventListener('seeked', onUserSeeked);
        videoElement.addEventListener('timeupdate', onTimeUpdate);

        mkvSeekCleanupRef.current = () => {
          if (seekDebounce) clearTimeout(seekDebounce);
          videoElement.removeEventListener('seeked', onUserSeeked);
          videoElement.removeEventListener('timeupdate', onTimeUpdate);
          fetchClusterForTimeRef.current = null;
        };
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.log('MKV subtitle demuxer complete or handled:', err?.message);
        }
      }
    };

    // ── MP4 EMBEDDED SOFTCODED SUBTITLES DEMUXER WITH ON-DEMAND SEEK ──
    const initMp4Demuxer = async () => {
      if (!isMp4) return;
      try {
        const { detectMp4Subtitles, fetchMp4CuesForRange } = await import('@/lib/mp4Subtitles');
        if (isCancelled) return;

        const mp4Tracks = await detectMp4Subtitles(effectiveVideoUrl, {
          signal: abortController.signal,
        });
        if (isCancelled || !videoRef.current || mp4Tracks.length === 0) return;

        const addedCuesSet = new Set<string>();
        const fetchedCuesIndexSet = new Set<number>();

        const addParsedCue = (
          trackNumber: number,
          startSec: number,
          endSec: number,
          rawText: string
        ) => {
          if (isCancelled) return;
          const targetTrack = mp4TracksMapRef.current.get(trackNumber);
          if (targetTrack && typeof startSec === 'number' && !isNaN(startSec)) {
            const safeEndSec = Math.max(startSec + 0.5, endSec || startSec + 3.0);
            const cleanText = cleanSubtitleText(rawText);
            const cueKey = `mp4_${trackNumber}_${Math.round(startSec * 10)}_${cleanText.slice(0, 20)}`;
            if (cleanText && safeEndSec > startSec && !addedCuesSet.has(cueKey)) {
              addedCuesSet.add(cueKey);
              try {
                const cue = new VTTCue(startSec, safeEndSec, cleanText);
                targetTrack.addCue(cue);
              } catch (e) {}
            }
          }
        };

        const mp4Detected: DetectedSubtitle[] = [];

        const hasIndo = mp4Tracks.some((t) => {
          const l = (t.language || '').toLowerCase();
          const n = (t.label || '').toLowerCase();
          return l === 'ind' || l === 'id' || n.includes('indo');
        });

        mp4Tracks.forEach((t) => {
          const trackNumber = t.trackNumber;
          const rawLang = (t.language || '').toLowerCase();
          const rawName = (t.label || '').toLowerCase();

          const isId = rawLang === 'ind' || rawLang === 'id' || rawName.includes('indo');
          const isEn = rawLang === 'eng' || rawLang === 'en' || rawName.includes('eng') || (!rawLang && hasIndo);

          const langCode = isId ? 'id' : isEn ? 'en' : (rawLang || 'und');
          const langLabel = t.label || (isId ? 'Bahasa Indonesia' : isEn ? 'English' : getLanguageLabel(langCode, t.label));

          if (videoRef.current) {
            try {
              const textTrack = videoRef.current.addTextTrack(
                'subtitles',
                langLabel,
                langCode
              );
              textTrack.mode = 'hidden';
              mp4TracksMapRef.current.set(trackNumber, textTrack);
            } catch (e) {
              console.error('Failed to addTextTrack for MP4 subtitle:', e);
            }
          }

          mp4Detected.push({
            id: `mp4-${trackNumber}`,
            label: langLabel,
            language: langCode,
            type: 'mp4',
            trackNumber,
          });
        });

        // Auto-enable Indonesian subtitle by default if available, or first track
        if (mp4Detected.length > 0) {
          const indoTrack = mp4Detected.find(
            (t) =>
              t.language === 'ind' ||
              t.language === 'id' ||
              t.label.toLowerCase().includes('indo')
          );
          const chosen = indoTrack || mp4Detected[0];
          if (chosen && chosen.trackNumber) {
            const target = mp4TracksMapRef.current.get(chosen.trackNumber);
            if (target) {
              target.mode = 'showing';
            }
          }
        }

        // Inform Plyr to refresh captions menu so newly added tracks are recognized
        if (playerInstanceRef.current && (playerInstanceRef.current as any).captions) {
          try {
            (playerInstanceRef.current as any).captions.setup();
          } catch (e) {}
        }

        const fetchMp4CuesForTime = async (targetSec: number) => {
          if (isCancelled) return;
          const startRange = Math.max(0, targetSec - 5);
          const endRange = targetSec + 30;

          for (const track of mp4Tracks) {
            try {
              const cues = await fetchMp4CuesForRange(
                track,
                startRange,
                endRange,
                effectiveVideoUrl,
                { signal: abortController.signal, fetchedCuesSet: fetchedCuesIndexSet }
              );
              for (const c of cues) {
                addParsedCue(track.trackNumber, c.startSec, c.endSec, c.text);
              }
            } catch (e) {}
          }
        };

        fetchMp4CuesForTimeRef.current = (t: number) => {
          fetchMp4CuesForTime(t);
        };

        // Initial fetch for beginning of video (time 0-30s)
        if (videoElement && !isCancelled) {
          fetchMp4CuesForTime(videoElement.currentTime || 0);
          fetchMp4CuesForTime((videoElement.currentTime || 0) + 10);
        }

        // Pre-fetch all cues if small track (< 300 cues) so whole video has subtitles ready immediately
        for (const track of mp4Tracks) {
          if (track.cues.length <= 300) {
            (async () => {
              try {
                const allCues = await fetchMp4CuesForRange(
                  track,
                  0,
                  999999,
                  effectiveVideoUrl,
                  { signal: abortController.signal, fetchedCuesSet: fetchedCuesIndexSet }
                );
                for (const c of allCues) {
                  addParsedCue(track.trackNumber, c.startSec, c.endSec, c.text);
                }
              } catch (e) {}
            })();
          }
        }

        // Listen to seeked event: fetch cues at new seek location immediately
        let seekDebounce: NodeJS.Timeout | null = null;
        const onUserSeeked = () => {
          if (seekDebounce) clearTimeout(seekDebounce);
          seekDebounce = setTimeout(() => {
            if (!isCancelled && videoElement && typeof videoElement.currentTime === 'number') {
              fetchMp4CuesForTime(videoElement.currentTime);
              fetchMp4CuesForTime(videoElement.currentTime + 10);
            }
          }, 80);
        };

        // Lookahead every 4 seconds during continuous playback (zero lag)
        let lastCheckedTime = 0;
        const onTimeUpdate = () => {
          if (!videoElement || isCancelled) return;
          const now = videoElement.currentTime;
          if (Math.abs(now - lastCheckedTime) > 4) {
            lastCheckedTime = now;
            fetchMp4CuesForTime(now + 10);
          }
        };

        videoElement.addEventListener('seeked', onUserSeeked);
        videoElement.addEventListener('timeupdate', onTimeUpdate);

        mp4SeekCleanupRef.current = () => {
          if (seekDebounce) clearTimeout(seekDebounce);
          videoElement.removeEventListener('seeked', onUserSeeked);
          videoElement.removeEventListener('timeupdate', onTimeUpdate);
          fetchMp4CuesForTimeRef.current = null;
        };
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.log('MP4 subtitle demuxer complete or handled:', err?.message);
        }
      }
    };

    const initModules = async () => {
      try {
        if (isHls) {
          const HlsModule = (await import('hls.js' as any)).default;
          if (HlsModule && HlsModule.isSupported && HlsModule.isSupported() && !isCancelled && videoElement) {
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
            language: 'auto',
            update: true,
          },
          seekTime: 10,
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
          keyboard: { focused: true, global: true },
          tooltips: { controls: true, seek: true },
          fullscreen: { enabled: true, fallback: true, iosNative: true },
        });

        // If user presses play and there is saved progress near start, auto-resume
        player.on('play', () => {
          setIsPlaying(true);
          if (savedResumeTimeRef.current && savedResumeTimeRef.current > 5 && (player.currentTime || 0) < 2) {
            const target = savedResumeTimeRef.current;
            savedResumeTimeRef.current = null;
            setShowResumePrompt(false);
            try {
              player.currentTime = target;
              if (videoElement) videoElement.currentTime = target;
              if (fetchClusterForTimeRef.current) {
                fetchClusterForTimeRef.current(target);
                fetchClusterForTimeRef.current(target + 6);
              }
              if (fetchMp4CuesForTimeRef.current) {
                fetchMp4CuesForTimeRef.current(target);
                fetchMp4CuesForTimeRef.current(target + 10);
              }
            } catch (e) {}
          }
        });

        player.on('playing', () => {
          setIsPlaying(true);
          setIsBuffering(false);
        });

        player.on('seeking', () => {
          setShowResumePrompt(false);
          savedResumeTimeRef.current = null;
        });

        player.on('seeked', () => {
          saveProgress();
        });

        player.on('pause', () => {
          setIsPlaying(false);
          saveProgress();
        });

        player.on('waiting', () => {
          setIsBuffering(true);
        });

        // Track and persist playback progress every 3 seconds
        player.on('timeupdate', () => {
          const cur = Math.floor(player.currentTime);
          if (Math.abs(cur - lastSavedTimeRef.current) >= 3) {
            saveProgress();
          }
        });

        player.on('ended', () => {
          setIsPlaying(false);
          setShowResumePrompt(false);
          savedResumeTimeRef.current = null;
          if (storageKey) {
            try {
              localStorage.removeItem(storageKey);
              if (legacyStorageKey) localStorage.removeItem(legacyStorageKey);
            } catch (e) {}
          }

          // Trigger next episode prompt if handler is available
          if (onNextEpisodeRef.current) {
            setShowNextPrompt(true);
            setNextCountdown(8);
          }
        });

        player.on('captionsenabled', () => {
          if (videoElement && videoElement.textTracks && videoElement.textTracks.length > 0) {
            const curIdx =
              typeof player.currentTrack === 'number' && player.currentTrack >= 0
                ? player.currentTrack
                : 0;
            if (videoElement.textTracks[curIdx]) {
              videoElement.textTracks[curIdx].mode = 'showing';
            }
          }
        });

        player.on('captionsdisabled', () => {
          if (videoElement && videoElement.textTracks) {
            for (let i = 0; i < videoElement.textTracks.length; i++) {
              videoElement.textTracks[i].mode = 'hidden';
            }
          }
        });

        player.on('languagechange', () => {
          if (
            typeof player.currentTrack === 'number' &&
            player.currentTrack >= 0 &&
            videoElement &&
            videoElement.textTracks &&
            videoElement.textTracks[player.currentTrack]
          ) {
            const selectedTrack = videoElement.textTracks[player.currentTrack];
            for (let i = 0; i < videoElement.textTracks.length; i++) {
              const tr = videoElement.textTracks[i];
              if (tr === selectedTrack) {
                tr.mode = 'showing';
              } else {
                tr.mode = 'hidden';
              }
            }
          }
        });

        playerInstanceRef.current = player;
        scanSubtitleTracks(hlsInstanceRef.current);
        initMkvDemuxer();
        initMp4Demuxer();
      } catch (err) {
        console.error('Error loading video player modules:', err);
      }
    };

    initModules();

    return () => {
      isCancelled = true;
      abortController.abort();
      saveProgress();
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      if (mkvSeekCleanupRef.current) {
        mkvSeekCleanupRef.current();
        mkvSeekCleanupRef.current = null;
      }
      if (mp4SeekCleanupRef.current) {
        mp4SeekCleanupRef.current();
        mp4SeekCleanupRef.current = null;
      }
      fetchMp4CuesForTimeRef.current = null;
    };
  }, [effectiveVideoUrl, youtubeId, vimeoId, storageKey, isHls, isMkv, isMp4]);

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

  // Auto-dismiss resume banner after 12 seconds if playback is active
  useEffect(() => {
    if (showResumePrompt && isPlaying) {
      const t = setTimeout(() => {
        setShowResumePrompt(false);
      }, 12000);
      return () => clearTimeout(t);
    }
  }, [showResumePrompt, isPlaying]);

  // Handle Resume Playback button action
  const handleResumePlayback = () => {
    if (!resumeTime) return;
    const target = resumeTime;
    setShowResumePrompt(false);
    savedResumeTimeRef.current = null;

    if (videoRef.current) {
      try {
        videoRef.current.currentTime = target;
      } catch (e) {}
    }
    if (playerInstanceRef.current) {
      try {
        playerInstanceRef.current.currentTime = target;
        playerInstanceRef.current.play();
      } catch (e) {
        console.error('Failed to seek player:', e);
      }
    }
    if (fetchClusterForTimeRef.current) {
      fetchClusterForTimeRef.current(target);
      fetchClusterForTimeRef.current(target + 6);
    }
    if (fetchMp4CuesForTimeRef.current) {
      fetchMp4CuesForTimeRef.current(target);
      fetchMp4CuesForTimeRef.current(target + 10);
    }
  };

  // Handle Dismiss Resume button action
  const handleDismissResume = () => {
    setShowResumePrompt(false);
    savedResumeTimeRef.current = null;
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
        if (legacyStorageKey) localStorage.removeItem(legacyStorageKey);
      } catch (e) {}
    }
  };

  return (
    <div
      id="video-player-section"
      className="w-full transition-all duration-500 ease-in-out relative select-none"
    >
      {/* Ambient Backlight Glow - disabled during playback for maximum mobile performance */}
      <div className="relative group">
        {!isPlaying && (
          <div
            className="absolute -inset-1 opacity-25 group-hover:opacity-40 transition duration-1000 blur-2xl -z-10"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(6, 182, 212, 0.4) 0%, rgba(124, 58, 237, 0.3) 50%, transparent 80%)',
            }}
          />
        )}

        {/* Clean Outer Player Frame with hardware acceleration for smooth mobile scrolling */}
        <div
          className="relative rounded-none lg:rounded-2xl overflow-hidden shadow-2xl transition-all duration-300"
          style={{
            background: 'linear-gradient(180deg, #090e1f 0%, #050814 100%)',
            borderTop: '1px solid rgba(6, 182, 212, 0.35)',
            borderBottom: '1px solid rgba(6, 182, 212, 0.35)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(6, 182, 212, 0.18)',
            transform: 'translateZ(0)',
            willChange: 'transform',
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
          {showResumePrompt && resumeTime && !hasError && (
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

          {/* ── 4. Buffering Spinner ── */}
          {isBuffering && isPlaying && !hasError && (
            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md">
                <Loader2 size={28} className="text-cyan-400 animate-spin" />
                <span className="text-[10px] font-bold tracking-wider text-slate-300 uppercase">
                  Memuat...
                </span>
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
                <button
                  type="button"
                  onClick={() => setReported(true)}
                  disabled={reported}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-105"
                  style={{
                    background: reported
                      ? 'rgba(34, 197, 94, 0.2)'
                      : 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                    border: reported ? '1px solid rgba(34, 197, 94, 0.5)' : 'none',
                    color: reported ? '#4ade80' : 'white',
                    boxShadow: reported ? 'none' : '0 0 15px rgba(6, 182, 212, 0.4)',
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
              /* Declarative <video> tag in JSX isolated with key */
              <div
                key={effectiveVideoUrl}
                className="w-full h-full flex items-center justify-center plyr-custom-wrapper"
              >
                <video
                  ref={videoRef}
                  src={isMounted ? effectiveVideoUrl : undefined}
                  className="plyr-react plyr w-full h-full"
                  playsInline
                  crossOrigin="anonymous"
                  poster={poster}
                >
                  <source
                    src={isMounted ? effectiveVideoUrl : ''}
                    type={effectiveVideoUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'}
                  />
                  {isMounted && isMkv && <source src={effectiveVideoUrl} type="video/x-matroska" />}

                  {isMounted &&
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
