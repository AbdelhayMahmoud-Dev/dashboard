export type UserRole = 'super_admin' | 'admin' | 'manager' | 'viewer';
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type ProductStatus = 'active' | 'inactive' | 'draft';
export type CustomerStatus = 'active' | 'inactive' | 'banned';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  lastLogin?: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  category: string;
  subcategory?: string;
  sku: string;
  stock: number;
  images: string[];
  thumbnail: string;
  tags: string[];
  status: ProductStatus;
  isFeatured: boolean;
  totalSales: number;
  rating: number;
  reviewCount: number;
  createdBy: { name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  product: string;
  name: string;
  thumbnail: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customer: Customer | string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  shippingAddress: {
    fullName: string;
    address: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    phone: string;
  };
  notes?: string;
  statusHistory: Array<{ status: OrderStatus; timestamp: string; note?: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  totalOrders: number;
  totalSpent: number;
  status: CustomerStatus;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  _id: string;
  user: Pick<User, '_id' | 'name' | 'email' | 'avatar'>;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface DashboardOverview {
  totalRevenue: number;
  monthRevenue: number;
  revenueGrowth: number;
  totalOrders: number;
  monthOrders: number;
  totalCustomers: number;
  monthCustomers: number;
  totalProducts: number;
}

export interface DashboardStats {
  overview: DashboardOverview;
  recentOrders: Order[];
  topProducts: Pick<Product, '_id' | 'name' | 'totalSales' | 'price' | 'thumbnail'>[];
  revenueByDay: Array<{ _id: string; revenue: number; orders: number }>;
  ordersByStatus: Array<{ _id: string; count: number }>;
  /** 7-day sparkline data for KPI stat cards */
  sparklines?: {
    revenue: number[];
    orders: number[];
    customers: number[];
  };
}
