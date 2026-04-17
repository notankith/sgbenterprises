import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, scryptSync } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isLoggedInRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid agent id' }, { status: 400 });
    }

    const body = await req.json();
    const password = String(body.password || '').trim();
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const result = await db.collection('delivery_agents').updateOne(
      { _id: new ObjectId(id), active: { $ne: false } },
      {
        $set: {
          passwordHash: hashPassword(password),
          updatedAt: now,
          passwordResetAt: now,
        },
      },
    );

    if (!result.matchedCount) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, updatedCount: Number(result.modifiedCount || 0) });
  } catch {
    return NextResponse.json({ error: 'Internal server error while updating agent password.' }, { status: 500 });
  }
}
