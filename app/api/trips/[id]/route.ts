import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const db = await getDb();

    const invoiceNumbers = Array.from(new Set((body.invoiceNumbers || []) as string[]));
    await db.collection('trip_sheets').updateOne(
      { _id: new ObjectId(id) },
      { $set: { agentName: body.agentName, invoiceNumbers, updatedAt: new Date().toISOString() } },
    );

    await db.collection('invoices').updateMany(
      { assignedTripId: id, deliveryStatus: { $ne: 'delivered' } },
      { $unset: { assignedTripId: '' }, $set: { deliveryPerson: null } },
    );
    await db.collection('invoices').updateMany(
      { assignedTripId: id, deliveryStatus: 'delivered' },
      { $unset: { assignedTripId: '' } },
    );
    if (invoiceNumbers.length > 0) {
      await db.collection('invoices').updateMany(
        { invoiceNumber: { $in: invoiceNumbers } },
        { $set: { assignedTripId: id, deliveryPerson: body.agentName } },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error while updating trip sheet.' }, { status: 500 });
  }
}
