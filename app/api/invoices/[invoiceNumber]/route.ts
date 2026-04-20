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
    const now = new Date().toISOString();
    const note = {
      text: String(body.noteText),
      timestamp: now,
      createdAt: now,
      addedBy: String(body.addedBy || 'Admin'),
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
    const deliveryStatus = String(body.deliveryStatus || '').trim().toLowerCase();
    if (!['delivered', 'pending'].includes(deliveryStatus)) {
      return NextResponse.json({ error: 'deliveryStatus must be delivered or pending' }, { status: 400 });
    }

    const deliveryPerson = typeof body.deliveryPerson === 'string' ? body.deliveryPerson.trim() : '';
    if (deliveryStatus === 'delivered' && !deliveryPerson) {
      return NextResponse.json({ error: 'deliveryPerson is required when marking delivered' }, { status: 400 });
    }

    const update: Record<string, any> = {
      deliveryStatus,
      deliveryPerson: deliveryStatus === 'delivered' ? deliveryPerson : null,
    };
    if (deliveryStatus === 'delivered') {
      update.deliveredAt = new Date().toISOString();
    } else {
      update.deliveredAt = null;
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
