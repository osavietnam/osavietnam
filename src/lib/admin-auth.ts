import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'osa_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;

const env = (name: string) => process.env[name]?.trim() ?? '';

const encode = (value: string | Buffer) => Buffer.from(value).toString('base64url');

export function verifyAdminPassword(username: string, password: string) {
  const expectedUser = env('ADMIN_USERNAME');
  const encodedHash = env('ADMIN_PASSWORD_HASH');
  const [algorithm, salt, expected] = encodedHash.split('$');
  if (!expectedUser || username !== expectedUser || algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'base64url');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function createAdminSession(username: string) {
  const secret = env('ADMIN_SESSION_SECRET');
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured');
  const payload = encode(JSON.stringify({ username, expires: Date.now() + SESSION_SECONDS * 1000 }));
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readAdminSession(request: Request) {
  const secret = env('ADMIN_SESSION_SECRET');
  if (!secret) return null;
  const cookies = request.headers.get('cookie') ?? '';
  const token = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { username?: string; expires?: number };
    if (!session.username || !session.expires || session.expires <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function sessionCookie(value: string) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function requestIsSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

