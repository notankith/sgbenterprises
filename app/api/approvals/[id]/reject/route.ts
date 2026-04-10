import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isLoggedInRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason || '').trim();

    const db = await getDb();
    const approval = await db.collection('approvals').findOne({ _id: new ObjectId(id) });
    if (!approval || approval.status !== 'pending') {
      return NextResponse.json({ error: 'Approval not found or already processed' }, { status: 404 });
    }

    await db.collection('approvals').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
          rejectionReason: reason || null,
        },
      },
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error while rejecting entry.' }, { status: 500 });
  }
}
