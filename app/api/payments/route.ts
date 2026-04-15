import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

type PaymentMode = 'cash' | 'upi' | 'cheque';

function normalizePaymentStatus(amountPaid: number, totalAmount: number): 'unpaid' | 'partial' | 'paid' | 'payable' {
  const paid = Number(amountPaid || 0);
  const total = Number(totalAmount || 0);
  const balance = total - paid;

  if (balance < 0) return 'payable';
  if (balance === 0) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

function toObjectId(id: unknown) {
  const value = String(id || '');
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

export async function POST(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || '').toLowerCase() as PaymentMode;
    const amount = Number(body.amount);
    const invoiceNumber = String(body.invoiceNumber || '').trim();
    const invoiceObjectId = toObjectId(body.invoiceId);

    if (!invoiceObjectId && !invoiceNumber) {
      return NextResponse.json({ error: 'invoiceId or invoiceNumber is required' }, { status: 400 });
    }

    if (!['cash', 'upi', 'cheque'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid payment mode' }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ error: 'amount must be a non-zero number' }, { status: 400 });
    }

    const db = await getDb();
    const invoiceQuery = invoiceObjectId ? { _id: invoiceObjectId } : { invoiceNumber };
    const invoice = await db.collection('invoices').findOne(invoiceQuery);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const resolvedInvoiceNumber = String(invoice.invoiceNumber || invoiceNumber);
    const collectedBy = String(body.collectedBy || body.receivedBy || 'Admin').trim() || 'Admin';
    const role = String(body.role || 'admin').toLowerCase();
    const reference = body.reference ? String(body.reference) : null;
    const chequeNumber = mode === 'cheque' && body.chequeNumber ? String(body.chequeNumber) : null;
    const bankName = mode === 'cheque' && body.bankName ? String(body.bankName) : null;

    const paymentRecord = {
      invoiceId: invoice._id.toString(),
      agentId: body.agentId ? String(body.agentId) : undefined,
      invoiceNumber: resolvedInvoiceNumber,
      amount,
      mode,
      reference,
      collectedBy,
      role,
      status: 'approved',
      date: body.date || now,
      tripsheetId: body.tripsheetId ? String(body.tripsheetId) : null,
      chequeNumber,
      bankName,
      chequeStatus: mode === 'cheque' ? 'pending' : null,
      createdAt: now,
      approvedAt: now,
    };

    const paymentInsertResult = await db.collection('payments').insertOne(paymentRecord);

    const currentPaid = Number(invoice.paidAmount || 0);
    const total = Number(invoice.totalAmount || 0);
    const nextPaid = mode === 'cheque' ? currentPaid : currentPaid + amount;
    const paymentStatus = normalizePaymentStatus(nextPaid, total);

    const historyEntry = {
      mode,
      amount,
      date: paymentRecord.date,
      collectedBy,
      role,
      reference,
      status: 'approved',
      chequeNumber,
      bankName,
      chequeStatus: mode === 'cheque' ? 'pending' : null,
      approvedAt: now,
      source: 'admin',
    };

    await db.collection('invoices').updateOne(
      { _id: invoice._id },
      {
        $set: {
          paidAmount: nextPaid,
          paymentStatus,
        },
        $push: {
          paymentHistory: historyEntry,
        } as any,
      },
    );

    if (mode === 'cheque') {
      await db.collection('cheques').insertOne({
        paymentId: paymentInsertResult.insertedId.toString(),
        invoiceId: invoice._id.toString(),
        invoiceNumber: resolvedInvoiceNumber,
        chequeNumber,
        bankName,
        amount,
        date: paymentRecord.date,
        status: 'pending',
        driverName: body.driverName ? String(body.driverName) : collectedBy,
        tripsheetId: paymentRecord.tripsheetId,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      invoiceNumber: resolvedInvoiceNumber,
      paidAmount: nextPaid,
      paymentStatus,
      paymentId: paymentInsertResult.insertedId.toString(),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error while recording payment.' }, { status: 500 });
  }
}
