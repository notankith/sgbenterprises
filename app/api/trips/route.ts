import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

function isAssignedTrip(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return !!normalized && normalized !== 'null' && normalized !== 'undefined';
}

function hasPendingBalance(invoice: {
  paymentStatus?: unknown;
  totalAmount?: unknown;
  paidAmount?: unknown;
}) {
  const payment = String(invoice.paymentStatus || 'unpaid').toLowerCase();
  const total = Number(invoice.totalAmount || 0);
  const paid = Number(invoice.paidAmount || 0);
  return payment !== 'paid' && paid < total;
}

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const dateFrom = String(req.nextUrl.searchParams.get('dateFrom') || '').trim();
    const dateTo = String(req.nextUrl.searchParams.get('dateTo') || '').trim();
    const firm = String(req.nextUrl.searchParams.get('firm') || '').trim().toUpperCase();
    const route = String(req.nextUrl.searchParams.get('route') || '').trim();

    const db = await getDb();
    const tripFilter: Record<string, any> = {};
    if (dateFrom || dateTo) {
      tripFilter.createdAt = {};
      if (dateFrom) tripFilter.createdAt.$gte = dateFrom;
      if (dateTo) tripFilter.createdAt.$lte = dateTo;
    }

    const rows = await db.collection('trip_sheets').find(tripFilter).sort({ createdAt: -1 }).toArray();

    const emptyCompletedTripIds = rows
      .filter((r) => (r.completedAt || String(r.status || '').toLowerCase() === 'complete') && (!Array.isArray(r.invoiceNumbers) || r.invoiceNumbers.length === 0))
      .map((r) => r._id.toString());

    const paymentsByTrip = new Map<string, string[]>();
    if (emptyCompletedTripIds.length) {
      const paymentRows = await db
        .collection('payments')
        .find({ tripsheetId: { $in: emptyCompletedTripIds } })
        .project({ tripsheetId: 1, invoiceNumber: 1 })
        .toArray();

      paymentRows.forEach((row) => {
        const tripId = String(row.tripsheetId || '').trim();
        const invoiceNumber = String(row.invoiceNumber || '').trim();
        if (!tripId || !invoiceNumber) return;
        if (!paymentsByTrip.has(tripId)) paymentsByTrip.set(tripId, []);
        const arr = paymentsByTrip.get(tripId)!;
        if (!arr.includes(invoiceNumber)) arr.push(invoiceNumber);
      });
    }

    const invoiceNumbers = rows
      .flatMap((r) => {
        const own = Array.isArray(r.invoiceNumbers) ? r.invoiceNumbers : [];
        if (own.length) return own;
        return paymentsByTrip.get(r._id.toString()) || [];
      })
      .filter(Boolean);

    const invoiceFilter: Record<string, any> = { invoiceNumber: { $in: invoiceNumbers } };
    if (firm) invoiceFilter.firm = firm;
    if (route) invoiceFilter.route = { $regex: route, $options: 'i' };

    const invoices = invoiceNumbers.length
      ? await db
          .collection('invoices')
          .find(invoiceFilter)
          .project({ invoiceNumber: 1, shopName: 1, totalAmount: 1, paidAmount: 1, paymentStatus: 1, deliveryStatus: 1, date: 1, firm: 1, route: 1 })
          .toArray()
      : [];

    const invoiceMap = new Map(invoices.map((i) => [i.invoiceNumber, i]));

    const enriched = rows.map((r) => {
      const historicalInvoiceNumbers = Array.isArray(r.invoiceNumbers) && r.invoiceNumbers.length
        ? r.invoiceNumbers
        : (paymentsByTrip.get(r._id.toString()) || []);

      const details = historicalInvoiceNumbers
        .map((n: string) => {
          const inv = invoiceMap.get(n);
          if (!inv) return null;
          return {
            invoiceNumber: inv.invoiceNumber,
            shopName: inv.shopName || '-',
            totalAmount: Number(inv.totalAmount || 0),
            paidAmount: Number(inv.paidAmount || 0),
            paymentStatus: String(inv.paymentStatus || 'unpaid'),
            deliveryStatus: inv.deliveryStatus || 'pending',
            date: String(inv.date || ''),
            firm: String(inv.firm || ''),
            route: String(inv.route || ''),
          };
        })
        .filter(Boolean) as Array<{ invoiceNumber: string; shopName: string; totalAmount: number; paidAmount: number; paymentStatus: string; deliveryStatus: string; date: string; firm: string; route: string }>;

      const totalAmount = details.reduce((sum, d) => sum + Number(d.totalAmount || 0), 0);
      const settledAndDelivered = details.length > 0 && details.every((d) => d.deliveryStatus === 'delivered' && (d.paymentStatus === 'paid' || Number(d.paidAmount || 0) >= Number(d.totalAmount || 0)));
      const status = r.completedAt || String(r.status || '').toLowerCase() === 'complete' ? 'Complete' : 'In Progress';

      return {
        ...r,
        _id: r._id.toString(),
        agentId: r.agentId ? String(r.agentId) : undefined,
        invoiceIds: Array.isArray(r.invoiceIds) ? r.invoiceIds.map((id: ObjectId) => id.toString()) : [],
        invoiceNumbers: historicalInvoiceNumbers,
        invoiceCount: details.length,
        totalAmount,
        status,
        completedAt: r.completedAt ? String(r.completedAt) : null,
        canComplete: !r.completedAt && settledAndDelivered,
        invoices: details,
      };
    });

    return NextResponse.json((firm || route) ? enriched.filter((x) => x.invoiceCount > 0) : enriched);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while loading trip sheets.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const db = await getDb();

    const agentId = String(body.agentId || '').trim();
    const legacyAgentName = String(body.agentName || '').trim();
    const invoiceIds = Array.from(new Set((body.invoiceIds || []) as string[])).filter(Boolean);
    const invoiceNumbers = Array.from(new Set((body.invoiceNumbers || []) as string[])).filter(Boolean);
    if ((!agentId && !legacyAgentName) || (!invoiceIds.length && !invoiceNumbers.length)) {
      return NextResponse.json({ error: 'agentId/agentName and invoiceIds/invoiceNumbers are required' }, { status: 400 });
    }

    const agent = agentId
      ? await db.collection('delivery_agents').findOne({ _id: new ObjectId(agentId) })
      : await db.collection('delivery_agents').findOne({ name: { $regex: `^${legacyAgentName}$`, $options: 'i' } });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const invoiceObjectIds = invoiceIds.map((id) => new ObjectId(id));
    const invoiceDocs = invoiceObjectIds.length
      ? await db
          .collection('invoices')
          .find({ _id: { $in: invoiceObjectIds } })
          .project({
            invoiceNumber: 1,
            paymentStatus: 1,
            totalAmount: 1,
            paidAmount: 1,
            assignedTripId: 1,
          })
          .toArray()
      : await db
          .collection('invoices')
          .find({ invoiceNumber: { $in: invoiceNumbers } })
          .project({
            invoiceNumber: 1,
            paymentStatus: 1,
            totalAmount: 1,
            paidAmount: 1,
            assignedTripId: 1,
          })
          .toArray();

    const resolvedInvoiceNumbers = invoiceDocs.map((x) => x.invoiceNumber).filter(Boolean);
    const resolvedInvoiceIds = invoiceDocs.map((x) => x._id).filter(Boolean);

    const alreadyAssigned = invoiceDocs.filter(
      (invoice) => isAssignedTrip(invoice.assignedTripId) && !hasPendingBalance(invoice),
    );

    if (alreadyAssigned.length > 0) {
      return NextResponse.json({
        error: `Invoices already assigned: ${alreadyAssigned.map((x) => x.invoiceNumber).join(', ')}`,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const trip = {
      agentId: agent._id,
      agentName: agent.name,
      invoiceIds: resolvedInvoiceIds,
      invoiceNumbers: resolvedInvoiceNumbers,
      status: 'Active',
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection('trip_sheets').insertOne(trip);

    await db.collection('invoices').updateMany(
      { _id: { $in: resolvedInvoiceIds } },
      {
        $set: {
          assignedTripId: result.insertedId.toString(),
          assignedAgentId: agent._id,
          deliveryPerson: agent.name,
        },
      },
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while creating trip sheet.' },
      { status: 500 },
    );
  }
}
