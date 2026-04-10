import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const invoices = await db.collection('invoices').find({ archived: { $ne: true } }).toArray();
    const expenses = await db.collection('expenses').find({}).toArray();
    const trips = await db.collection('trip_sheets').find({}).toArray();

  const totalInvoices = invoices.length;
  const paid = invoices.filter((x) => x.paymentStatus === 'paid').length;
  const partial = invoices.filter((x) => x.paymentStatus === 'partial').length;
  const unpaid = invoices.filter((x) => x.paymentStatus === 'unpaid').length;
  const delivered = invoices.filter((x) => x.deliveryStatus === 'delivered').length;
  const pendingDelivery = invoices.filter((x) => x.deliveryStatus !== 'delivered').length;

  const revenue = invoices.reduce((s, x) => s + Number(x.paidAmount || 0), 0);
  const totalBilled = invoices.reduce((s, x) => s + Number(x.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount || 0), 0);
  const pendingCollections = totalBilled - revenue;
  const net = revenue - totalExpenses;

  const driverMap: Record<string, { assigned: number; delivered: number }> = {};
  for (const inv of invoices) {
    const person = inv.deliveryPerson || 'Unassigned';
    if (!driverMap[person]) driverMap[person] = { assigned: 0, delivered: 0 };
    driverMap[person].assigned += 1;
    if (inv.deliveryStatus === 'delivered') driverMap[person].delivered += 1;
  }
  const driverPerformance = Object.entries(driverMap).map(([name, d]) => ({
    name,
    assigned: d.assigned,
    delivered: d.delivered,
    efficiency: d.assigned ? Math.round((d.delivered / d.assigned) * 100) : 0,
  }));

  const problemZone = {
    highPendingInvoices: unpaid > Math.max(10, totalInvoices * 0.3),
    lowPerformingDrivers: driverPerformance.filter((d) => d.assigned >= 5 && d.efficiency < 60),
    highExpenses: totalExpenses > revenue * 0.7,
  };

  const trendByMonth: Record<string, { revenue: number; expenses: number }> = {};
  for (const i of invoices) {
    const key = String(i.date || '').slice(0, 7) || 'unknown';
    if (!trendByMonth[key]) trendByMonth[key] = { revenue: 0, expenses: 0 };
    trendByMonth[key].revenue += Number(i.paidAmount || 0);
  }
  for (const e of expenses) {
    const key = String(e.date || '').slice(0, 7) || 'unknown';
    if (!trendByMonth[key]) trendByMonth[key] = { revenue: 0, expenses: 0 };
    trendByMonth[key].expenses += Number(e.amount || 0);
  }

    return NextResponse.json({
      totalInvoices,
      paid,
      partial,
      unpaid,
      delivered,
      pendingDelivery,
      revenue,
      expenses: totalExpenses,
      net,
      pendingCollections,
      tripSheets: trips.length,
      driverPerformance,
      problemZone,
      trend: Object.entries(trendByMonth)
        .map(([month, v]) => ({ month, ...v }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error while loading dashboard summary.' },
      { status: 500 },
    );
  }
}
