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

async function recordApprovedPaymentDirect(db: any, payload: Record<string, any>) {
  const mode = String(payload.mode || '').toLowerCase() as PaymentMode;
  const amount = Number(payload.amount);
  const invoiceNumber = String(payload.invoiceNumber || '').trim();
  const invoiceObjectId = toObjectId(payload.invoiceId);

  if (!invoiceObjectId && !invoiceNumber) {
    throw new Error('invoiceId or invoiceNumber is required');
  }

  if (!['cash', 'upi', 'cheque'].includes(mode)) {
    throw new Error('Invalid payment mode');
  }

  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error('amount must be a non-zero number');
  }

  const invoiceQuery = invoiceObjectId ? { _id: invoiceObjectId } : { invoiceNumber };
  const invoice = await db.collection('invoices').findOne(invoiceQuery);

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const now = new Date().toISOString();
  const resolvedInvoiceNumber = String(invoice.invoiceNumber || invoiceNumber);
  const collectedBy = String(payload.collectedBy || payload.receivedBy || 'Admin').trim() || 'Admin';
  const reference = payload.reference ? String(payload.reference) : null;
  const chequeNumber = mode === 'cheque' && payload.chequeNumber ? String(payload.chequeNumber) : null;
  const bankName = mode === 'cheque' && payload.bankName ? String(payload.bankName) : null;

  const paymentRecord = {
    invoiceId: invoice._id.toString(),
    agentId: payload.agentId ? String(payload.agentId) : undefined,
    invoiceNumber: resolvedInvoiceNumber,
    amount,
    mode,
    reference,
    collectedBy,
    role: 'admin',
    status: 'approved',
    date: payload.date || now,
    tripsheetId: payload.tripsheetId ? String(payload.tripsheetId) : null,
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
    role: 'admin',
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
      driverName: payload.driverName ? String(payload.driverName) : collectedBy,
      tripsheetId: paymentRecord.tripsheetId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    success: true,
    invoiceNumber: resolvedInvoiceNumber,
    paidAmount: nextPaid,
    paymentStatus,
    paymentId: paymentInsertResult.insertedId.toString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await getDb();
    const status = req.nextUrl.searchParams.get('status') || 'pending';
    const firm = String(req.nextUrl.searchParams.get('firm') || '').trim().toUpperCase();
    const route = String(req.nextUrl.searchParams.get('route') || '').trim().toLowerCase();
    const filter = status === 'all' ? {} : { status };
    const rows = await db.collection('approvals').find(filter).sort({ createdAt: -1 }).toArray();

    if (!firm && !route) {
      return NextResponse.json(rows.map((r) => ({ ...r, _id: r._id.toString() })));
    }

    const paymentInvoiceNumbers = Array.from(
      new Set(
        rows
          .filter((r) => r.type === 'payment')
          .map((r) => String(r.payload?.invoiceNumber || '').trim())
          .filter(Boolean),
      ),
    );

    const invoiceFilter: Record<string, any> = { invoiceNumber: { $in: paymentInvoiceNumbers } };
    if (firm) invoiceFilter.firm = firm;
    if (route) invoiceFilter.route = { $regex: route, $options: 'i' };

    const invoiceRows = paymentInvoiceNumbers.length
      ? await db.collection('invoices').find(invoiceFilter).project({ invoiceNumber: 1 }).toArray()
      : [];
    const matchedPaymentInvoices = new Set(invoiceRows.map((x) => String(x.invoiceNumber || '')));

    const filtered = rows.filter((row) => {
      if (row.type === 'payment') {
        return matchedPaymentInvoices.has(String(row.payload?.invoiceNumber || ''));
      }

      const expenseFirm = String(row.payload?.firm || '').trim().toUpperCase();
      const expenseRoute = String(row.payload?.route || '').trim().toLowerCase();
      const matchesFirm = firm ? expenseFirm === firm : true;
      const matchesRoute = route ? expenseRoute.includes(route) : true;
      return matchesFirm && matchesRoute;
    });

    return NextResponse.json(filtered.map((r) => ({ ...r, _id: r._id.toString() })));
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
      body.type === 'payment' &&
      String(body.payload?.role || '').toLowerCase() === 'admin';

    if (isAdminPayment) {
      try {
        const result = await recordApprovedPaymentDirect(db, body.payload || {});
        return NextResponse.json({ ...result, bypassedApprovals: true });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to record admin payment directly.' },
          { status: 400 },
        );
      }
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
