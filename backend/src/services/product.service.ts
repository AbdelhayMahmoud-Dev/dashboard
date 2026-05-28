import Product from '../models/Product';
import { ApiError } from '../utils/ApiError';
import cloudinary from '../config/cloudinary';
import { logger } from '../utils/logger';

export interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
}

export class ProductService {
  async list(filters: ProductFilters) {
    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      status = '',
      sort = '-createdAt',
      minPrice,
      maxPrice,
    } = filters;

    const query: Record<string, unknown> = {};
    if (search) query.$text = { $search: search };
    if (category) query.category = category;
    if (status) query.status = status;
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) (query.price as Record<string, number>).$gte = minPrice;
      if (maxPrice !== undefined) (query.price as Record<string, number>).$lte = maxPrice;
    }

    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Product.find(query).sort(sort).skip(skip).limit(limitNum).populate('createdBy', 'name email'),
      Product.countDocuments(query),
    ]);

    return { items, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) };
  }

  async findById(id: string) {
    const product = await Product.findById(id).populate('createdBy', 'name email');
    if (!product) throw ApiError.fromCode('RESOURCE_NOT_FOUND', 'Product not found');
    return product;
  }

  async create(data: Record<string, unknown>, createdBy: string) {
    return Product.create({ ...data, createdBy });
  }

  async update(id: string, data: Record<string, unknown>) {
    const product = await Product.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!product) throw ApiError.fromCode('RESOURCE_NOT_FOUND', 'Product not found');
    return product;
  }

  async remove(id: string) {
    const product = await Product.findById(id);
    if (!product) throw ApiError.fromCode('RESOURCE_NOT_FOUND', 'Product not found');

    // Delete Cloudinary images in parallel
    await Promise.allSettled(
      product.images.map(async (url) => {
        try {
          const publicId = url.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (e) {
          logger.warn('Failed to delete Cloudinary image', { url, error: (e as Error).message });
        }
      })
    );

    await product.deleteOne();
  }

  async uploadImages(files: Express.Multer.File[]) {
    if (!files.length) throw ApiError.fromCode('UPLOAD_NO_FILES');

    const results = await Promise.allSettled(
      files.map((f) =>
        cloudinary.uploader.upload(f.path, {
          folder: 'products',
          quality: 'auto:good',
          fetch_format: 'auto',
          width: 1200,
          height: 1200,
          crop: 'limit',
        })
      )
    );

    const urls: string[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') urls.push(r.value.secure_url);
      else logger.warn('Cloudinary upload failed', { reason: r.reason });
    }
    if (!urls.length) throw ApiError.fromCode('UPLOAD_CLOUDINARY_FAILED', 'All image uploads failed');
    return urls;
  }

  async getCategories() {
    return Product.distinct('category');
  }
}

export const productService = new ProductService();
