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
    const db = await getDb();
    const rows = await db.collection('trip_sheets').find({}).sort({ createdAt: -1 }).toArray();
    const invoiceNumbers = rows.flatMap((r) => (Array.isArray(r.invoiceNumbers) ? r.invoiceNumbers : [])).filter(Boolean);

    const invoices = invoiceNumbers.length
      ? await db
          .collection('invoices')
          .find({ invoiceNumber: { $in: invoiceNumbers } })
          .project({ invoiceNumber: 1, shopName: 1, totalAmount: 1, deliveryStatus: 1 })
          .toArray()
      : [];

    const invoiceMap = new Map(invoices.map((i) => [i.invoiceNumber, i]));

    const enriched = rows.map((r) => {
      const details = (r.invoiceNumbers || [])
        .map((n: string) => {
          const inv = invoiceMap.get(n);
          if (!inv) return null;
          return {
            invoiceNumber: inv.invoiceNumber,
            shopName: inv.shopName || '-',
            totalAmount: Number(inv.totalAmount || 0),
            deliveryStatus: inv.deliveryStatus || 'pending',
          };
        })
        .filter(Boolean) as Array<{ invoiceNumber: string; shopName: string; totalAmount: number; deliveryStatus: string }>;

      const totalAmount = details.reduce((sum, d) => sum + Number(d.totalAmount || 0), 0);
      const status = details.length && details.every((d) => d.deliveryStatus === 'delivered') ? 'Complete' : 'In Progress';

      return {
        ...r,
        _id: r._id.toString(),
        agentId: r.agentId ? String(r.agentId) : undefined,
        invoiceIds: Array.isArray(r.invoiceIds) ? r.invoiceIds.map((id: ObjectId) => id.toString()) : [],
        invoiceCount: details.length,
        totalAmount,
        status,
        invoices: details,
      };
    });

    return NextResponse.json(enriched);
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
