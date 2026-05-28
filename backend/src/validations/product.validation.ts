import { body, query } from 'express-validator';

export const createProductValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 5000 }),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
  body('comparePrice').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Compare price must be non-negative'),
  body('category').trim().notEmpty().withMessage('Category is required').isLength({ max: 100 }),
  body('sku').trim().notEmpty().withMessage('SKU is required').isLength({ max: 100 }),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('status').optional().isIn(['active', 'inactive', 'draft']).withMessage('Invalid status'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('isFeatured').optional().isBoolean(),
];

export const updateProductValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 200 }),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be non-negative'),
  body('comparePrice').optional({ nullable: true }).isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be non-negative integer'),
  body('status').optional().isIn(['active', 'inactive', 'draft']).withMessage('Invalid status'),
];

export const productQueryValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('status').optional().isIn(['active', 'inactive', 'draft', '']),
];
