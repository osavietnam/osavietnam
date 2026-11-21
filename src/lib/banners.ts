// Cấu hình banner đọc từ src/data/banners.json (có thể sửa qua admin /admin).
// Ảnh đặt trong /public/images/banners/.
// BannerConfig có thể là 1 variant hoặc mảng nhiều variant → random mỗi lần load.

import bannersRaw from '../data/banners.json';

export interface BannerVariant {
  imageUrl: string;
  altText?: string;
  quote?: string;
  quoteText?: string;
  quoteCite?: string;
}

export type BannerConfig = BannerVariant | BannerVariant[];

interface RawVariant {
  imageUrl: string;
  altText?: string;
  quoteText?: string;
  quoteCite?: string;
}

function buildVariant(raw: RawVariant): BannerVariant {
  const quote =
    raw.quoteText
      ? `<p class="bvq-text">${raw.quoteText}</p><cite class="bvq-cite">${raw.quoteCite ?? ''}</cite>`
      : undefined;
  return {
    imageUrl: raw.imageUrl,
    altText: raw.altText,
    quote,
    quoteText: raw.quoteText,
    quoteCite: raw.quoteCite,
  };
}

const raw = bannersRaw as unknown as Record<string, RawVariant | RawVariant[]>;

export const BANNERS: Record<string, BannerConfig> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [
    k,
    Array.isArray(v) ? (v as RawVariant[]).map(buildVariant) : buildVariant(v as RawVariant),
  ])
);
