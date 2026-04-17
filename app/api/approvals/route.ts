import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

type PaymentMode = 'cash' | 'upi' | 'cheque' | 'credit_note';

function toObjectId(id: unknown) {
  const value = String(id || '');
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

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

async function recordApprovedPaymentDirect(db: any, payload: Record<string, any>) {
  const mode = String(payload.mode || '').toLowerCase() as PaymentMode;
  const amount = Number(payload.amount);
  const invoiceNumber = String(payload.invoiceNumber || '').trim();
  const invoiceObjectId = toObjectId(payload.invoiceId);

  if (!invoiceObjectId && !invoiceNumber) {
    return { error: 'invoiceId or invoiceNumber is required', status: 400 };
  }
  if (!['cash', 'upi', 'cheque', 'credit_note'].includes(mode)) {
    return { error: 'Invalid payment mode', status: 400 };
  }
  if (!Number.isFinite(amount) || amount === 0) {
    return { error: 'amount must be a non-zero number', status: 400 };
  }

  const invoiceQuery = invoiceObjectId ? { _id: invoiceObjectId } : { invoiceNumber };
  const invoice = await db.collection('invoices').findOne(invoiceQuery);
  if (!invoice) {
    return { error: 'Invoice not found', status: 404 };
  }

  const now = new Date().toISOString();
  const resolvedInvoiceNumber = String(invoice.invoiceNumber || invoiceNumber);
  const collectedBy = String(payload.collectedBy || payload.receivedBy || 'Admin').trim() || 'Admin';
  const role = String(payload.role || 'admin').toLowerCase();

  const paymentRecord = {
    invoiceId: invoice._id.toString(),
    agentId: payload.agentId ? String(payload.agentId) : undefined,
    invoiceNumber: resolvedInvoiceNumber,
    amount,
    mode,
    reference: payload.reference ? String(payload.reference) : null,
    collectedBy,
    role,
    status: 'approved',
    date: payload.date || now,
    tripsheetId: payload.tripsheetId ? String(payload.tripsheetId) : null,
    chequeNumber: mode === 'cheque' && payload.chequeNumber ? String(payload.chequeNumber) : null,
    bankName: mode === 'cheque' && payload.bankName ? String(payload.bankName) : null,
    chequeStatus: mode === 'cheque' ? 'pending' : null,
    proofImageUrl: payload.proofImageUrl ? String(payload.proofImageUrl) : null,
    proofImageKey: payload.proofImageKey ? String(payload.proofImageKey) : null,
    createdAt: now,
    approvedAt: now,
  };

  const paymentInsert = await db.collection('payments').insertOne(paymentRecord);
  const currentPaid = Number(invoice.paidAmount || 0);
  const total = Number(invoice.totalAmount || 0);
  const totalDeducted = getTotalDeducted(invoice);
  const nextPaid = mode === 'cheque' ? currentPaid : currentPaid + amount;
  const paymentStatus = normalizePaymentStatus(nextPaid, total, totalDeducted);

  await db.collection('invoices').updateOne(
    { _id: invoice._id },
    {
      $set: { paidAmount: nextPaid, paymentStatus },
      $push: {
        paymentHistory: {
          mode,
          amount,
          date: paymentRecord.date,
          collectedBy,
          role,
          reference: paymentRecord.reference,
          status: 'approved',
          chequeNumber: paymentRecord.chequeNumber,
          bankName: paymentRecord.bankName,
          chequeStatus: paymentRecord.chequeStatus,
          proofImageUrl: paymentRecord.proofImageUrl,
          proofImageKey: paymentRecord.proofImageKey,
          approvedAt: now,
          source: 'approval-bypass',
        },
      } as any,
    },
  );

  if (mode === 'cheque') {
    await db.collection('cheques').insertOne({
      paymentId: paymentInsert.insertedId.toString(),
      invoiceId: invoice._id.toString(),
      invoiceNumber: resolvedInvoiceNumber,
      chequeNumber: paymentRecord.chequeNumber,
      bankName: paymentRecord.bankName,
      amount,
      date: paymentRecord.date,
      status: 'pending',
      driverName: payload.driverName || collectedBy,
      tripsheetId: paymentRecord.tripsheetId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { success: true };
}

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await getDb();
    const status = req.nextUrl.searchParams.get('status') || 'pending';
    const filter = status === 'all' ? {} : { status };
    const rows = await db.collection('approvals').find(filter).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(rows.map((r) => ({ ...r, _id: r._id.toString() })));
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while loading approvals.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();

    if (!body.type || !body.payload) {
      return NextResponse.json({ error: 'type and payload are required' }, { status: 400 });
    }

    const db = await getDb();

    const isAdminPayment =
      body.type === 'payment' && String(body?.payload?.role || '').trim().toLowerCase() === 'admin';

    if (isAdminPayment) {
      const result = await recordApprovedPaymentDirect(db, body.payload || {});
      if ((result as any).error) {
        return NextResponse.json({ error: (result as any).error }, { status: (result as any).status || 400 });
      }
      return NextResponse.json({ success: true, bypassedApproval: true });
    }

    await db.collection('approvals').insertOne({
      type: body.type,
      status: 'pending',
      createdAt: new Date().toISOString(),
      payload: body.payload,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while creating approval.' },
      { status: 500 },
    );
  }
}
