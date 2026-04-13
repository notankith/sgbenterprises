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
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid trip sheet id' }, { status: 400 });
    }

    const db = await getDb();
    const tripId = new ObjectId(id);
    const trip = await db.collection('trip_sheets').findOne({ _id: tripId });

    if (!trip) {
      return NextResponse.json({ error: 'Trip sheet not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    await db.collection('trip_sheets').updateOne(
      { _id: tripId },
      {
        $set: {
          status: 'Complete',
          completedAt: now,
          updatedAt: now,
        },
      },
    );

    return NextResponse.json({ success: true, completedAt: now });
  } catch {
    return NextResponse.json({ error: 'Internal server error while completing trip sheet.' }, { status: 500 });
  }
}
