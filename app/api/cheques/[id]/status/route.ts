import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

type ChequeStatus = 'pending' | 'deposited' | 'cleared' | 'bounced';

const transitions: Record<ChequeStatus, ChequeStatus[]> = {
  pending: ['deposited', 'cleared', 'bounced'],
  deposited: ['cleared', 'bounced'],
  cleared: ['bounced'],
  bounced: [],
};

function getTotalDeducted(invoice: any) {
  if (typeof invoice?.deductedAmount === 'number') return Number(invoice.deductedAmount || 0);
  if (Array.isArray(invoice?.deductions)) {
    return invoice.deductions.reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0);
  }
  return 0;
}

function normalizePaymentStatus(amountPaid: number, totalAmount: number, deductedAmount: number): 'unpaid' | 'partial' | 'paid' | 'payable' {
  const paid = Number(amountPaid || 0);
  const total = Number(totalAmount || 0);
  const deducted = Number(deductedAmount || 0);
  const balance = total - paid - deducted;
  const epsilon = 0.01;

  if (Math.abs(balance) <= epsilon || Math.abs(paid + deducted - total) <= epsilon) return 'paid';
  if (balance < -epsilon) return 'payable';
  if (balance > epsilon && paid + deducted > epsilon) return 'partial';
  return 'unpaid';
}

function toObjectId(id: unknown) {
  const value = String(id || '');
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isLoggedInRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const nextStatus = String(body.status || '').toLowerCase() as ChequeStatus;

    if (!['pending', 'deposited', 'cleared', 'bounced'].includes(nextStatus)) {
      return NextResponse.json({ error: 'Invalid cheque status' }, { status: 400 });
    }

    const db = await getDb();
    const cheque = await db.collection('cheques').findOne({ _id: new ObjectId(id) });
    if (!cheque) {
      return NextResponse.json({ error: 'Cheque not found' }, { status: 404 });
    }

    const currentStatus = String(cheque.status || 'pending') as ChequeStatus;
    if (currentStatus === nextStatus) {
      return NextResponse.json({ success: true });
    }

    if (!transitions[currentStatus]?.includes(nextStatus)) {
      return NextResponse.json(
        { error: `Invalid status transition: ${currentStatus} -> ${nextStatus}` },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    await db.collection('cheques').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: nextStatus, updatedAt: now } },
    );

    if (cheque.paymentId && ObjectId.isValid(String(cheque.paymentId))) {
      await db.collection('payments').updateOne(
        { _id: new ObjectId(String(cheque.paymentId)) },
        { $set: { chequeStatus: nextStatus, updatedAt: now } },
      );
    }

    const invoiceObjectId = toObjectId(cheque.invoiceId);
    const invoiceQuery = invoiceObjectId
      ? { _id: invoiceObjectId }
      : { invoiceNumber: String(cheque.invoiceNumber || '') };

    const invoice = await db.collection('invoices').findOne(invoiceQuery);
    if (invoice) {
      const shouldAdd = currentStatus !== 'cleared' && nextStatus === 'cleared';
      const shouldSubtract = currentStatus === 'cleared' && nextStatus === 'bounced';
      const delta = shouldAdd ? Number(cheque.amount || 0) : shouldSubtract ? -Number(cheque.amount || 0) : 0;

      if (delta !== 0) {
        const currentPaid = Number(invoice.paidAmount || 0);
        const nextPaid = Math.max(0, currentPaid + delta);
        const total = Number(invoice.totalAmount || 0);
        const totalDeducted = getTotalDeducted(invoice);

        await db.collection('invoices').updateOne(
          invoiceQuery,
          {
            $set: {
              paidAmount: nextPaid,
              paymentStatus: normalizePaymentStatus(nextPaid, total, totalDeducted),
            },
          },
        );
      }

      await db.collection('invoices').updateOne(
        invoiceQuery,
        {
          $set: {
            'paymentHistory.$[entry].chequeStatus': nextStatus,
          },
        },
        {
          arrayFilters: [
            {
              'entry.mode': 'cheque',
              'entry.chequeNumber': cheque.chequeNumber,
              'entry.amount': Number(cheque.amount || 0),
            },
          ],
        },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error while updating cheque status.' }, { status: 500 });
  }
}
