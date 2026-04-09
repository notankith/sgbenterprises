import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ invoiceNumber: string }> }) {
  if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { invoiceNumber } = await params;
  const body = await req.json();
  const db = await getDb();
  const agentId = body.agentId ? String(body.agentId) : undefined;
  const invoiceId = body.invoiceId ? String(body.invoiceId) : undefined;

  if (body.noteText) {
    const note = {
      text: String(body.noteText),
      timestamp: new Date().toISOString(),
      agentId,
      invoiceId,
    };
    await db.collection('invoices').updateOne(
      { invoiceNumber },
      { $push: { notes: note } as any },
    );
    return NextResponse.json({ success: true });
  }

  if (body.deliveryStatus) {
    const update: Record<string, any> = {
      deliveryStatus: body.deliveryStatus,
      deliveryPerson: body.deliveryPerson || null,
    };
    if (body.deliveryStatus === 'delivered') {
      update.deliveredAt = new Date().toISOString();
    }
    if (agentId) update.assignedAgentId = body.agentId;

    await db.collection('invoices').updateOne(
      { invoiceNumber },
      { $set: update },
    );
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'No valid update payload provided' }, { status: 400 });
}
