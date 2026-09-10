/**
 * Zero-dependency MP4 / ISOBMFF softcoded subtitle demuxer for browsers.
 * Parses moov -> trak -> mdia -> minf -> stbl (stts, stsz, stsc, stco/co64)
 * and extracts timed-text (tx3g / mov_text / wvtt) subtitle cues on demand.
 */

export interface Mp4SubtitleCue {
  index: number;
  startSec: number;
  endSec: number;
  fileOffset: number;
  byteLength: number;
  text?: string;
}

export interface Mp4SubtitleTrack {
  trackNumber: number;
  language: string;
  label: string;
  codec: string;
  timescale: number;
  cues: Mp4SubtitleCue[];
}

function readUint32(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) >>> 0) |
    (buf[offset + 1] << 16) |
    (buf[offset + 2] << 8) |
    buf[offset + 3]
  ) >>> 0;
}

function readUint16(buf: Uint8Array, offset: number): number {
  return (buf[offset] << 8) | buf[offset + 1];
}

function readAscii(buf: Uint8Array, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length && offset + i < buf.length; i++) {
    str += String.fromCharCode(buf[offset + i]);
  }
  return str;
}

function findBoxIn(
  buf: Uint8Array,
  fourcc: string,
  start = 0,
  end = buf.length
): { offset: number; size: number; payload: Uint8Array } | null {
  const c0 = fourcc.charCodeAt(0);
  const c1 = fourcc.charCodeAt(1);
  const c2 = fourcc.charCodeAt(2);
  const c3 = fourcc.charCodeAt(3);

  for (let i = start; i <= end - 8; i++) {
    if (
      buf[i + 4] === c0 &&
      buf[i + 5] === c1 &&
      buf[i + 6] === c2 &&
      buf[i + 7] === c3
    ) {
      let size = readUint32(buf, i);
      let headerSize = 8;
      if (size === 1 && i + 16 <= end) {
        // 64-bit size (take lower 32 bits for practical slice)
        size = readUint32(buf, i + 12);
        headerSize = 16;
      } else if (size === 0) {
        size = end - i;
      }
      const actualEnd = Math.min(i + size, end);
      return {
        offset: i,
        size,
        payload: buf.subarray(i + headerSize, actualEnd),
      };
    }
  }
  return null;
}

function unpackLanguage(langInt: number): string {
  const c1 = String.fromCharCode(((langInt >> 10) & 0x1f) + 0x60);
  const c2 = String.fromCharCode(((langInt >> 5) & 0x1f) + 0x60);
  const c3 = String.fromCharCode((langInt & 0x1f) + 0x60);
  const full = (c1 + c2 + c3).toLowerCase();
  if (full === 'und' || full === '```') return 'und';
  if (full === 'ind' || full === 'in') return 'id';
  if (full === 'eng') return 'en';
  if (full === 'may' || full === 'msa') return 'ms';
  return full;
}

export function decodeMp4SubtitleSample(data: Uint8Array, codec: string): string {
  if (!data || data.length < 2) return '';

  // 1. tx3g or plain text (2-byte length header followed by text)
  const len = (data[0] << 8) | data[1];
  if (len === 0) {
    return '';
  }
  if (len > 0 && len <= data.length - 2) {
    try {
      const textBytes = data.subarray(2, 2 + len);
      return new TextDecoder('utf-8').decode(textBytes);
    } catch {}
  }

  // 2. WebVTT in MP4 (wvtt / vttc -> payl)
  if (codec === 'wvtt') {
    for (let i = 0; i <= data.length - 8; i++) {
      if (
        data[i + 4] === 0x70 && // 'p'
        data[i + 5] === 0x61 && // 'a'
        data[i + 6] === 0x79 && // 'y'
        data[i + 7] === 0x6c    // 'l'
      ) {
        const boxSize = readUint32(data, i);
        const pSize = boxSize > 8 ? boxSize - 8 : data.length - (i + 8);
        try {
          return new TextDecoder('utf-8').decode(data.subarray(i + 8, i + 8 + pSize));
        } catch {}
      }
    }
  }

  // 3. Fallback: UTF-8 decode only for non-tx3g or explicit text
  if (codec !== 'tx3g') {
    try {
      const raw = new TextDecoder('utf-8').decode(data);
      const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
      if (cleaned !== 'encd') return cleaned;
    } catch {}
  }

  return '';
}

