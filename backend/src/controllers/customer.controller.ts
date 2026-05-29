import { Request, Response } from 'express';
import Customer from '../models/Customer';
import Order from '../models/Order';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/ApiResponse';

export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '10',
    search = '',
    status = '',
    sort = '-createdAt',
  } = req.query as Record<string, string>;

  const query: Record<string, unknown> = {};
  if (search) query.$text = { $search: search };
  if (status) query.status = status;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [customers, total] = await Promise.all([
    Customer.find(query).sort(sort).skip(skip).limit(limitNum).lean(),
    Customer.countDocuments(query),
  ]);

  sendSuccess(res, customers, 'Customers retrieved', 200, {
    page: pageNum,
    limit: limitNum,
    total,
    pages: Math.ceil(total / limitNum),
  });
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const [customer, orders] = await Promise.all([
    Customer.findById(req.params.id).lean(),
    Order.find({ customer: req.params.id }).sort('-createdAt').limit(10).lean(),
  ]);
  if (!customer) throw new ApiError(404, 'Customer not found');
  sendSuccess(res, { customer, recentOrders: orders });
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.create(req.body);
  sendSuccess(res, customer, 'Customer created', 201);
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!customer) throw new ApiError(404, 'Customer not found');
  sendSuccess(res, customer, 'Customer updated');
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  sendSuccess(res, null, 'Customer deleted');
});
