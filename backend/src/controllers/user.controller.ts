import { Request, Response } from 'express';
import User from '../models/User';
import AuditLog from '../models/AuditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/ApiResponse';
import { escapeRegex } from '../utils/sanitize';

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '10', search = '', role = '' } = req.query as Record<string, string>;

  const query: Record<string, unknown> = {};
  if (search) {
    const safe = escapeRegex(search);
    query.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
    ];
  }
  if (role) query.role = role;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [users, total] = await Promise.all([
    User.find(query).sort('-createdAt').skip(skip).limit(limitNum).lean(),
    User.countDocuments(query),
  ]);

  sendSuccess(res, users, 'Users retrieved', 200, {
    page: pageNum,
    limit: limitNum,
    total,
    pages: Math.ceil(total / limitNum),
  });
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  sendSuccess(res, user);
});

export const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { role, permissions } = req.body;

  if (req.params.id === req.user!.id) {
    throw new ApiError(400, 'Cannot change your own role');
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role, ...(permissions && { permissions }) },
    { new: true, runValidators: true }
  );
  if (!user) throw new ApiError(404, 'User not found');

  sendSuccess(res, user, 'User role updated');
});

export const toggleUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (user._id.toString() === req.user!.id) throw new ApiError(400, 'Cannot deactivate yourself');

  user.isActive = !user.isActive;
  await user.save();

  sendSuccess(res, user, `User ${user.isActive ? 'activated' : 'deactivated'}`);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id === req.user!.id) throw new ApiError(400, 'Cannot delete yourself');
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  sendSuccess(res, null, 'User deleted');
});

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [logs, total] = await Promise.all([
    AuditLog.find()
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum)
      .populate('user', 'name email avatar')
      .lean(),
    AuditLog.countDocuments(),
  ]);

  sendSuccess(res, logs, 'Audit logs retrieved', 200, {
    page: pageNum,
    limit: limitNum,
    total,
    pages: Math.ceil(total / limitNum),
  });
});