/**
 * Parses an individual subtitle trak box into an Mp4SubtitleTrack object
 */
export function parseSubtitleTrak(trakBuf: Uint8Array, trackNumber: number): Mp4SubtitleTrack | null {
  try {
    const mdiaBox = findBoxIn(trakBuf, 'mdia');
    if (!mdiaBox) return null;

    // Verify handler type
    const hdlrBox = findBoxIn(mdiaBox.payload, 'hdlr');
    if (!hdlrBox || hdlrBox.payload.length < 12) return null;
    const handlerType = readAscii(hdlrBox.payload, 8, 4).toLowerCase();
    const isSub =
      handlerType === 'text' ||
      handlerType === 'sbtl' ||
      handlerType === 'subt' ||
      handlerType === 'clcp' ||
      handlerType === 'tx3g' ||
      handlerType === 'wvtt' ||
      handlerType === 'subp';
    if (!isSub) return null;

    let trackLabel = '';
    if (hdlrBox.payload.length > 24) {
      try {
        trackLabel = new TextDecoder('utf-8')
          .decode(hdlrBox.payload.subarray(24))
          .replace(/\0/g, '')
          .trim();
      } catch {}
    }

    // Media header (timescale and language)
    const mdhdBox = findBoxIn(mdiaBox.payload, 'mdhd');
    let timescale = 1000;
    let lang = 'und';
    if (mdhdBox && mdhdBox.payload.length >= 24) {
      const version = mdhdBox.payload[0];
      if (version === 1) {
        if (mdhdBox.payload.length >= 28) {
          timescale = readUint32(mdhdBox.payload, 20);
          lang = unpackLanguage(readUint16(mdhdBox.payload, 28));
        }
      } else {
        timescale = readUint32(mdhdBox.payload, 12);
        lang = unpackLanguage(readUint16(mdhdBox.payload, 20));
      }
    }

    // Minf -> Stbl
    const minfBox = findBoxIn(mdiaBox.payload, 'minf');
    if (!minfBox) return null;
    const stblBox = findBoxIn(minfBox.payload, 'stbl');
    if (!stblBox) return null;

    const stbl = stblBox.payload;

    // 1. Codec from stsd
    const stsdBox = findBoxIn(stbl, 'stsd');
    let codec = 'tx3g';
    if (stsdBox && stsdBox.payload.length >= 16) {
      codec = readAscii(stsdBox.payload, 12, 4).trim() || 'tx3g';
    }

    // 2. stts (time to sample)
    const sttsBox = findBoxIn(stbl, 'stts');
    if (!sttsBox || sttsBox.payload.length < 8) return null;
    const sttsCount = readUint32(sttsBox.payload, 4);
    const sampleTimes: { time: number; duration: number }[] = [];
    let curTime = 0;
    for (let i = 0; i < sttsCount && 8 + i * 8 + 8 <= sttsBox.payload.length; i++) {
      const count = readUint32(sttsBox.payload, 8 + i * 8);
      const delta = readUint32(sttsBox.payload, 12 + i * 8);
      for (let c = 0; c < count; c++) {
        sampleTimes.push({ time: curTime, duration: delta });
        curTime += delta;
      }
    }

    // 3. stsz (sample sizes)
    const stszBox = findBoxIn(stbl, 'stsz');
    if (!stszBox || stszBox.payload.length < 12) return null;
    const defaultSampleSize = readUint32(stszBox.payload, 4);
    const totalSamples = readUint32(stszBox.payload, 8);
    const sampleSizes: number[] = [];
    if (defaultSampleSize > 0) {
      for (let i = 0; i < totalSamples; i++) {
        sampleSizes.push(defaultSampleSize);
      }
    } else {
      for (let i = 0; i < totalSamples && 12 + i * 4 + 4 <= stszBox.payload.length; i++) {
        sampleSizes.push(readUint32(stszBox.payload, 12 + i * 4));
      }
    }

    // 4. stsc (sample to chunk)
    const stscBox = findBoxIn(stbl, 'stsc');
    const stscEntries: { firstChunk: number; samplesPerChunk: number }[] = [];
    if (stscBox && stscBox.payload.length >= 8) {
      const stscCount = readUint32(stscBox.payload, 4);
      for (let i = 0; i < stscCount && 8 + i * 12 + 12 <= stscBox.payload.length; i++) {
        stscEntries.push({
          firstChunk: readUint32(stscBox.payload, 8 + i * 12),
          samplesPerChunk: readUint32(stscBox.payload, 12 + i * 12),
        });
      }
    }

    // 5. stco or co64 (chunk offsets)
    const chunkOffsets: number[] = [];
    const stcoBox = findBoxIn(stbl, 'stco');
    if (stcoBox && stcoBox.payload.length >= 8) {
      const stcoCount = readUint32(stcoBox.payload, 4);
      for (let i = 0; i < stcoCount && 8 + i * 4 + 4 <= stcoBox.payload.length; i++) {
        chunkOffsets.push(readUint32(stcoBox.payload, 8 + i * 4));
      }
    } else {
      const co64Box = findBoxIn(stbl, 'co64');
      if (co64Box && co64Box.payload.length >= 8) {
        const co64Count = readUint32(co64Box.payload, 4);
        for (let i = 0; i < co64Count && 8 + i * 8 + 8 <= co64Box.payload.length; i++) {
          const high = readUint32(co64Box.payload, 8 + i * 8);
          const low = readUint32(co64Box.payload, 12 + i * 8);
          chunkOffsets.push(high * 4294967296 + low);
        }
      }
    }

    // 6. Build cue list
    const cues: Mp4SubtitleCue[] = [];
    let stscIdx = 0;
    let currentSampleIdx = 0;

    for (
      let chunkIdx = 0;
      chunkIdx < chunkOffsets.length && currentSampleIdx < totalSamples;
      chunkIdx++
    ) {
      const chunkNumber = chunkIdx + 1;
      if (
        stscIdx + 1 < stscEntries.length &&
        chunkNumber >= stscEntries[stscIdx + 1].firstChunk
      ) {
        stscIdx++;
      }
      const samplesInThisChunk = stscEntries[stscIdx]
        ? stscEntries[stscIdx].samplesPerChunk
        : 1;

      let currentOffset = chunkOffsets[chunkIdx];
      for (
        let s = 0;
        s < samplesInThisChunk && currentSampleIdx < totalSamples;
        s++
      ) {
        const sSize = sampleSizes[currentSampleIdx] || 0;
        const sTime = sampleTimes[currentSampleIdx];
        if (sTime) {
          const startSec = sTime.time / timescale;
          const endSec = (sTime.time + sTime.duration) / timescale;
          cues.push({
            index: currentSampleIdx,
            startSec,
            endSec,
            fileOffset: currentOffset,
            byteLength: sSize,
          });
        }
        currentOffset += sSize;
        currentSampleIdx++;
      }
    }

    return {
      trackNumber,
      language: lang,
      label: trackLabel || (lang === 'id' ? 'Bahasa Indonesia' : lang === 'en' ? 'English' : `Subtitle ${trackNumber}`),
      codec,
      timescale,
      cues,
    };
  } catch (err) {
    console.warn('[parseSubtitleTrak] Notice:', err);
    return null;
  }
}

