import { body, query, param } from 'express-validator';

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

export const createOrderValidation = [
  body('customer').trim().notEmpty().withMessage('Customer ID is required').isMongoId(),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').isMongoId().withMessage('Invalid product ID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('paymentMethod').trim().notEmpty().withMessage('Payment method is required'),
  body('shippingAddress.fullName').trim().notEmpty().withMessage('Shipping name is required'),
  body('shippingAddress.address').trim().notEmpty().withMessage('Address is required'),
  body('shippingAddress.city').trim().notEmpty().withMessage('City is required'),
  body('shippingAddress.country').trim().notEmpty().withMessage('Country is required'),
  body('shippingAddress.zipCode').trim().notEmpty().withMessage('Zip code is required'),
];

export const updateOrderStatusValidation = [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('status').isIn(ORDER_STATUSES).withMessage('Invalid order status'),
  body('note').optional().trim().isLength({ max: 500 }),
];

export const orderQueryValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn([...ORDER_STATUSES, '']),
  query('paymentStatus').optional().isIn(['pending', 'paid', 'failed', 'refunded', '']),
];
