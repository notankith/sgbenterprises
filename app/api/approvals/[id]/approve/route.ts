import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

function normalizePaymentStatus(amountPaid: number, totalAmount: number): 'unpaid' | 'partial' | 'paid' {
  if (totalAmount > 0 && amountPaid >= totalAmount) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

function toObjectId(id: unknown) {
  const value = String(id || '');
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

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
      const invoiceObjectId = toObjectId(payload.invoiceId);
      const invoiceQuery = invoiceObjectId
        ? { _id: invoiceObjectId }
        : { invoiceNumber: String(payload.invoiceNumber || '') };

      const paymentRecord = {
        invoiceId: invoiceObjectId ? invoiceObjectId.toString() : String(payload.invoiceId || ''),
        agentId: payload.agentId,
        invoiceNumber: String(payload.invoiceNumber || ''),
        amount: Number(payload.amount || 0),
        mode: String(payload.mode || 'cash').toLowerCase(),
        reference: payload.reference ? String(payload.reference) : null,
        collectedBy: String(payload.collectedBy || payload.receivedBy || 'Unknown'),
        role: String(payload.role || 'driver').toLowerCase(),
        status: 'approved',
        date: payload.date || now,
        tripsheetId: payload.tripsheetId ? String(payload.tripsheetId) : null,
        chequeNumber: payload.chequeNumber ? String(payload.chequeNumber) : null,
        bankName: payload.bankName ? String(payload.bankName) : null,
        chequeStatus: payload.mode === 'cheque' ? 'pending' : null,
        createdAt: now,
        approvedAt: now,
      };
      const paymentInsertResult = await db.collection('payments').insertOne(paymentRecord);

      const invoice = await db.collection('invoices').findOne(invoiceQuery);
      if (invoice) {
        const currentPaid = Number(invoice.paidAmount || 0);
        const total = Number(invoice.totalAmount || 0);
        const isCheque = paymentRecord.mode === 'cheque';
        const newPaid = isCheque ? currentPaid : currentPaid + paymentRecord.amount;
        const paymentStatus = normalizePaymentStatus(newPaid, total);

        const historyEntry = {
          mode: paymentRecord.mode,
          amount: paymentRecord.amount,
          date: paymentRecord.date,
          collectedBy: paymentRecord.collectedBy,
          role: paymentRecord.role,
          reference: paymentRecord.reference,
          status: paymentRecord.status,
          chequeNumber: paymentRecord.chequeNumber,
          bankName: paymentRecord.bankName,
          chequeStatus: paymentRecord.chequeStatus,
          approvedAt: now,
          source: 'approval',
        };

        await db.collection('invoices').updateOne(
          invoiceQuery,
          {
            $set: { paidAmount: newPaid, paymentStatus },
            $push: {
              paymentHistory: historyEntry,
            } as any,
          },
        );

        if (isCheque) {
          await db.collection('cheques').insertOne({
            paymentId: paymentInsertResult.insertedId.toString(),
            invoiceId: paymentRecord.invoiceId,
            invoiceNumber: paymentRecord.invoiceNumber,
            chequeNumber: paymentRecord.chequeNumber,
            bankName: paymentRecord.bankName,
            amount: paymentRecord.amount,
            date: paymentRecord.date,
            status: 'pending',
            driverName: payload.driverName || paymentRecord.collectedBy,
            tripsheetId: paymentRecord.tripsheetId,
            createdAt: now,
            updatedAt: now,
          });
        }
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
