import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/ApiResponse';
import { generateAccessToken, generateRefreshToken } from '../utils/generateTokens';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, 'Email already in use');

  const user = await User.create({ name, email, password, role: 'viewer' });

  const accessToken = generateAccessToken(user._id.toString(), user.role);
  const refreshToken = generateRefreshToken(user._id.toString());

  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

  sendSuccess(
    res,
    { user: user.toJSON(), accessToken },
    'Registration successful',
    201
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +refreshToken');
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid credentials');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, 'Invalid credentials');

  const accessToken = generateAccessToken(user._id.toString(), user.role);
  const refreshToken = generateRefreshToken(user._id.toString());

  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

  const userData = user.toJSON();
  sendSuccess(res, { user: userData, accessToken }, 'Login successful');
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  if (!token) throw new ApiError(401, 'Refresh token not provided');

  let decoded: { id: string };
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { id: string };
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== token) {
    throw new ApiError(401, 'Refresh token reuse detected');
  }

  const accessToken = generateAccessToken(user._id.toString(), user.role);
  const newRefreshToken = generateRefreshToken(user._id.toString());

  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });

  res.cookie('refreshToken', newRefreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
  sendSuccess(res, { accessToken }, 'Token refreshed');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { id: string };
      await User.findByIdAndUpdate(decoded.id, { $unset: { refreshToken: 1 } });
    } catch {
      // Token already invalid, proceed with logout
    }
  }

  res.clearCookie('refreshToken', COOKIE_OPTIONS);
  sendSuccess(res, null, 'Logged out successfully');
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new ApiError(404, 'User not found');
  sendSuccess(res, { user });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { name, avatar } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { name, avatar },
    { new: true, runValidators: true }
  );
  sendSuccess(res, { user }, 'Profile updated');
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user!.id).select('+password');
  if (!user) throw new ApiError(404, 'User not found');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new ApiError(400, 'Current password is incorrect');

  user.password = newPassword;
  await user.save();

  sendSuccess(res, null, 'Password changed successfully');
});

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  // Prevent deleting the last active super_admin to avoid lockout
  if (user.role === 'super_admin') {
    const activeSuperAdmins = await User.countDocuments({ role: 'super_admin', isActive: true });
    if (activeSuperAdmins <= 1) {
      throw new ApiError(400, 'Cannot delete the last super admin account');
    }
  }

  await User.findByIdAndDelete(userId);
  res.clearCookie('refreshToken', COOKIE_OPTIONS);
  sendSuccess(res, null, 'Account deleted successfully');
});
