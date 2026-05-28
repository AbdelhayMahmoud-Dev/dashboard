import { Router } from 'express';
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customer.controller';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createCustomerValidation,
  updateCustomerValidation,
  customerQueryValidation,
} from '../validations/customer.validation';

const router = Router();

router.use(protect);

router.get('/', customerQueryValidation, validate, getCustomers);
router.get('/:id', getCustomer);
router.post('/', authorize('admin', 'super_admin', 'manager'), createCustomerValidation, validate, createCustomer);
router.patch('/:id', authorize('admin', 'super_admin', 'manager'), updateCustomerValidation, validate, updateCustomer);
router.delete('/:id', authorize('admin', 'super_admin'), deleteCustomer);

export default router;
