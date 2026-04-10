import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

const VALID_STATUSES = ['pending', 'deposited', 'cleared', 'bounced'] as const;

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = String(req.nextUrl.searchParams.get('status') || '').trim();
    const dateFrom = String(req.nextUrl.searchParams.get('dateFrom') || '').trim();
    const dateTo = String(req.nextUrl.searchParams.get('dateTo') || '').trim();
    const driver = String(req.nextUrl.searchParams.get('driver') || '').trim();
    const tripsheet = String(req.nextUrl.searchParams.get('tripsheet') || '').trim();

    const filter: Record<string, any> = {};

    if (status && VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      filter.status = status;
    }

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = dateFrom;
      if (dateTo) filter.date.$lte = dateTo;
      if (!Object.keys(filter.date).length) delete filter.date;
    }

    if (driver) {
      filter.driverName = { $regex: driver, $options: 'i' };
    }

    if (tripsheet) {
      filter.tripsheetId = tripsheet;
    }

    const db = await getDb();
    const rows = await db.collection('cheques').find(filter).sort({ date: -1, createdAt: -1 }).toArray();

    return NextResponse.json(rows.map((r) => ({ ...r, _id: r._id.toString() })));
  } catch {
    return NextResponse.json({ error: 'Internal server error while loading cheques.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const chequeNumber = String(body.chequeNumber || '').trim();
    const amount = Number(body.amount);
    const date = String(body.date || '').trim();
    const invoiceNumber = String(body.invoiceNumber || '').trim();
    const bankName = String(body.bankName || '').trim();
    const driverName = String(body.driverName || '').trim();
    const tripsheetId = String(body.tripsheetId || '').trim() || null;

    if (!chequeNumber || !invoiceNumber || !bankName || !date || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'chequeNumber, amount, date, invoiceNumber, and bankName are required' },
        { status: 400 },
      );
    }

    const db = await getDb();
    const duplicate = await db.collection('cheques').findOne({ chequeNumber, invoiceNumber });
    if (duplicate) {
      return NextResponse.json({ error: 'Cheque already exists for this invoice' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const record = {
      chequeNumber,
      amount,
      date,
      invoiceNumber,
      bankName,
      status: 'pending',
      driverName: driverName || null,
      tripsheetId,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('cheques').insertOne(record);
    return NextResponse.json({ success: true, cheque: { ...record, _id: result.insertedId.toString() } });
  } catch {
    return NextResponse.json({ error: 'Internal server error while creating cheque.' }, { status: 500 });
  }
}
