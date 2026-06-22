import { NextRequest } from 'next/server';
import { globalLimiter, apiLimiter, authLimiter } from '@/lib/rate-limit';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/auth/')) {
    return authLimiter(request);
  }

  if (pathname.startsWith('/api/')) {
    return apiLimiter(request);
  }

  return globalLimiter(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
