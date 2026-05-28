import { Router } from 'express';
import { getDashboardStats, getRevenueChart } from '../controllers/analytics.controller';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.use(protect);
// All authenticated roles can read analytics (viewer = read-only access to dashboard data).
// Write-restricted endpoints (if added in future) can use per-route authorize().

router.get('/dashboard', getDashboardStats);
router.get('/revenue', getRevenueChart);

export default router;
