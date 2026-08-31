declare module 'matroska-subtitles' {
  export class SubtitleParser {
    constructor();
    once(event: 'tracks', listener: (tracks: any[]) => void): this;
    on(event: 'subtitle', listener: (subtitle: any, trackNumber: number) => void): this;
    on(event: 'file', listener: (file: any) => void): this;
    write(chunk: Uint8Array | Buffer): boolean;
    end(): void;
  }
}
