import 'server-only';
import { isIP } from 'node:net';

export function getClientIp(headers: Headers): string | null {
  for (const header of ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for']) {
    const value = headers.get(header);
    if (!value) continue;
    const ip = value.split(',')[0].trim().replace(/^::ffff:/i, '');
    if (isIP(ip)) return ip;
  }
  return null;
}
