import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const firm = String(req.nextUrl.searchParams.get('firm') || '').trim().toUpperCase();
    const route = String(req.nextUrl.searchParams.get('route') || '').trim();

    const filter: Record<string, any> = {};
    if (firm) filter.firm = firm;
    if (route) filter.route = { $regex: route, $options: 'i' };

    const db = await getDb();
    const rows = await db.collection('expenses').find(filter).sort({ date: -1 }).toArray();
    return NextResponse.json(rows.map((r) => ({ ...r, _id: r._id.toString() })));
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while loading expenses.' },
      { status: 500 },
    );
  }
}

// Create expense directly from admin
export async function POST(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const db = await getDb();
    const now = new Date().toISOString();

    const date = String(body.date || '').trim();
    const amount = Number(body.amount || 0);
    const category = String(body.category || body.type || '').trim();
    const paidBy = String(body.paidBy || body.addedBy || 'Admin').trim();

    if (!date || !category || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'date, category, and valid amount are required' }, { status: 400 });
    }

    await db.collection('expenses').insertOne({
      date,
      amount,
      category,
      addedBy: paidBy || 'Admin',
      notes: String(body.notes || '').trim(),
      status: 'approved',
      approvedAt: now,
      createdAt: now,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while creating expense.' },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const db = await getDb();
    await db.collection('expenses').updateOne(
      { _id: new ObjectId(body.id) },
      {
        $set: {
          date: body.date,
          amount: Number(body.amount),
          category: body.category,
          addedBy: body.addedBy,
          notes: body.notes || '',
        },
      },
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while updating expense.' },
      { status: 500 },
    );
  }
}
