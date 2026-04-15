import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

function parseInvoiceDateValue(value: unknown) {
  if (value == null) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime();
  }

  const text = String(value).trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (dmy) {
    const yearRaw = dmy[3];
    const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
    return Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1]));
  }

  const dm = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (dm) {
    return Date.UTC(new Date().getFullYear(), Number(dm[2]) - 1, Number(dm[1]));
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getTime();
  }

  return null;
}

function parseDateInput(value: string, endOfDay = false) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
}

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const meta = String(searchParams.get('meta') || '').trim().toLowerCase();
    const q = searchParams.get('q') || '';
    const invoiceNumberQuery = searchParams.get('invoiceNumber') || '';
    const shopNameQuery = searchParams.get('shopName') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const amountMin = searchParams.get('amountMin') || '';
    const amountMax = searchParams.get('amountMax') || '';
    const firm = String(searchParams.get('firm') || '').trim().toUpperCase();
    const route = String(searchParams.get('route') || '').trim();
    const paymentStatus = searchParams.get('paymentStatus');
    const deliveryStatus = searchParams.get('deliveryStatus');
    const sortBy = String(searchParams.get('sortBy') || 'date').trim();
    const sortDirection = String(searchParams.get('sortDirection') || 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
    const page = Number(searchParams.get('page') || '1');
    const pageSize = Number(searchParams.get('pageSize') || '20');

    const db = await getDb();

    if (meta === 'filters') {
      const [firms, routes] = await Promise.all([
        db.collection('invoices').distinct('firm', {
          archived: { $ne: true },
          firm: { $exists: true, $nin: [null, ''] },
        }),
        db.collection('invoices').distinct('route', {
          archived: { $ne: true },
          route: { $exists: true, $nin: [null, ''] },
        }),
      ]);

      return NextResponse.json({
        firms: firms.map((x) => String(x)).filter(Boolean).sort((a, b) => a.localeCompare(b)),
        routes: routes.map((x) => String(x)).filter(Boolean).sort((a, b) => a.localeCompare(b)),
      });
    }

    const filter: Record<string, any> = { archived: { $ne: true } };

    if (invoiceNumberQuery) {
      filter.invoiceNumber = { $regex: invoiceNumberQuery, $options: 'i' };
    }

    if (shopNameQuery) {
      filter.shopName = { $regex: shopNameQuery, $options: 'i' };
    }

    if (q) {
      filter.$or = [
        { invoiceNumber: { $regex: q, $options: 'i' } },
        { shopName: { $regex: q, $options: 'i' } },
      ];
    }

    if (amountMin || amountMax) {
      filter.totalAmount = {};
      const min = Number(amountMin);
      const max = Number(amountMax);
      if (!Number.isNaN(min)) filter.totalAmount.$gte = min;
      if (!Number.isNaN(max)) filter.totalAmount.$lte = max;
      if (Object.keys(filter.totalAmount).length === 0) {
        delete filter.totalAmount;
      }
    }

    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (deliveryStatus) filter.deliveryStatus = deliveryStatus;
    if (firm) filter.firm = firm;
    if (route) filter.route = route;

    let rows = await db.collection('invoices').find(filter).toArray();

    const dateFromMs = dateFrom ? parseDateInput(dateFrom, false) : null;
    const dateToMs = dateTo ? parseDateInput(dateTo, true) : null;
    if (dateFromMs !== null || dateToMs !== null) {
      rows = rows.filter((row) => {
        const rowDate = parseInvoiceDateValue(row.date);
        if (rowDate === null) return false;
        if (dateFromMs !== null && rowDate < dateFromMs) return false;
        if (dateToMs !== null && rowDate > dateToMs) return false;
        return true;
      });
    }

    const direction = sortDirection === 'asc' ? 1 : -1;
    rows.sort((left, right) => {
      const leftValue = sortBy === 'date'
        ? parseInvoiceDateValue(left.date) ?? parseInvoiceDateValue(left.createdAt) ?? 0
        : sortBy === 'totalAmount'
          ? Number(left.totalAmount || 0)
          : String(left[sortBy] ?? '').toLowerCase();
      const rightValue = sortBy === 'date'
        ? parseInvoiceDateValue(right.date) ?? parseInvoiceDateValue(right.createdAt) ?? 0
        : sortBy === 'totalAmount'
          ? Number(right.totalAmount || 0)
          : String(right[sortBy] ?? '').toLowerCase();

      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      return String(left.invoiceNumber || '').localeCompare(String(right.invoiceNumber || ''), 'en', { numeric: true });
    });

    const total = rows.length;
    const pagedRows = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

    return NextResponse.json({
      rows: pagedRows.map((r) => ({ ...r, _id: r._id.toString() })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error while fetching invoices.',
        detail: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { invoiceNumber, totalAmount, archive, firm, route } = body;
    if (!invoiceNumber) return NextResponse.json({ error: 'invoiceNumber is required' }, { status: 400 });

    const db = await getDb();
    const updates: Record<string, any> = {};
    if (typeof totalAmount === 'number') updates.totalAmount = totalAmount;
    if (typeof archive === 'boolean') updates.archived = archive;
    if (typeof firm === 'string') updates.firm = firm.trim().toUpperCase();
    if (typeof route === 'string') updates.route = route.trim();

    await db.collection('invoices').updateOne({ invoiceNumber }, { $set: updates });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error while updating invoice.',
        detail: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 },
    );
  }
}
