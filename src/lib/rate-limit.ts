import { NextRequest, NextResponse } from 'next/server';

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: NextRequest) => string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

function cleanupExpiredEntries(windowMs: number) {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}

export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60000,
    max = 100,
    keyGenerator = (req: NextRequest) => {
      const forwarded = req.headers.get('x-forwarded-for');
      if (forwarded) {
        return forwarded.split(',')[0].trim();
      }
      return req.ip ?? 'unknown';
    },
  } = options;

  return function middleware(request: NextRequest) {
    cleanupExpiredEntries(windowMs);

    const key = keyGenerator(request);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      store.set(key, { count: 1, resetTime: now + windowMs });
      return NextResponse.next();
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }

    return NextResponse.next();
  };
}

export const globalLimiter = rateLimit({ windowMs: 60000, max: 100 });
export const apiLimiter = rateLimit({ windowMs: 60000, max: 30 });
export const authLimiter = rateLimit({ windowMs: 60000, max: 10 });
