import { Router } from 'express';
import {
  getUsers,
  getUser,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
  getAuditLogs,
} from '../controllers/user.controller';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.use(protect);
router.use(authorize('admin', 'super_admin'));

router.get('/', getUsers);
router.get('/audit-logs', getAuditLogs);
router.get('/:id', getUser);
router.patch('/:id/role', authorize('super_admin'), updateUserRole);
router.patch('/:id/toggle-status', toggleUserStatus);
router.delete('/:id', authorize('super_admin'), deleteUser);

export default router;
