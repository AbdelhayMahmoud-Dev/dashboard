import { Request, Response } from 'express';
import Order, { OrderStatus } from '../models/Order';
import Customer from '../models/Customer';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/ApiResponse';
import { escapeRegex } from '../utils/sanitize';
import { randomUUID } from 'crypto';

const generateOrderNumber = () => `ORD-${randomUUID().slice(0, 8).toUpperCase()}`;

export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '10',
    status = '',
    paymentStatus = '',
    search = '',
    sort = '-createdAt',
    startDate,
    endDate,
  } = req.query as Record<string, string>;

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (search) query.orderNumber = { $regex: escapeRegex(search), $options: 'i' };
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) (query.createdAt as Record<string, unknown>).$gte = new Date(startDate);
    if (endDate) (query.createdAt as Record<string, unknown>).$lte = new Date(endDate);
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('customer', 'name email avatar')
      .lean(),
    Order.countDocuments(query),
  ]);

  sendSuccess(res, orders, 'Orders retrieved', 200, {
    page: pageNum,
    limit: limitNum,
    total,
    pages: Math.ceil(total / limitNum),
  });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id)
    .populate('customer', 'name email phone avatar')
    .populate('items.product', 'name thumbnail sku')
    .lean();
  if (!order) throw new ApiError(404, 'Order not found');
  sendSuccess(res, order);
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { customerId, items, tax, shipping, discount, paymentMethod, shippingAddress, notes } =
    req.body;

  const customer = await Customer.findById(customerId);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const subtotal = items.reduce(
    (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
    0
  );
  const total = subtotal + (tax || 0) + (shipping || 0) - (discount || 0);

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    customer: customerId,
    items: items.map((item: { price: number; quantity: number; product: string; name: string; thumbnail: string }) => ({
      ...item,
      subtotal: item.price * item.quantity,
    })),
    subtotal,
    tax: tax || 0,
    shipping: shipping || 0,
    discount: discount || 0,
    total,
    paymentMethod: paymentMethod || 'card',
    shippingAddress,
    notes,
    statusHistory: [{ status: 'pending', timestamp: new Date() }],
  });

  // Update customer stats
  await Customer.findByIdAndUpdate(customerId, {
    $inc: { totalOrders: 1, totalSpent: total },
  });

  sendSuccess(res, order, 'Order created', 201);
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, note } = req.body as { status: OrderStatus; note?: string };

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  order.status = status;
  order.statusHistory.push({ status, timestamp: new Date(), note });

  if (status === 'delivered') {
    order.paymentStatus = 'paid';
  } else if (status === 'refunded') {
    order.paymentStatus = 'refunded';
    await Customer.findByIdAndUpdate(order.customer, {
      $inc: { totalSpent: -order.total },
    });
  }

  await order.save();
  sendSuccess(res, order, 'Order status updated');
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  sendSuccess(res, null, 'Order deleted');
});

export const getOrderStats = asyncHandler(async (_req: Request, res: Response) => {
  const [totalRevenue, totalOrders, statusBreakdown, revenueByMonth] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Order.countDocuments(),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]),
  ]);

  sendSuccess(res, {
    totalRevenue: totalRevenue[0]?.total || 0,
    totalOrders,
    statusBreakdown,
    revenueByMonth,
  });
});
