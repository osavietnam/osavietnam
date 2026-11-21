import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(projectRoot, 'temp_', 'bv-linhdao');
const outputDir = path.join(projectRoot, 'src', 'content', 'bai-viet', 'linh-dao');

const samples = [
  {
    source: 'ps127-in-illo-uno-unum.json',
    output: 'trong-duc-kito-tat-ca-nen-mot.md',
    title: 'Trong Đức Kitô, Tất Cả Nên Một',
    subtitle: 'In illo uno unum',
    author: 'Thánh Augustinô',
    category: 'Chú Giải Thánh Vịnh',
    excerpt:
      'Nhiều Kitô hữu nhưng chỉ một Đức Kitô: Đầu và các chi thể kết hợp trong cùng một Thân Thể là Hội Thánh.',
    image: '../../../assets/linh-dao/trong-duc-kito-tat-ca-nen-mot-thumbnail.jpg',
    heroImage: '../../../assets/linh-dao/trong-duc-kito-tat-ca-nen-mot-hero.jpg',
    tags: ['Hiệp nhất', 'Cộng đoàn', 'Hội Thánh', 'Thánh Vịnh 127'],
    featured: false,
  },
  {
    source: 'ps127-noi-so-hai-va-tinh-yeu-thuan-khiet.json',
    output: 'noi-so-hai-va-tinh-yeu-thuan-khiet.md',
    title: 'Nỗi Sợ Hãi và Tình Yêu Thuần Khiết',
    subtitle: 'Niềm kính sợ phát sinh từ tình yêu',
    author: 'Thánh Augustinô',
    category: 'Chú Giải Thánh Vịnh',
    excerpt:
      'Tình yêu hoàn hảo loại trừ nỗi sợ hãi, nhưng làm nảy sinh niềm kính sợ thuần khiết: sợ xa cách Thánh Nhan Thiên Chúa.',
    image: '../../../assets/linh-dao/noi-so-hai-va-tinh-yeu-thuan-khiet-thumbnail.jpg',
    heroImage: '../../../assets/linh-dao/noi-so-hai-va-tinh-yeu-thuan-khiet-hero.jpg',
    tags: ['Tình yêu', 'Kính sợ Thiên Chúa', 'Cầu nguyện', 'Thánh Vịnh 127'],
    featured: true,
  },
];

const yamlString = (value) =>
  `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ')}"`;

const renderBody = (data) => {
  const blocks = [];

  for (const section of data.sections ?? []) {
    if (section.title?.trim()) blocks.push(`## ${section.title.trim()}`);

    for (const paragraph of section.paragraphs ?? []) {
      if (paragraph.title?.trim()) blocks.push(`## ${paragraph.title.trim()}`);

      for (const subparagraph of paragraph.subparagraphs ?? []) {
        const heading = subparagraph.title?.trim() ?? '';
        const content = (subparagraph.content ?? []).map((item) => item.trim()).filter(Boolean);

        if (/^Trích dịch từ/i.test(heading)) {
          blocks.push('---', `*Nguồn: ${heading.replace(/^Trích dịch từ\s*/i, '')}*`);
          continue;
        }

        if (heading) blocks.push(`### ${heading}`);
        blocks.push(...content);
      }
    }
  }

  return `${blocks.join('\n\n').trim()}\n`;
};

await mkdir(outputDir, { recursive: true });

for (const sample of samples) {
  const raw = await readFile(path.join(sourceDir, sample.source), 'utf8');
  const data = JSON.parse(raw);
  const frontmatter = [
    '---',
    `title: ${yamlString(sample.title)}`,
    `subtitle: ${yamlString(sample.subtitle)}`,
    `author: ${yamlString(sample.author)}`,
    `category: ${yamlString(sample.category)}`,
    `excerpt: ${yamlString(sample.excerpt)}`,
    `image: ${yamlString(sample.image)}`,
    `heroImage: ${yamlString(sample.heroImage)}`,
    `tags: [${sample.tags.map(yamlString).join(', ')}]`,
    `featured: ${sample.featured}`,
    'draft: false',
    '---',
    '',
  ].join('\n');

  await writeFile(path.join(outputDir, sample.output), `${frontmatter}${renderBody(data)}`, 'utf8');
}

console.log(`Imported ${samples.length} Linh Đạo articles.`);
