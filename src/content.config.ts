import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 2 dạng bài chính: "bai-viet" (article) và "sach" (book) — cùng schema gọn.
const baiViet = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/bai-viet' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      author: z.string().optional(),
      authorDetails: z.array(z.string()).nullish().transform((value) => value ?? []),
      category: z.string().optional(),
      subcategory: z.string().optional(),
      excerpt: z.string().optional(),
      date: z.coerce.date().optional(),
      readings: z.array(z.string()).nullish().transform((value) => value ?? []),
      image: image().optional(),
      heroImage: image().optional(),
      tags: z.array(z.string()).nullish().transform((value) => value ?? []),
      featured: z.boolean().default(false),
      language: z.enum(['vi', 'en']).default('vi'),
      translationOf: z.string().optional(),
      draft: z.boolean().default(false),
    }),
});

const sach = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/sach' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      author: z.string().optional(),
      translator: z.string().optional(),
      excerpt: z.string().optional(),
      publishYear: z.string().optional(),
      bookType: z.enum(['spiritual', 'philosophy', 'tu-thuat']).default('spiritual'),
      featured: z.boolean().default(false),
      order: z.number().optional(),
      image: image().optional(),
      draft: z.boolean().default(false),
    }),
});

// Kinh Sách (Bài đọc Giờ Kinh Sách) — nhóm theo mùa phụng vụ
const kinhSach = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/kinh-sach' }),
  schema: () =>
    z.object({
      title: z.string(),
      season: z.string().optional(),
      seasonKey: z.string().optional(),
      source: z.string().optional(),
      excerpt: z.string().optional(),
      liturgy: z.string().optional(),
      rank: z.string().optional(),
      order: z.number().optional(),
      draft: z.boolean().default(false),
    }),
});

const thanhChanPhuoc = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/thanh-chan-phuoc' }),
  schema: () =>
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      rank: z.enum(['solemn', 'feast', 'memorial', 'none']).default('none'),
      feastDay: z.number().optional(),
      feastMonth: z.number().optional(),
      imageFile: z.string().optional(),
      draft: z.boolean().default(false),
      manualFill: z.boolean().default(false),
    }),
});

const documents = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/documents' }),
  schema: () =>
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      docType: z.string().optional(),
      lang: z.enum(['vi', 'en']).default('vi'),
      translator: z.string().optional(),
      translatorNote: z.string().optional(),
      draft: z.boolean().default(false),
    }),
});

const tuThuat = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/tu-thuat' }),
  schema: () =>
    z.object({
      title: z.string(),
      order: z.number(),
      draft: z.boolean().default(false),
    }),
});

const lichSuDong = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/lich-su-dong' }),
  schema: () =>
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      sourceNote: z.string().optional(),
      period: z.string().optional(),
      order: z.number().optional(),
      excerpt: z.string().optional(),
      draft: z.boolean().default(false),
    }),
});

// Thư viện Life of Augustine từ Augnet. Mỗi entry giữ nguyên mã, category,
// tiêu đề tiếng Anh và URL nguồn; phần tiếng Việt được bổ sung dần về sau.
const augustineLife = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/augustine-life' }),
  schema: () =>
    z.object({
      code: z.string().regex(/^\d{4}$/),
      titleEn: z.string(),
      titleVi: z.string().optional().default(''),
      category: z.string(),
      categorySlug: z.string(),
      sourceUrl: z.string().url(),
      order: z.number(),
      translationStatus: z.enum(['placeholder', 'draft', 'translated']).default('placeholder'),
      draft: z.boolean().default(false),
    }),
});

// Thư viện Works of Augustine từ Augnet. Cấu trúc này giữ cả chủ đề chính và
// phân mục con (Confessions, City of God, sermons, letters, theology).
const augustineWorks = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/augustine-works' }),
  schema: () =>
    z.object({
      code: z.string().regex(/^\d{4}[A-Z]?$/),
      titleEn: z.string(),
      titleVi: z.string().optional().default(''),
      category: z.string(),
      categorySlug: z.string(),
      section: z.string().optional().default(''),
      sectionVi: z.string().optional().default(''),
      sectionSlug: z.string().optional().default(''),
      sourceUrl: z.string().url(),
      order: z.number(),
      translationStatus: z.enum(['placeholder', 'draft', 'translated']).default('placeholder'),
      draft: z.boolean().default(false),
    }),
});

const augnetHistory = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/augnet-history' }),
  schema: () =>
    z.object({
      code: z.string().regex(/^\d{4}[A-Z]?$/),
      urlCode: z.string().regex(/^\d{4}[A-Z]?$/),
      titleEn: z.string(),
      titleVi: z.string().optional().default(''),
      category: z.string(),
      categorySlug: z.string(),
      sourceUrl: z.string().url(),
      order: z.number(),
      translationStatus: z.enum(['placeholder', 'draft', 'translated']).default('placeholder'),
      draft: z.boolean().default(false),
    }),
});

const augnetCommunity = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/augnet-community' }),
  schema: () =>
    z.object({
      code: z.string().regex(/^\d{4}[A-Z]?$/),
      titleEn: z.string(),
      titleVi: z.string().optional().default(''),
      category: z.string(),
      categorySlug: z.string(),
      sourceUrl: z.string().url(),
      order: z.number(),
      translationStatus: z.enum(['placeholder', 'draft', 'translated']).default('placeholder'),
      draft: z.boolean().default(false),
    }),
});

// Các mục từ mẫu của Augustine through the Ages. Mỗi file giữ metadata nguồn
// riêng để có thể bổ sung bản dịch và mở rộng toàn bộ A–Z theo từng đợt.
const augustineEncyclopedia = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/augustine-encyclopedia' }),
  schema: () =>
    z.object({
      title: z.string(),
      titleVi: z.string().optional().default(''),
      letter: z.string().regex(/^[A-Z]$/),
      author: z.string(),
      entryType: z.enum(['article', 'cross-reference']).default('article'),
      seeAlso: z.array(z.string()).default([]),
      bibliography: z.array(z.string()).default([]),
      sourcePages: z.string().optional(),
      order: z.number(),
      translationStatus: z.enum(['placeholder', 'draft', 'translated']).default('placeholder'),
      draft: z.boolean().default(false),
    }),
});

export const collections = {
  'bai-viet': baiViet,
  sach,
  'kinh-sach': kinhSach,
  'thanh-chan-phuoc': thanhChanPhuoc,
  documents,
  'tu-thuat': tuThuat,
  'lich-su-dong': lichSuDong,
  'augustine-life': augustineLife,
  'augustine-works': augustineWorks,
  'augnet-history': augnetHistory,
  'augnet-community': augnetCommunity,
  'augustine-encyclopedia': augustineEncyclopedia,
};
