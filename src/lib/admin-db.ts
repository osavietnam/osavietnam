import mysql from 'mysql2/promise';

export type ManagedPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  author: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

let pool: mysql.Pool | undefined;
let schemaReady: Promise<void> | undefined;

function database() {
  if (pool) return pool;
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error('DATABASE_URL is not configured');
  const url = new URL(uri);
  pool = mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 5,
    enableKeepAlive: true,
    charset: 'utf8mb4',
  });
  return pool;
}

export function ensureAdminSchema() {
  schemaReady ??= database().execute(`
    CREATE TABLE IF NOT EXISTS admin_posts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(180) NOT NULL,
      title VARCHAR(255) NOT NULL,
      excerpt TEXT NOT NULL,
      body LONGTEXT NOT NULL,
      author VARCHAR(160) NOT NULL DEFAULT '',
      status ENUM('draft','published') NOT NULL DEFAULT 'draft',
      published_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY admin_posts_slug_unique (slug),
      KEY admin_posts_status_published (status, published_at)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `).then(() => undefined);
  return schemaReady;
}

const mapPost = (row: any): ManagedPost => ({
  id: Number(row.id), slug: row.slug, title: row.title, excerpt: row.excerpt ?? '', body: row.body ?? '',
  author: row.author ?? '', status: row.status,
  publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
});

export async function listAdminPosts() {
  await ensureAdminSchema();
  const [rows] = await database().query('SELECT * FROM admin_posts ORDER BY updated_at DESC');
  return (rows as any[]).map(mapPost);
}

export async function listPublishedPosts(limit = 20) {
  await ensureAdminSchema();
  const [rows] = await database().execute(
    "SELECT * FROM admin_posts WHERE status = 'published' ORDER BY COALESCE(published_at, created_at) DESC LIMIT ?",
    [Math.max(1, Math.min(limit, 100))],
  );
  return (rows as any[]).map(mapPost);
}

export async function findPublishedPost(slug: string) {
  await ensureAdminSchema();
  const [rows] = await database().execute("SELECT * FROM admin_posts WHERE slug = ? AND status = 'published' LIMIT 1", [slug]);
  return (rows as any[])[0] ? mapPost((rows as any[])[0]) : null;
}

export async function createPost(input: Omit<ManagedPost, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'>) {
  await ensureAdminSchema();
  const publishedAt = input.status === 'published' ? new Date() : null;
  const [result] = await database().execute(
    'INSERT INTO admin_posts (slug,title,excerpt,body,author,status,published_at) VALUES (?,?,?,?,?,?,?)',
    [input.slug, input.title, input.excerpt, input.body, input.author, input.status, publishedAt],
  );
  return Number((result as mysql.ResultSetHeader).insertId);
}

export async function updatePost(id: number, input: Omit<ManagedPost, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'>) {
  await ensureAdminSchema();
  await database().execute(
    `UPDATE admin_posts SET slug=?,title=?,excerpt=?,body=?,author=?,status=?,
      published_at=CASE WHEN ?='published' THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE NULL END WHERE id=?`,
    [input.slug, input.title, input.excerpt, input.body, input.author, input.status, input.status, id],
  );
}

export async function deletePost(id: number) {
  await ensureAdminSchema();
  await database().execute('DELETE FROM admin_posts WHERE id=?', [id]);
}
