// Adapted from pawitp/mkv-player (https://github.com/pawitp/mkv-player)
// & qgustavor/mkv-extract licensed under MIT

export interface SubtitleTrackMetadata {
  trackNumber: number;
  trackIndex: number;
  type: 'ass' | 'ssa' | 'srt';
  name?: string;
  language?: string;
  header?: string; // CodecPrivate
}

export interface ExtractedDialogue {
  trackNumber: number;
  line: string;
  startTimestamp: string;
  endTimestamp: string;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
}

function padZeroes(arr: Uint8Array): ArrayBuffer {
  const len = Math.ceil(arr.length / 2) * 2;
  const output = new Uint8Array(len);
  output.set(arr, len - arr.length);
  return output.buffer;
}

function readUnsignedInteger(data: ArrayBuffer): number {
  const view = new DataView(data);
  return data.byteLength === 2 ? view.getUint16(0) : view.getUint32(0);
}

export function formatTimestamp(timestamp: number): string {
  const seconds = Math.max(0, timestamp) / 1000;
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds - hh * 3600) / 60);
  const ss = (seconds - hh * 3600 - mm * 60).toFixed(2);

  const mmStr = mm < 10 ? `0${mm}` : `${mm}`;
  const ssStr = Number(ss) < 10 ? `0${ss}` : `${ss}`;

  return `${hh}:${mmStr}:${ssStr}`;
}

export function formatTimestampSRT(timestamp: number): string {
  const seconds = Math.max(0, timestamp) / 1000;
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds - hh * 3600) / 60);
  const ss = (seconds - hh * 3600 - mm * 60).toFixed(3);

  const hhStr = hh < 10 ? `0${hh}` : `${hh}`;
  const mmStr = mm < 10 ? `0${mm}` : `${mm}`;
  const ssStr = Number(ss) < 10 ? `0${ss}` : `${ss}`;

  return `${hhStr}:${mmStr}:${ssStr}`;
}

export class MkvSubtitleExtractor {
  private decoder: any = null;
  private tracks: number[] = [];
  private trackMetadata: Map<number, SubtitleTrackMetadata> = new Map();
  private trackFixedLines: Map<number, string[]> = new Map();
  private currentTimecode = 0;
  private lastBlockDuration = 3000;

  // Track state during EBML tag parsing
  private currentTrackNumber = 0;
  private currentTrackType = 0;
  private currentCodecPrivate = '';
  private currentLanguage = '';
  private currentName = '';

  private onTracksCallback?: (tracks: SubtitleTrackMetadata[]) => void;
  private onDialogueCallback?: (dialogue: ExtractedDialogue) => void;
  private tracksDispatched = false;

  constructor(options?: {
    onTracks?: (tracks: SubtitleTrackMetadata[]) => void;
    onDialogue?: (dialogue: ExtractedDialogue) => void;
  }) {
    this.onTracksCallback = options?.onTracks;
    this.onDialogueCallback = options?.onDialogue;
  }