/**
 * Fetches MP4 metadata via HTTP Range requests and extracts all softcoded subtitle tracks
 */
export async function detectMp4Subtitles(
  videoUrl: string,
  options: { signal?: AbortSignal; initialHeadBuf?: Uint8Array } = {}
): Promise<Mp4SubtitleTrack[]> {
  try {
    let headBuf = options.initialHeadBuf;
    let totalFileSize = 0;

    if (!headBuf || headBuf.length < 16) {
      // 1. Fetch first 256KB to inspect ftyp, moov, and initial tracks
      const headRes = await fetch(videoUrl, {
        headers: { Range: 'bytes=0-262143' },
        signal: options.signal,
      });
      if (!headRes.ok) return [];

      const contentRange = headRes.headers.get('content-range') || '';
      const matchSize = contentRange.match(/\/(\d+)$/);
      if (matchSize) totalFileSize = parseInt(matchSize[1], 10);

      headBuf = new Uint8Array(await headRes.arrayBuffer());
      if (headBuf.length < 16) return [];
    }

    let moovStart = -1;
    let moovSize = 0;

    // Scan top-level boxes
    let pos = 0;
    while (pos <= headBuf.length - 8) {
      const size = readUint32(headBuf, pos);
      const type = readAscii(headBuf, pos + 4, 4);
      if (type === 'moov') {
        moovStart = pos;
        moovSize = size;
        break;
      }
      if (size <= 0) break;
      pos += size;
    }

    // If moov not found in first 256KB, check end of file (non-faststart MP4)
    if (moovStart === -1 && totalFileSize > 262144) {
      const tailStart = Math.max(0, totalFileSize - 1048576);
      const tailRes = await fetch(videoUrl, {
        headers: { Range: `bytes=${tailStart}-${totalFileSize - 1}` },
        signal: options.signal,
      });
      if (tailRes.ok) {
        const tailBuf = new Uint8Array(await tailRes.arrayBuffer());
        let tPos = 0;
        while (tPos <= tailBuf.length - 8) {
          const size = readUint32(tailBuf, tPos);
          const type = readAscii(tailBuf, tPos + 4, 4);
          if (type === 'moov') {
            moovStart = tailStart + tPos;
            moovSize = size;
            break;
          }
          if (size <= 0) break;
          tPos += size;
        }
      }
    }

    if (moovStart === -1 || moovSize <= 8) return [];

    const tracks: Mp4SubtitleTrack[] = [];
    let curFileOffset = moovStart + 8; // skip moov box header
    const moovEnd = moovStart + moovSize;

    // Scan child boxes inside moov
    while (curFileOffset < moovEnd) {
      if (options.signal?.aborted) break;

      // Read box header (first 1024 bytes is enough to check if trak is subtitle)
      const chunkRes = await fetch(videoUrl, {
        headers: { Range: `bytes=${curFileOffset}-${Math.min(moovEnd - 1, curFileOffset + 1023)}` },
        signal: options.signal,
      });
      if (!chunkRes.ok) break;

      const chunkBuf = new Uint8Array(await chunkRes.arrayBuffer());
      if (chunkBuf.length < 8) break;

      const boxSize = readUint32(chunkBuf, 0);
      const boxType = readAscii(chunkBuf, 4, 4);
      if (boxSize <= 0) break;

      if (boxType === 'trak') {
        // Check if this trak has a subtitle handler
        const hdlrIdx = findBoxIn(chunkBuf, 'hdlr');
        const isSubtitleTrak =
          hdlrIdx &&
          hdlrIdx.payload.length >= 12 &&
          ['text', 'sbtl', 'subt', 'clcp'].includes(
            readAscii(hdlrIdx.payload, 8, 4).toLowerCase()
          );

        if (isSubtitleTrak) {
          // Fetch the full subtitle trak box (typically small: 500B - 50KB)
          let trakBuf = chunkBuf;
          if (boxSize > chunkBuf.length) {
            const trakRes = await fetch(videoUrl, {
              headers: { Range: `bytes=${curFileOffset}-${curFileOffset + boxSize - 1}` },
              signal: options.signal,
            });
            if (trakRes.ok) {
              trakBuf = new Uint8Array(await trakRes.arrayBuffer());
            }
          }

          const parsed = parseSubtitleTrak(trakBuf, tracks.length + 1);
          if (parsed && parsed.cues.length > 0) {
            tracks.push(parsed);
          }
        }
      }

      curFileOffset += boxSize;
    }

    return tracks;
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('[detectMp4Subtitles] Warning:', err?.message);
    }
    return [];
  }
}

