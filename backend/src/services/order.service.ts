import { randomUUID } from 'crypto';
import Order from '../models/Order';
import Product from '../models/Product';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../socket';
import { logger } from '../utils/logger';
import type { OrderStatus } from '../models/Order';

export interface OrderFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  sort?: string;
  startDate?: string;
  endDate?: string;
}

export class OrderService {
  async list(filters: OrderFilters) {
    const { page = 1, limit = 10, search = '', status = '', paymentStatus = '', sort = '-createdAt', startDate, endDate } = filters;

    const query: Record<string, unknown> = {};
    if (search) query.orderNumber = { $regex: search, $options: 'i' };
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) (query.createdAt as Record<string, Date>).$gte = new Date(startDate);
      if (endDate) (query.createdAt as Record<string, Date>).$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Order.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('customer', 'name email avatar'),
      Order.countDocuments(query),
    ]);

    return { items, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) };
  }

  async findById(id: string) {
    const order = await Order.findById(id)
      .populate('customer', 'name email avatar phone address')
      .populate('items.product', 'name thumbnail');
    if (!order) throw ApiError.fromCode('RESOURCE_NOT_FOUND', 'Order not found');
    return order;
  }

  async create(data: Record<string, unknown>) {
    const items = data.items as Array<{ product: string; quantity: number; price?: number }>;

    // Resolve prices from DB and check stock
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.product);
        if (!product) throw ApiError.fromCode('RESOURCE_NOT_FOUND', `Product ${item.product} not found`);
        if (product.stock < item.quantity)
          throw new ApiError(400, `Insufficient stock for "${product.name}"`, [], true, '', 'VALIDATION_FAILED');

        return {
          product: item.product,
          name: product.name,
          thumbnail: product.thumbnail,
          price: product.price,
          quantity: item.quantity,
          subtotal: product.price * item.quantity,
        };
      })
    );

    const subtotal = enrichedItems.reduce((s, i) => s + i.subtotal, 0);
    const tax = parseFloat((subtotal * 0.1).toFixed(2));
    const shipping = subtotal > 100 ? 0 : 9.99;
    const discount = (data.discount as number) ?? 0;
    const total = parseFloat((subtotal + tax + shipping - discount).toFixed(2));

    const order = await Order.create({
      ...data,
      orderNumber: `ORD-${randomUUID().slice(0, 8).toUpperCase()}`,
      items: enrichedItems,
      subtotal,
      tax,
      shipping,
      discount,
      total,
      statusHistory: [{ status: 'pending', timestamp: new Date() }],
    });

    // Decrement stock
    await Promise.all(
      enrichedItems.map((i) =>
        Product.findByIdAndUpdate(i.product, { $inc: { stock: -i.quantity, totalSales: i.quantity } })
      )
    );

    // Emit realtime event
    try { getIO().emit('order:created', { orderId: order._id.toString(), total: order.total }); } catch {}

    return order;
  }

  async updateStatus(id: string, status: OrderStatus, note?: string) {
    const order = await Order.findById(id);
    if (!order) throw ApiError.fromCode('RESOURCE_NOT_FOUND', 'Order not found');

    const prevStatus = order.status;
    order.status = status;
    order.statusHistory.push({ status, timestamp: new Date(), note } as never);

    // Auto-set paymentStatus on delivery/refund
    if (status === 'delivered') order.paymentStatus = 'paid';
    if (status === 'refunded') order.paymentStatus = 'refunded';

    // Restore stock on cancellation
    if (status === 'cancelled' && prevStatus !== 'cancelled') {
      await Promise.all(
        order.items.map((i) =>
          Product.findByIdAndUpdate(i.product, { $inc: { stock: i.quantity, totalSales: -i.quantity } })
        )
      );
    }

    await order.save();

    try {
      getIO().emit('order:statusUpdated', { orderId: order._id, status, prevStatus });
    } catch {
      logger.warn('Could not emit order status update via socket');
    }

    return order;
  }

  async remove(id: string) {
    const order = await Order.findById(id);
    if (!order) throw ApiError.fromCode('RESOURCE_NOT_FOUND', 'Order not found');
    await order.deleteOne();
  }

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [revenue, byStatus, byDay] = await Promise.all([
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 }, avg: { $avg: '$total' } } },
      ]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return {
      totalRevenue: revenue[0]?.total ?? 0,
      totalOrders: revenue[0]?.count ?? 0,
      avgOrderValue: revenue[0]?.avg ?? 0,
      byStatus,
      revenueByDay: byDay,
      monthOrders: await Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
    };
  }
}

export const orderService = new OrderService();
