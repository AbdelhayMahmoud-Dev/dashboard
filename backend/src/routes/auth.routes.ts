import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  registerValidation,
  loginValidation,
  changePasswordValidation,
} from '../validations/auth.validation';

const router = Router();

router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

router.use(protect);
router.get('/me', getMe);
router.patch('/me', updateProfile);
router.patch('/change-password', changePasswordValidation, validate, changePassword);
router.delete('/me', deleteAccount);

export default router;