/**
 * Fetches and decodes subtitle cue samples for a given playback time range
 */
export async function fetchMp4CuesForRange(
  track: Mp4SubtitleTrack,
  startSec: number,
  endSec: number,
  videoUrl: string,
  options: { signal?: AbortSignal; fetchedCuesSet?: Set<number> } = {}
): Promise<{ index: number; startSec: number; endSec: number; text: string }[]> {
  const result: { index: number; startSec: number; endSec: number; text: string }[] = [];
  const cuesToFetch: Mp4SubtitleCue[] = [];

  for (const cue of track.cues) {
    if (cue.endSec >= startSec && cue.startSec <= endSec) {
      if (options.fetchedCuesSet && options.fetchedCuesSet.has(cue.index)) {
        continue;
      }
      cuesToFetch.push(cue);
    }
  }

  if (cuesToFetch.length === 0) return result;

  // Group adjacent or nearby cues within 64KB into batched Range requests
  cuesToFetch.sort((a, b) => a.fileOffset - b.fileOffset);

  let currentBatch: Mp4SubtitleCue[] = [];
  let batchStart = 0;
  let batchEnd = 0;

  const processBatch = async (batch: Mp4SubtitleCue[], bStart: number, bEnd: number) => {
    try {
      const res = await fetch(videoUrl, {
        headers: { Range: `bytes=${bStart}-${bEnd}` },
        signal: options.signal,
      });
      if (!res.ok) return;
      const buf = new Uint8Array(await res.arrayBuffer());

      for (const cue of batch) {
        const relOffset = cue.fileOffset - bStart;
        if (relOffset >= 0 && relOffset + cue.byteLength <= buf.length) {
          const sampleData = buf.subarray(relOffset, relOffset + cue.byteLength);
          const decoded = decodeMp4SubtitleSample(sampleData, track.codec);
          if (options.fetchedCuesSet) options.fetchedCuesSet.add(cue.index);
          if (decoded && decoded.trim()) {
            result.push({
              index: cue.index,
              startSec: cue.startSec,
              endSec: cue.endSec,
              text: decoded,
            });
          }
        }
      }
    } catch {}
  };

  for (const cue of cuesToFetch) {
    if (cue.byteLength <= 2) {
      if (options.fetchedCuesSet) options.fetchedCuesSet.add(cue.index);
      continue;
    }

    if (currentBatch.length === 0) {
      currentBatch.push(cue);
      batchStart = cue.fileOffset;
      batchEnd = cue.fileOffset + cue.byteLength - 1;
    } else if (cue.fileOffset <= batchEnd + 65536 && cue.fileOffset + cue.byteLength - 1 - batchStart < 262144) {
      currentBatch.push(cue);
      batchEnd = Math.max(batchEnd, cue.fileOffset + cue.byteLength - 1);
    } else {
      await processBatch(currentBatch, batchStart, batchEnd);
      currentBatch = [cue];
      batchStart = cue.fileOffset;
      batchEnd = cue.fileOffset + cue.byteLength - 1;
    }
  }

  if (currentBatch.length > 0) {
    await processBatch(currentBatch, batchStart, batchEnd);
  }

  return result;
}
