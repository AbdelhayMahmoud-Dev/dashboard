import { Router } from 'express';
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  getOrderStats,
} from '../controllers/order.controller';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createOrderValidation,
  updateOrderStatusValidation,
  orderQueryValidation,
} from '../validations/order.validation';

const router = Router();

router.use(protect);

router.get('/stats', authorize('admin', 'super_admin', 'manager'), getOrderStats);
router.get('/', orderQueryValidation, validate, getOrders);
router.get('/:id', getOrder);
router.post('/', authorize('admin', 'super_admin', 'manager'), createOrderValidation, validate, createOrder);
router.patch('/:id/status', authorize('admin', 'super_admin', 'manager'), updateOrderStatusValidation, validate, updateOrderStatus);
router.delete('/:id', authorize('admin', 'super_admin'), deleteOrder);

export default router;
