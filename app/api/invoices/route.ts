import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const invoiceNumberQuery = searchParams.get('invoiceNumber') || '';
    const shopNameQuery = searchParams.get('shopName') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const amountMin = searchParams.get('amountMin') || '';
    const amountMax = searchParams.get('amountMax') || '';
    const paymentStatus = searchParams.get('paymentStatus');
    const deliveryStatus = searchParams.get('deliveryStatus');
    const page = Number(searchParams.get('page') || '1');
    const pageSize = Number(searchParams.get('pageSize') || '20');

    const db = await getDb();
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

    if (dateFrom || dateTo) {
      if (dateFrom && dateTo) {
        filter.date = { $gte: dateFrom, $lte: dateTo };
      } else if (dateFrom) {
        filter.date = { $gte: dateFrom };
      } else {
        filter.date = { $lte: dateTo };
      }
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

    const total = await db.collection('invoices').countDocuments(filter);
    const rows = await db
      .collection('invoices')
      .find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    return NextResponse.json({
      rows: rows.map((r) => ({ ...r, _id: r._id.toString() })),
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
    const { invoiceNumber, totalAmount, archive } = body;
    if (!invoiceNumber) return NextResponse.json({ error: 'invoiceNumber is required' }, { status: 400 });

    const db = await getDb();
    const updates: Record<string, any> = {};
    if (typeof totalAmount === 'number') updates.totalAmount = totalAmount;
    if (typeof archive === 'boolean') updates.archived = archive;

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
