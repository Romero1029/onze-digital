export class WebhookUrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookUrlValidationError';
  }
}

function isPrivateIpV4(hostname: string): boolean {
  // quick IPv4 check
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;

  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b].some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;

  // RFC1918 + loopback + link-local
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;

  return false;
}

export function validateWebhookUrl(input: string): string {
  const value = (input || '').trim();
  if (!value) return '';

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WebhookUrlValidationError('URL inválida. Use uma URL completa (ex: https://...).');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new WebhookUrlValidationError('O webhook deve usar http:// ou https://.');
  }

  const hostname = url.hostname.toLowerCase();

  // block localhost and private networks to reduce SSRF/misconfiguration risk
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new WebhookUrlValidationError('O webhook não pode apontar para localhost.');
  }

  if (isPrivateIpV4(hostname)) {
    throw new WebhookUrlValidationError('O webhook não pode apontar para IPs de rede interna/privada.');
  }

  return url.toString();
}
