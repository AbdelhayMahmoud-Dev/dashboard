import { Request, Response } from 'express';
import Product from '../models/Product';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/ApiResponse';
import cloudinary, { uploadBufferToCloudinary } from '../config/cloudinary';

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '10',
    search = '',
    category = '',
    status = '',
    sort = '-createdAt',
    minPrice,
    maxPrice,
  } = req.query as Record<string, string>;

  const query: Record<string, unknown> = {};

  if (search) query.$text = { $search: search };
  if (category) query.category = category;
  if (status) query.status = status;
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) (query.price as Record<string, number>).$gte = Number(minPrice);
    if (maxPrice) (query.price as Record<string, number>).$lte = Number(maxPrice);
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name email'),
    Product.countDocuments(query),
  ]);

  sendSuccess(res, products, 'Products retrieved', 200, {
    page: pageNum,
    limit: limitNum,
    total,
    pages: Math.ceil(total / limitNum),
  });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id).populate('createdBy', 'name email');
  if (!product) throw new ApiError(404, 'Product not found');
  sendSuccess(res, product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.create({
    ...req.body,
    createdBy: req.user!.id,
  });
  sendSuccess(res, product, 'Product created', 201);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) throw new ApiError(404, 'Product not found');
  sendSuccess(res, product, 'Product updated');
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  // Remove images from cloudinary
  for (const imageUrl of product.images) {
    const publicId = imageUrl.split('/').pop()?.split('.')[0];
    if (publicId) {
      await cloudinary.uploader.destroy(`products/${publicId}`).catch(() => {});
    }
  }

  await product.deleteOne();
  sendSuccess(res, null, 'Product deleted');
});

export const uploadProductImages = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) throw new ApiError(400, 'No files uploaded');

  // Serverless-safe: stream each in-memory buffer (from multer.memoryStorage)
  // straight to Cloudinary. No `file.path` / local temp file involved.
  const uploadPromises = files.map((file) =>
    uploadBufferToCloudinary(file.buffer, { folder: 'products', quality: 'auto' })
  );
  const results = await Promise.all(uploadPromises);
  const urls = results.map((r) => r.secure_url);

  sendSuccess(res, { urls }, 'Images uploaded', 201);
});

export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await Product.distinct('category');
  sendSuccess(res, categories);
});
