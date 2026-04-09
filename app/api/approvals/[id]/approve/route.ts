import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const db = await getDb();
    const approval = await db.collection('approvals').findOne({ _id: new ObjectId(id) });
    if (!approval || approval.status !== 'pending') {
      return NextResponse.json({ error: 'Approval not found or already processed' }, { status: 404 });
    }

    if (approval.type === 'payment') {
      const payload = approval.payload;
      const now = new Date().toISOString();
      const paymentRecord = {
        invoiceId: payload.invoiceId,
        agentId: payload.agentId,
        invoiceNumber: payload.invoiceNumber,
        amount: payload.amount,
        mode: payload.mode,
        reference: payload.reference,
        collectedBy: payload.collectedBy,
        date: payload.date || now.slice(0, 10),
        createdAt: now,
        approvedAt: now,
      };
      await db.collection('payments').insertOne(paymentRecord);

      const invoiceQuery = payload.invoiceId
        ? { _id: new ObjectId(payload.invoiceId) }
        : { invoiceNumber: payload.invoiceNumber };
      const invoice = await db.collection('invoices').findOne(invoiceQuery);
      if (invoice) {
        const newPaid = Number(invoice.paidAmount || 0) + Number(payload.amount || 0);
        const total = Number(invoice.totalAmount || 0);
        let paymentStatus = 'unpaid';
        if (newPaid >= total) paymentStatus = 'paid';
        else if (newPaid > 0) paymentStatus = 'partial';

        await db.collection('invoices').updateOne(
          invoiceQuery,
          {
            $set: { paidAmount: newPaid, paymentStatus },
            $push: {
              paymentHistory: {
                date: payload.date || now.slice(0, 10),
                amount: payload.amount,
                mode: payload.mode,
                collectedBy: payload.collectedBy,
                agentId: payload.agentId,
                reference: payload.reference,
                createdAt: now,
              },
            } as any,
          },
        );
      }
    }

    if (approval.type === 'expense') {
      const now = new Date().toISOString();
      await db.collection('expenses').insertOne({
        ...approval.payload,
        status: 'approved',
        approvedAt: now,
        createdAt: approval.payload?.createdAt || now,
      });
    }

    await db.collection('approvals').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'approved', approvedAt: new Date().toISOString() } },
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error while approving entry.' }, { status: 500 });
  }
}
