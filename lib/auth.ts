import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const SESSION_COOKIE = 'ld_session';

export const ADMIN_USER = 'admin';
export const ADMIN_PASS = 'admin';

export async function isLoggedInServerComponent() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value === 'ok';
}

export function isLoggedInRequest(req: NextRequest) {
  return req.cookies.get(SESSION_COOKIE)?.value === 'ok';
}

export const sessionCookieName = SESSION_COOKIE;
