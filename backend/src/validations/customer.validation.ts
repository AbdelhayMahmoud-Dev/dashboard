import { body, query } from 'express-validator';

export const createCustomerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').optional().trim().isMobilePhone('any').withMessage('Invalid phone number'),
  body('status').optional().isIn(['active', 'inactive', 'banned']).withMessage('Invalid status'),
  body('tags').optional().isArray(),
];

export const updateCustomerValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 100 }),
  body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').optional().trim().isMobilePhone('any').withMessage('Invalid phone number'),
  body('status').optional().isIn(['active', 'inactive', 'banned']).withMessage('Invalid status'),
];

export const customerQueryValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['active', 'inactive', 'banned', '']),
];
