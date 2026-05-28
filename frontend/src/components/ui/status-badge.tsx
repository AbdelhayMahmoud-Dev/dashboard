import { cn } from '@/lib/utils';
import {
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  PRODUCT_STATUS_CONFIG,
  CUSTOMER_STATUS_CONFIG,
  ROLE_CONFIG,
} from '@/constants';
import { OrderStatus, PaymentStatus, ProductStatus, CustomerStatus, UserRole } from '@/types';

interface OrderBadgeProps { status: OrderStatus }
interface PaymentBadgeProps { status: PaymentStatus }
interface ProductBadgeProps { status: ProductStatus }
interface CustomerBadgeProps { status: CustomerStatus }
interface RoleBadgeProps { role: UserRole }

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', color)}>
    {label}
  </span>
);

export const OrderStatusBadge = ({ status }: OrderBadgeProps) => {
  const config = ORDER_STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border', config.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
};

export const PaymentStatusBadge = ({ status }: PaymentBadgeProps) => {
  const config = PAYMENT_STATUS_CONFIG[status];
  return <Badge label={config.label} color={config.color} />;
};

export const ProductStatusBadge = ({ status }: ProductBadgeProps) => {
  const config = PRODUCT_STATUS_CONFIG[status];
  return <Badge label={config.label} color={config.color} />;
};

export const CustomerStatusBadge = ({ status }: CustomerBadgeProps) => {
  const config = CUSTOMER_STATUS_CONFIG[status];
  return <Badge label={config.label} color={config.color} />;
};

export const RoleBadge = ({ role }: RoleBadgeProps) => {
  const config = ROLE_CONFIG[role];
  return <Badge label={config.label} color={config.color} />;
};
