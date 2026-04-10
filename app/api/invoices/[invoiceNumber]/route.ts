import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

function normalizePaymentStatus(amountPaid: number, totalAmount: number): 'unpaid' | 'partial' | 'paid' {
  if (totalAmount > 0 && amountPaid >= totalAmount) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ invoiceNumber: string }> }) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { invoiceNumber } = await params;
    const db = await getDb();

    const invoice = await db.collection('invoices').findOne({ invoiceNumber });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ ...invoice, _id: invoice._id.toString() });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while loading invoice.' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ invoiceNumber: string }> }) {
  if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { invoiceNumber } = await params;
  const body = await req.json();
  const db = await getDb();
  const agentId = body.agentId ? String(body.agentId) : undefined;
  const invoiceId = body.invoiceId ? String(body.invoiceId) : undefined;

  if (body.payment) {
    const payment = body.payment as Record<string, any>;
    const requestId = String(payment.requestId || '').trim();
    const amount = Number(payment.amount || 0);
    const mode = String(payment.mode || '').toLowerCase();
    const collectedBy = String(payment.collectedBy || payment.receivedBy || '').trim();
    const date = String(payment.date || '').trim() || new Date().toISOString();
    const reference = payment.reference ? String(payment.reference).trim() : null;
    const chequeNumber = payment.chequeNumber ? String(payment.chequeNumber).trim() : null;
    const bankName = payment.bankName ? String(payment.bankName).trim() : null;

    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required for payment entry' }, { status: 400 });
    }
    if (!['cash', 'upi', 'cheque', 'credit_note'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid payment mode' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }
    if (!collectedBy) {
      return NextResponse.json({ error: 'collectedBy is required' }, { status: 400 });
    }
    if ((mode === 'upi' || mode === 'credit_note') && !reference) {
      return NextResponse.json({ error: mode === 'upi' ? 'UPI reference is required' : 'Credit note reference is required' }, { status: 400 });
    }
    if (mode === 'cheque' && (!chequeNumber || !bankName)) {
      return NextResponse.json({ error: 'Cheque number and bank name are required for cheque payments' }, { status: 400 });
    }

    const invoice = await db.collection('invoices').findOne({ invoiceNumber });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const paymentRecord = {
      requestId,
      invoiceId: invoiceId || invoice._id.toString(),
      agentId: payment.agentId || null,
      invoiceNumber,
      amount,
      mode,
      reference,
      collectedBy,
      role: 'admin',
      status: 'approved',
      date,
      tripsheetId: payment.tripsheetId ? String(payment.tripsheetId) : null,
      chequeNumber,
      bankName,
      chequeStatus: mode === 'cheque' ? 'pending' : null,
      createdAt: now,
      approvedAt: now,
      source: 'admin_direct',
    };

    await Promise.all([
      db.collection('payments').createIndex({ requestId: 1 }, { unique: true, sparse: true }),
      db.collection('cheques').createIndex({ sourceRequestId: 1 }, { unique: true, sparse: true }),
    ]);

    let paymentSaved = await db.collection('payments').findOne({ requestId });
    if (!paymentSaved) {
      try {
        const insert = await db.collection('payments').insertOne(paymentRecord);
        paymentSaved = { ...paymentRecord, _id: insert.insertedId };
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        paymentSaved = await db.collection('payments').findOne({ requestId });
      }
    }

    const historyEntry = {
      requestId,
      mode,
      amount,
      date,
      collectedBy,
      role: 'admin',
      reference,
      status: 'approved',
      chequeNumber,
      bankName,
      chequeStatus: mode === 'cheque' ? 'pending' : null,
      approvedAt: now,
      source: 'admin_direct',
    };

    const paidDelta = mode === 'cheque' ? 0 : amount;
    const invoiceUpdate = await db.collection('invoices').updateOne(
      {
        invoiceNumber,
        paymentHistory: { $not: { $elemMatch: { requestId } } },
      },
      [
        {
          $set: {
            paidAmount: { $add: [{ $ifNull: ['$paidAmount', 0] }, paidDelta] },
            paymentHistory: {
              $concatArrays: [{ $ifNull: ['$paymentHistory', []] }, [historyEntry]],
            },
          },
        },
        {
          $set: {
            paymentStatus: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [
                        { $gt: [{ $ifNull: ['$totalAmount', 0] }, 0] },
                        { $gte: ['$paidAmount', { $ifNull: ['$totalAmount', 0] }] },
                      ],
                    },
                    then: 'paid',
                  },
                  {
                    case: { $gt: ['$paidAmount', 0] },
                    then: 'partial',
                  },
                ],
                default: 'unpaid',
              },
            },
          },
        },
      ],
    );

    if (mode === 'cheque') {
      await db.collection('cheques').updateOne(
        { sourceRequestId: requestId },
        {
          $setOnInsert: {
            sourceRequestId: requestId,
            paymentId: paymentSaved?._id ? paymentSaved._id.toString() : null,
            invoiceId: invoice._id.toString(),
            invoiceNumber,
            chequeNumber,
            bankName,
            amount,
            date,
            status: 'pending',
            driverName: payment.driverName || payment.deliveryPerson || collectedBy,
            tripsheetId: payment.tripsheetId ? String(payment.tripsheetId) : null,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }

    if (invoiceUpdate.modifiedCount === 0) {
      return NextResponse.json({ success: true, duplicate: true });
    }

    const nextPaid = Math.max(0, Number(invoice.paidAmount || 0) + paidDelta);
    const nextStatus = normalizePaymentStatus(nextPaid, Number(invoice.totalAmount || 0));
    return NextResponse.json({ success: true, duplicate: false, paidAmount: nextPaid, paymentStatus: nextStatus });
  }

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
