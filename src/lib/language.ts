/**
 * Central Language Utilities & Badge Formatting for LeviStream
 */

export function normalizeLangCode(code?: string): string {
  if (!code) return 'ID';
  const clean = String(code).trim().toUpperCase();
  if (clean === 'ID' || clean === 'IND' || clean === 'INDONESIA') return 'ID';
  if (clean === 'MS' || clean === 'MY' || clean === 'MALAY' || clean === 'MELAYU') return 'MS';
  if (clean === 'KR' || clean === 'KO' || clean === 'KOR' || clean === 'KOREA') return 'KR';
  if (clean === 'EN' || clean === 'ENG' || clean === 'ENGLISH' || clean === 'US' || clean === 'UK') return 'EN';
  if (clean === 'ANIME') return 'ANIME';
  if (clean === 'JP' || clean === 'JA' || clean === 'JPN' || clean === 'JAPAN') return 'JP';
  if (clean === 'TH' || clean === 'THA' || clean === 'THAILAND') return 'TH';
  if (clean === 'CN' || clean === 'ZH' || clean === 'ZHO' || clean === 'CHI' || clean === 'CHINA' || clean === 'MANDARIN') return 'CN';
  return clean;
}

export interface LanguageBadgeInfo {
  code: string;
  label: string;
  fullBadge: string;
  bg: string;
  text: string;
  border: string;
}

export function getLanguageBadge(code?: string): LanguageBadgeInfo {
  const norm = normalizeLangCode(code);
  switch (norm) {
    case 'MS':
      return {
        code: 'MS',
        label: 'Melayu',
        fullBadge: 'MS • Melayu',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'ID':
      return {
        code: 'ID',
        label: 'Indonesia',
        fullBadge: 'ID • Indonesia',
        bg: 'bg-cyan-500/10',
        text: 'text-cyan-400',
        border: 'border-cyan-500/30',
      };
    case 'KR':
      return {
        code: 'KR',
        label: 'Korea',
        fullBadge: 'KR • Korea',
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
      };
    case 'JP':
      return {
        code: 'JP',
        label: 'Jepang',
        fullBadge: 'JP • Jepang',
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
      };
    case 'ANIME':
      return {
        code: 'ANIME',
        label: 'Anime',
        fullBadge: 'ANIME',
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
      };
    case 'TH':
      return {
        code: 'TH',
        label: 'Thailand',
        fullBadge: 'TH • Thailand',
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
      };
    case 'CN':
      return {
        code: 'CN',
        label: 'Mandarin',
        fullBadge: 'CN • Mandarin',
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
      };
    case 'EN':
      return {
        code: 'EN',
        label: 'English',
        fullBadge: 'EN • English',
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
      };
    default:
      return {
        code: norm || 'ID',
        label: norm || 'Indonesia',
        fullBadge: norm || 'ID',
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
      };
  }
}

export const LANGUAGE_OPTIONS = [
  { value: 'ID', label: 'ID - Indonesia' },
  { value: 'MS', label: 'MS - Melayu / Malaysia' },
  { value: 'EN', label: 'EN - English' },
  { value: 'KR', label: 'KR - Korea / K-Drama' },
  { value: 'JP', label: 'JP - Jepang' },
  { value: 'ANIME', label: 'ANIME - Jepang / Animasi' },
  { value: 'TH', label: 'TH - Thailand' },
  { value: 'CN', label: 'CN - China / Mandarin' },
];
