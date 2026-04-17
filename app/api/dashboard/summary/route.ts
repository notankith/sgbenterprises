import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

function getTotalDeducted(invoice: any) {
  if (typeof invoice?.deductedAmount === 'number') return Number(invoice.deductedAmount || 0);
  if (Array.isArray(invoice?.deductions)) {
    return invoice.deductions.reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0);
  }
  return 0;
}

function normalizePaymentStatus(totalAmount: number, amountPaid: number, deductedAmount: number): 'unpaid' | 'partial' | 'paid' | 'payable' {
  const total = Number(totalAmount || 0);
  const paid = Number(amountPaid || 0);
  const deducted = Number(deductedAmount || 0);
  const remaining = total - paid - deducted;
  const epsilon = 0.01;

  if (Math.abs(remaining) <= epsilon || Math.abs(paid + deducted - total) <= epsilon) return 'paid';
  if (remaining < -epsilon) return 'payable';
  if (remaining > epsilon && paid + deducted > epsilon) return 'partial';
  return 'unpaid';
}

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const firm = String(req.nextUrl.searchParams.get('firm') || '').trim().toUpperCase();
    const cmpCode = String(req.nextUrl.searchParams.get('cmpCode') || firm || '').trim().toUpperCase();
    const route = String(req.nextUrl.searchParams.get('route') || '').trim();

    const invoiceFilter: Record<string, any> = { archived: { $ne: true } };
    const expenseFilter: Record<string, any> = {};
    if (cmpCode) {
      invoiceFilter.$or = [{ cmpCode }, { firm: cmpCode }];
      expenseFilter.$or = [{ cmpCode }, { firm: cmpCode }];
    }
    if (route) {
      invoiceFilter.route = { $regex: route, $options: 'i' };
      expenseFilter.route = { $regex: route, $options: 'i' };
    }

    const db = await getDb();
    const [invoices, expenses, trips, cmpCodesFromCmpCode, cmpCodesFromFirm] = await Promise.all([
      db.collection('invoices').find(invoiceFilter).toArray(),
      db.collection('expenses').find(expenseFilter).toArray(),
      db.collection('trip_sheets').find({}).toArray(),
      db.collection('invoices').distinct('cmpCode', {
        archived: { $ne: true },
        cmpCode: { $exists: true, $nin: [null, ''] },
      }),
      db.collection('invoices').distinct('firm', {
        archived: { $ne: true },
        firm: { $exists: true, $nin: [null, ''] },
      }),
    ]);

    const availableCmpCodes = Array.from(
      new Set(
        [...cmpCodesFromCmpCode, ...cmpCodesFromFirm]
          .map((x) => String(x || '').trim().toUpperCase())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const totalInvoices = invoices.length;
    const paymentStatuses = invoices.map((x) =>
      normalizePaymentStatus(Number(x.totalAmount || 0), Number(x.paidAmount || 0), getTotalDeducted(x)),
    );
    const paid = paymentStatuses.filter((status) => status === 'paid').length;
    const partial = paymentStatuses.filter((status) => status === 'partial').length;
    const unpaid = paymentStatuses.filter((status) => status === 'unpaid').length;
    const delivered = invoices.filter((x) => x.deliveryStatus === 'delivered').length;
    const pendingDelivery = invoices.filter((x) => x.deliveryStatus !== 'delivered').length;

    const revenue = invoices.reduce((s, x) => s + Number(x.paidAmount || 0), 0);
    const totalDeductions = invoices.reduce((s, x) => s + getTotalDeducted(x), 0);
    const totalBilled = invoices.reduce((s, x) => s + Number(x.totalAmount || 0), 0);
    const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount || 0), 0);
    const pendingCollections = totalBilled - revenue - totalDeductions;
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
      availableCmpCodes,
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
