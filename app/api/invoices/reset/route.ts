import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

const MODES = new Set(['all', 'paid']);

export async function POST(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || '').trim().toLowerCase();

    if (!MODES.has(mode)) {
      return NextResponse.json({ error: 'mode must be one of: all, paid' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date().toISOString();

    if (mode === 'all') {
      const [invoiceResult, tripResult, paymentResult, chequeResult, approvalResult] = await Promise.all([
        db.collection('invoices').deleteMany({}),
        db.collection('trip_sheets').deleteMany({}),
        db.collection('payments').deleteMany({}),
        db.collection('cheques').deleteMany({}),
        db.collection('approvals').deleteMany({ type: 'payment' }),
      ]);

      return NextResponse.json({
        success: true,
        mode,
        removed: {
          invoices: invoiceResult.deletedCount,
          tripSheets: tripResult.deletedCount,
          payments: paymentResult.deletedCount,
          cheques: chequeResult.deletedCount,
          paymentApprovals: approvalResult.deletedCount,
        },
      });
    }

    const paidInvoices = await db
      .collection('invoices')
      .find({ paymentStatus: 'paid' })
      .project({ _id: 1, invoiceNumber: 1 })
      .toArray();

    const invoiceNumbers = paidInvoices
      .map((x) => String(x.invoiceNumber || '').trim())
      .filter(Boolean);

    if (!invoiceNumbers.length) {
      return NextResponse.json({
        success: true,
        mode,
        removed: { invoices: 0, tripSheetsTouched: 0, payments: 0, cheques: 0, paymentApprovals: 0 },
      });
    }

    const invoiceObjectIds = paidInvoices.map((x) => x._id).filter(Boolean);

    const [invoiceResult, paymentResult, chequeResult, approvalResult, tripUpdateResult] = await Promise.all([
      db.collection('invoices').deleteMany({ invoiceNumber: { $in: invoiceNumbers } }),
      db.collection('payments').deleteMany({ invoiceNumber: { $in: invoiceNumbers } }),
      db.collection('cheques').deleteMany({ invoiceNumber: { $in: invoiceNumbers } }),
      db.collection('approvals').deleteMany({ type: 'payment', 'payload.invoiceNumber': { $in: invoiceNumbers } }),
      db.collection('trip_sheets').updateMany(
        { $or: [{ invoiceNumbers: { $in: invoiceNumbers } }, { invoiceIds: { $in: invoiceObjectIds } }] },
        {
          $pull: {
            invoiceNumbers: { $in: invoiceNumbers },
            invoiceIds: { $in: invoiceObjectIds },
          } as any,
          $set: { updatedAt: now },
        },
      ),
    ]);

    await db.collection('trip_sheets').updateMany(
      { invoiceNumbers: { $size: 0 } },
      { $set: { status: 'Complete', completedAt: now, updatedAt: now } },
    );

    return NextResponse.json({
      success: true,
      mode,
      removed: {
        invoices: invoiceResult.deletedCount,
        tripSheetsTouched: tripUpdateResult.modifiedCount,
        payments: paymentResult.deletedCount,
        cheques: chequeResult.deletedCount,
        paymentApprovals: approvalResult.deletedCount,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error while resetting invoices.' }, { status: 500 });
  }
}
