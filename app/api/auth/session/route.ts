import { NextRequest, NextResponse } from 'next/server';
import { isLoggedInRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: isLoggedInRequest(req) });
}
