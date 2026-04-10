import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await getDb();
    const rows = await db.collection('expenses').find({}).sort({ date: -1 }).toArray();
    return NextResponse.json(rows.map((r) => ({ ...r, _id: r._id.toString() })));
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while loading expenses.' },
      { status: 500 },
    );
  }
}

// Create expense as pending approval
export async function POST(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const db = await getDb();
    const now = new Date().toISOString();

    const date = String(body.date || '').trim();
    const amount = Number(body.amount || 0);
    const category = String(body.category || body.type || '').trim();
    const addedBy = String(body.addedBy || 'Admin').trim();
    const notes = String(body.notes || body.note || '').trim();

    if (!date || !category || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'date, category, and valid amount are required' }, { status: 400 });
    }

    if (body.direct) {
      await db.collection('expenses').insertOne({
        date,
        amount,
        category,
        addedBy,
        notes,
        status: 'approved',
        approvedAt: now,
        createdAt: now,
      });
      return NextResponse.json({ success: true });
    }

    const approval = {
      type: 'expense',
      status: 'pending',
      createdAt: now,
      payload: {
        date,
        amount,
        category,
        addedBy,
        notes,
        agentId: body.agentId || undefined,
        type: body.type || category || 'Other',
        note: notes,
        createdAt: now,
      },
    };
    await db.collection('approvals').insertOne(approval);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while creating expense approval.' },
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
