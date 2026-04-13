import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

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
