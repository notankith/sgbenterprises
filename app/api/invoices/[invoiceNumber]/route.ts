import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
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
    const current = await db.collection('invoices').findOne(
      { invoiceNumber },
      { projection: { deliveryPerson: 1, assignedAgentId: 1 } },
    );

    const update: Record<string, any> = { deliveryStatus: body.deliveryStatus };
    const explicitDeliveryPerson = String(body.deliveryPerson || '').trim();
    const existingDeliveryPerson = String(current?.deliveryPerson || '').trim();
    let resolvedDeliveryPerson = explicitDeliveryPerson || existingDeliveryPerson;

    const candidateAgentId = agentId || String(current?.assignedAgentId || '').trim();
    if (body.deliveryStatus === 'delivered' && !resolvedDeliveryPerson && ObjectId.isValid(candidateAgentId)) {
      const agent = await db.collection('delivery_agents').findOne(
        { _id: new ObjectId(candidateAgentId) },
        { projection: { name: 1 } },
      );
      if (agent?.name) resolvedDeliveryPerson = String(agent.name).trim();
    }

    if (resolvedDeliveryPerson) {
      update.deliveryPerson = resolvedDeliveryPerson;
    }

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