  public async init() {
    const ebml = await import('ebml');
    this.decoder = new ebml.Decoder();

    this.decoder.on('data', (chunk: any[]) => {
      const [type, tag] = chunk;

      if (type === 'end') {
        if (tag.name === 'TrackEntry') {
          // TrackType 0x11 is Subtitle
          if (this.currentTrackType === 0x11 && this.currentTrackNumber) {
            const isAss =
              this.currentCodecPrivate.includes('Format:') ||
              this.currentCodecPrivate.includes('[Script Info]');
            const trackInfo: SubtitleTrackMetadata = {
              trackNumber: this.currentTrackNumber,
              trackIndex: this.tracks.length,
              type: isAss ? 'ass' : 'srt',
              header: this.currentCodecPrivate,
              language: this.currentLanguage,
              name: this.currentName,
            };

            this.tracks.push(this.currentTrackNumber);
            this.trackMetadata.set(this.currentTrackNumber, trackInfo);
            this.trackFixedLines.set(this.currentTrackNumber, []);
          }

          // Reset temp track vars
          this.currentTrackNumber = 0;
          this.currentTrackType = 0;
          this.currentCodecPrivate = '';
          this.currentLanguage = '';
          this.currentName = '';
        } else if (tag.name === 'Tracks' && !this.tracksDispatched) {
          this.tracksDispatched = true;
          if (this.onTracksCallback) {
            this.onTracksCallback(Array.from(this.trackMetadata.values()));
          }
        }
      } else if (type === 'tag') {
        switch (tag.name) {
          case 'TrackNumber':
            this.currentTrackNumber = tag.data[0];
            break;
          case 'TrackType':
            this.currentTrackType = tag.data[0];
            break;
          case 'Language':
            this.currentLanguage = tag.data.toString().toLowerCase();
            break;
          case 'Name':
            this.currentName = tag.data.toString();
            break;
          case 'CodecPrivate':
            this.currentCodecPrivate = tag.data.toString();
            break;
          case 'Timecode':
            this.currentTimecode = readUnsignedInteger(padZeroes(tag.data));
            break;
          case 'BlockDuration':
            this.lastBlockDuration = readUnsignedInteger(padZeroes(tag.data));
            break;
          case 'SimpleBlock':
          case 'Block': {
            const ebmlLib = (this.decoder as any).tools || (ebml as any).tools;
            const trackLength = ebmlLib.readVint(tag.data);
            const trackNumber = trackLength.value;

            if (this.tracks.includes(trackNumber)) {
              const meta = this.trackMetadata.get(trackNumber);
              const isASS = meta?.type === 'ass';

              const timestampArray = new Uint8Array(tag.data).slice(
                trackLength.length,
                trackLength.length + 2
              );
              const lineTimestamp = new DataView(timestampArray.buffer).getInt16(0);
              const lineData = tag.data.slice(trackLength.length + 3).toString();

              const startMs = this.currentTimecode + lineTimestamp;
              const durationMs = this.lastBlockDuration || 3000;
              const endMs = startMs + durationMs;

              const formatFn = isASS ? formatTimestamp : formatTimestampSRT;
              const startTimestamp = formatFn(startMs);
              const endTimestamp = formatFn(endMs);

              let fixedLine = '';
              let plainText = lineData;

              if (isASS) {
                const lineParts = lineData.split(',');
                // lineParts: ReadOrder, Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text
                const layer = lineParts[1] || '0';
                const rest = lineParts.slice(2).join(',');
                plainText = lineParts.slice(8).join(',');
                fixedLine = `Dialogue: ${layer},${startTimestamp},${endTimestamp},${rest}`;
              } else {
                fixedLine = `${plainText}`;
              }

              const existingLines = this.trackFixedLines.get(trackNumber);
              if (existingLines) {
                existingLines.push(fixedLine);
              }

              if (this.onDialogueCallback) {
                this.onDialogueCallback({
                  trackNumber,
                  line: fixedLine,
                  startTimestamp,
                  endTimestamp,
                  startTimeMs: startMs,
                  endTimeMs: endMs,
                  text: plainText,
                });
              }
            }
            break;
          }
        }
      }
    });
  }

  public write(chunk: Uint8Array | Buffer) {
    if (this.decoder) {
      try {
        this.decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      } catch (e) {
        // EBML write error non-fatal
      }
    }
  }

  /**
   * Builds the complete standalone ASS script for a track.
   */
  public getAssScript(trackNumber: number): string {
    const meta = this.trackMetadata.get(trackNumber);
    const lines = this.trackFixedLines.get(trackNumber) || [];
    const rawHeader = meta?.header || '';

    if (rawHeader && (rawHeader.includes('Format:') || rawHeader.includes('[Events]'))) {
      const eventMatches = rawHeader.match(/\[Events\]\s+Format:([^\r\n]*)/);
      if (eventMatches) {
        const headingParts = rawHeader.split(eventMatches[0]);
        return (
          headingParts[0] +
          eventMatches[0] +
          '\r\n' +
          lines.join('\r\n') +
          '\r\n' +
          (headingParts[1] || '')
        );
      }
    }

    // Default ASS Header if raw header lacks [Events]
    const defaultAssHeader = `[Script Info]
Title: Subtitle
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    return defaultAssHeader + lines.join('\r\n') + '\r\n';
  }

  public getTrackMetadata(trackNumber: number) {
    return this.trackMetadata.get(trackNumber);
  }

  public getAllTracks() {
    return Array.from(this.trackMetadata.values());
  }

  public destroy() {
    this.decoder = null;
    this.trackMetadata.clear();
    this.trackFixedLines.clear();
    this.tracks = [];
  }
}
