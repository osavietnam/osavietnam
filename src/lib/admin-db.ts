import mysql from 'mysql2/promise';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

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
let settingsReady: Promise<void> | undefined;
let pendingChangesReady: Promise<void> | undefined;

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

async function ensureStudioSettingsSchema() {
  settingsReady ??= database().execute(`
    CREATE TABLE IF NOT EXISTS studio_settings (
      setting_key VARCHAR(100) NOT NULL,
      setting_value LONGTEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (setting_key)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `).then(() => undefined);
  return settingsReady;
}

function settingsKey() {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured');
  return createHash('sha256').update(`osa-studio:${secret}`).digest();
}

function encryptSetting(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', settingsKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join(':');
}

function decryptSetting(value: string) {
  const [version, iv, tag, encrypted] = value.split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Invalid encrypted setting');
  const decipher = createDecipheriv('aes-256-gcm', settingsKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

export async function setStudioGithubToken(token: string) {
  await ensureStudioSettingsSchema();
  await database().execute(
    'INSERT INTO studio_settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)',
    ['github_token', encryptSetting(token)],
  );
}

export async function getStudioGithubToken() {
  if (process.env.STUDIO_GITHUB_TOKEN) return process.env.STUDIO_GITHUB_TOKEN;
  await ensureStudioSettingsSchema();
  const [rows] = await database().execute('SELECT setting_value FROM studio_settings WHERE setting_key=? LIMIT 1', ['github_token']);
  const encrypted = (rows as any[])[0]?.setting_value;
  return encrypted ? decryptSetting(String(encrypted)) : '';
}

export type StudioPendingChange = {
  path: string;
  content: Buffer | null;
  deleted: boolean;
  originalContent: Buffer | null;
  originalDeleted: boolean;
  updatedAt: string;
};

async function ensureStudioPendingChangesSchema() {
  pendingChangesReady ??= database().execute(`
    CREATE TABLE IF NOT EXISTS studio_pending_changes (
      path VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      content LONGBLOB NULL,
      deleted TINYINT(1) NOT NULL DEFAULT 0,
      original_content LONGBLOB NULL,
      original_deleted TINYINT(1) NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (path)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `).then(() => undefined);
  return pendingChangesReady;
}

const mapPendingChange = (row: any): StudioPendingChange => ({
  path: String(row.path),
  content: row.content == null ? null : Buffer.from(row.content),
  deleted: Boolean(row.deleted),
  originalContent: row.original_content == null ? null : Buffer.from(row.original_content),
  originalDeleted: Boolean(row.original_deleted),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export async function listStudioPendingChanges() {
  await ensureStudioPendingChangesSchema();
  const [rows] = await database().query('SELECT * FROM studio_pending_changes ORDER BY updated_at ASC, path ASC');
  return (rows as any[]).map(mapPendingChange);
}

export async function getStudioPendingChange(filePath: string) {
  await ensureStudioPendingChangesSchema();
  const [rows] = await database().execute('SELECT * FROM studio_pending_changes WHERE path=? LIMIT 1', [filePath]);
  return (rows as any[])[0] ? mapPendingChange((rows as any[])[0]) : null;
}

export async function stageStudioPendingChange(input: {
  path: string;
  content: Buffer | null;
  deleted: boolean;
  originalContent: Buffer | null;
  originalDeleted: boolean;
}) {
  await ensureStudioPendingChangesSchema();
  await database().execute(
    `INSERT INTO studio_pending_changes (path,content,deleted,original_content,original_deleted)
      VALUES (?,?,?,?,?)
      ON DUPLICATE KEY UPDATE content=VALUES(content),deleted=VALUES(deleted),updated_at=CURRENT_TIMESTAMP`,
    [input.path, input.content, input.deleted ? 1 : 0, input.originalContent, input.originalDeleted ? 1 : 0],
  );
}

export async function clearStudioPendingChanges() {
  await ensureStudioPendingChangesSchema();
  await database().execute('DELETE FROM studio_pending_changes');
}

export async function deleteStudioPendingChange(filePath: string) {
  await ensureStudioPendingChangesSchema();
  await database().execute('DELETE FROM studio_pending_changes WHERE path=?', [filePath]);
}
