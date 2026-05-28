import { Request, Response } from 'express';
import Order from '../models/Order';
import Product from '../models/Product';
import Customer from '../models/Customer';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { withCache, CacheKeys } from '../utils/cache';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function computeDashboardStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [
    totalRevenue,
    monthRevenue,
    lastMonthRevenue,
    totalOrders,
    monthOrders,
    totalCustomers,
    monthCustomers,
    totalProducts,
    recentOrders,
    topProducts,
    revenueByDay,
    ordersByStatus,
    customersByDay,
  ] = await Promise.all([
    Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.aggregate([{ $match: { paymentStatus: 'paid', createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.aggregate([{ $match: { paymentStatus: 'paid', createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Customer.countDocuments(),
    Customer.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Product.countDocuments({ status: 'active' }),
    Order.find().sort('-createdAt').limit(5).populate('customer', 'name email avatar'),
    Product.find().sort('-totalSales').limit(5).select('name totalSales price thumbnail'),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    // New customers per day for the last 7 days (sparkline)
    Customer.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const currentMonthRevenue = monthRevenue[0]?.total ?? 0;
  const prevMonthRevenue = lastMonthRevenue[0]?.total ?? 0;
  const revenueGrowth = prevMonthRevenue > 0
    ? parseFloat((((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100).toFixed(1))
    : 0;

  // Derive 7-day sparklines from the 30-day revenue data (last 7 entries)
  const last7Revenue = revenueByDay.slice(-7);

  return {
    overview: {
      totalRevenue: totalRevenue[0]?.total ?? 0,
      monthRevenue: currentMonthRevenue,
      revenueGrowth,
      totalOrders,
      monthOrders,
      totalCustomers,
      monthCustomers,
      totalProducts,
    },
    recentOrders,
    topProducts,
    revenueByDay,
    ordersByStatus,
    // 7-day sparklines for KPI cards
    sparklines: {
      revenue:   last7Revenue.map((d: { revenue: number }) => d.revenue),
      orders:    last7Revenue.map((d: { orders: number }) => d.orders),
      customers: customersByDay.map((d: { count: number }) => d.count),
    },
  };
}

// ── Controllers ───────────────────────────────────────────────────────────────

export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const data = await withCache(CacheKeys.dashboardStats(), computeDashboardStats, 60 * 2);
  sendSuccess(res, data);
});

export const getRevenueChart = asyncHandler(async (req: Request, res: Response) => {
  const { period = 'monthly', year = new Date().getFullYear().toString() } = req.query as Record<string, string>;

  let groupBy: Record<string, unknown>;
  if (period === 'daily') {
    groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  } else if (period === 'weekly') {
    groupBy = { $week: '$createdAt' };
  } else {
    groupBy = { $month: '$createdAt' };
  }

  const cacheKey = `analytics:revenue:${period}:${year}`;
  const data = await withCache(
    cacheKey,
    () => Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) } } },
      { $group: { _id: groupBy, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    60 * 10 // 10-minute TTL for historical chart data
  );

  sendSuccess(res, data);
});
