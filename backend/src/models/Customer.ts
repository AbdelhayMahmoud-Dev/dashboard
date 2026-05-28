import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  _id: mongoose.Types.ObjectId;
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
  status: 'active' | 'inactive' | 'banned';
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active',
    },
    tags: {
      type: [String],
      default: [],
    },
    notes: String,
  },
  { timestamps: true }
);

customerSchema.index({ name: 'text', email: 'text', phone: 'text' }); // full-text search
customerSchema.index({ status: 1, createdAt: -1 });           // status filter + sort
customerSchema.index({ totalSpent: -1 });                     // top spenders
customerSchema.index({ totalOrders: -1 });                    // most active
customerSchema.index({ createdAt: -1 });                      // latest customers

export default mongoose.model<ICustomer>('Customer', customerSchema);
