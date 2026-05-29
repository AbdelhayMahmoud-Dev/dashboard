import { Router } from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImages,
  getCategories,
} from '../controllers/product.controller';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createProductValidation,
  updateProductValidation,
  productQueryValidation,
} from '../validations/product.validation';
import multer from 'multer';
import { ApiError } from '../utils/ApiError';

/**
 * Product image upload — hardened multer config.
 *
 *   - 5 MB per file, max 10 files per request → bounded DoS surface
 *   - Whitelist on MIME type AND filename extension → defence in depth against
 *     spoofed Content-Type headers
 *   - Uses multer.memoryStorage() → each file is held in RAM as `file.buffer`
 *     and streamed directly to Cloudinary by the controller. Nothing is ever
 *     written to disk, so this is fully serverless-compatible (Vercel).
 */
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ALLOWED_IMAGE_EXTS = /\.(jpe?g|png|webp|gif)$/i;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files:    MAX_FILES,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      return cb(new ApiError(415, `Unsupported file type: ${file.mimetype}`, [], true, '', 'UPLOAD_BAD_MIME'));
    }
    if (!ALLOWED_IMAGE_EXTS.test(file.originalname)) {
      return cb(new ApiError(415, `Unsupported file extension: ${file.originalname}`, [], true, '', 'UPLOAD_BAD_EXTENSION'));
    }
    cb(null, true);
  },
});

const router = Router();

router.use(protect);

router.get('/categories', getCategories);
router.get('/', productQueryValidation, validate, getProducts);
router.get('/:id', getProduct);
router.post('/', authorize('admin', 'super_admin', 'manager'), createProductValidation, validate, createProduct);
router.patch('/:id', authorize('admin', 'super_admin', 'manager'), updateProductValidation, validate, updateProduct);
router.delete('/:id', authorize('admin', 'super_admin'), deleteProduct);
router.post(
  '/upload/images',
  authorize('admin', 'super_admin', 'manager'),
  upload.array('images', 10),
  uploadProductImages
);

export default router;
