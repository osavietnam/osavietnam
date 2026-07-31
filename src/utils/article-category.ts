export type ArticleCategoryTone =
  | 'green'
  | 'violet'
  | 'gold'
  | 'red'
  | 'spirituality'
  | 'philosophy'
  | 'theology'
  | 'liturgy'
  | 'news'
  | 'neutral';

export const articleCategoryTone = (category?: string): ArticleCategoryTone => {
  const value = (category ?? '').toLocaleLowerCase('vi');
  if (
    value === 'cộng đoàn'
    || value === 'dòng'
    || value === 'giáo hội'
    || value === 'giáo phận'
  ) return 'news';
  if (
    value === 'mùa vọng'
    || value === 'mùa giáng sinh'
    || value === 'mùa chay'
    || value === 'mùa phục sinh'
    || value === 'mùa thường niên'
    || value === 'lễ trọng'
    || value === 'lễ kính'
    || value === 'lễ nhớ'
  ) return 'liturgy';
  if (
    value === 'chung'
    || value === 'chú giải thánh vịnh'
    || value === 'bài giảng'
  ) return 'spirituality';
  if (value.includes('sinh hoạt') || value.includes('cộng đoàn')) return 'red';
  if (
    value.includes('thần học')
    || value.includes('kitô')
    || value.includes('ba ngôi')
    || value.includes('ân sủng')
    || value.includes('giáo hội')
    || value.includes('thánh kinh')
    || value.includes('kinh thánh')
    || value.includes('luân lý')
  ) return 'theology';
  if (
    value.includes('triết học')
    || value.includes('tri luận')
    || value.includes('siêu hình')
    || value.includes('đạo đức')
    || value.includes('nhân học')
  ) return 'philosophy';
  return 'neutral';
};

export const articleCategoryBadgeLabel = (category?: string) => category ?? '';

export const isAugustineAuthor = (author?: string) =>
  (author ?? '').toLocaleLowerCase('vi').includes('thánh augustinô');

export const articleCategoryVariant = (category?: string): number => {
  const value = (category ?? '').toLocaleLowerCase('vi').trim();
  const newsVariants: Array<[string, number]> = [
    ['cộng đoàn', 1],
    ['dòng', 2],
    ['giáo hội', 3],
    ['giáo phận', 4],
  ];
  const newsVariant = newsVariants.find(([label]) => value === label)?.[1];
  if (newsVariant) return newsVariant;
  const liturgyVariants: Array<[string, number]> = [
    ['mùa vọng', 1],
    ['mùa giáng sinh', 2],
    ['mùa chay', 3],
    ['mùa phục sinh', 4],
    ['mùa thường niên', 5],
    ['lễ trọng', 6],
    ['lễ kính', 7],
    ['lễ nhớ', 8],
  ];
  const liturgyVariant = liturgyVariants.find(([label]) => value === label)?.[1];
  if (liturgyVariant) return liturgyVariant;

  const spiritualityVariants: Array<[string, number]> = [
    ['chung', 1],
    ['chú giải thánh vịnh', 2],
    ['bài giảng', 3],
  ];
  const spiritualityVariant = spiritualityVariants.find(([label]) => value === label)?.[1];
  if (spiritualityVariant) return spiritualityVariant;
  if (value === 'triết học' || value === 'thần học') return 0;

  const variants: Array<[string, number]> = [
    ['tri luận', 1],
    ['siêu hình', 2],
    ['đạo đức', 3],
    ['nhân học', 4],
    ['kinh thánh', 1],
    ['nền tảng', 2],
    ['luân lý', 3],
    ['giáo hội', 4],
    ['kitô', 5],
  ];

  return variants.find(([label]) => value.includes(label))?.[1] ?? 0;
};
