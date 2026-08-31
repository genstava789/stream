declare module 'next/dist/lib/metadata/types/metadata-interface.js' {
  export type ResolvingMetadata = any;
  export type ResolvingViewport = any;
}

declare module 'next/server.js' {
  import type { NextRequest as _NextRequest, NextResponse as _NextResponse } from 'next/server';
  export type NextRequest = _NextRequest;
  export type NextResponse = _NextResponse;
  export const NextRequest: any;
  export const NextResponse: any;
}

declare module 'plyr';
declare module 'plyr-react';
declare module 'matroska-subtitles';
