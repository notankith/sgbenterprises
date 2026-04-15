import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await getDb();
    const status = req.nextUrl.searchParams.get('status') || 'pending';
    const filter = status === 'all' ? {} : { status };
    const rows = await db.collection('approvals').find(filter).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(rows.map((r) => ({ ...r, _id: r._id.toString() })));
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while loading approvals.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();

    if (!body.type || !body.payload) {
      return NextResponse.json({ error: 'type and payload are required' }, { status: 400 });
    }

    const db = await getDb();
    await db.collection('approvals').insertOne({
      type: body.type,
      status: 'pending',
      createdAt: new Date().toISOString(),
      payload: body.payload,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while creating approval.' },
      { status: 500 },
    );
  }
}
