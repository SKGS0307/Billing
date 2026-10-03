export interface AuthUser {
  id: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
}

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count?: { products: number };
}

export interface Brand {
  id: string;
  name: string;
  isActive: boolean;
  _count?: { products: number };
}

export interface ProductVariant {
  id: string;
  sku: string;
  barcode: string | null;
  size: string | null;
  color: string | null;
  design: string | null;
  fabric: string | null;
  pattern: string | null;
  purchaseCost: string;
  mrp: string;
  retailPrice: string;
  wholesalePrice: string;
  stockQuantity: number;
  minStockLevel: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Product {
  id: string;
  productCode: string;
  name: string;
  description: string | null;
  hsnCode: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  category: Pick<Category, 'id' | 'name'>;
  brand: Pick<Brand, 'id' | 'name'> | null;
  taxRate: { id: string; name: string; rate: string } | null;
  variants: ProductVariant[];
  totalStock?: number;
  lowStockVariants?: number;
}

export interface Customer { id: string; customerCode: string; name: string; mobile: string | null; email: string | null; address: string | null; city: string | null; state: string | null; gstin: string | null; type: 'RETAIL' | 'WHOLESALE' | 'VIP'; isActive: boolean; ledgerEntries?: LedgerEntry[] }
export interface Supplier { id: string; supplierCode: string; name: string; company: string | null; mobile: string | null; email: string | null; gstin: string | null; isActive: boolean; ledgerEntries?: LedgerEntry[] }
export interface LedgerEntry { id: string; type: string; amount: string; referenceType: string; notes: string | null; createdAt: string }
export interface Payment { id: string; method: string; kind: string; amount: string; tenderedAmount: string | null; changeAmount: string | null; reference: string | null; createdAt: string }
export interface SaleItem { id: string; variantId: string; productNameSnapshot: string; skuSnapshot: string; variantSnapshot: string; quantity: number; returnedQuantity: number; sellingPrice: string; discountAmount: string; taxRateSnapshot: string; taxableAmount: string; cgst: string; sgst: string; igst: string; finalAmount: string }
export interface Sale { id: string; invoiceNumber: string; status: string; taxMode: string; subtotal: string; itemDiscount: string; billDiscount: string; taxableAmount: string; cgst: string; sgst: string; igst: string; roundOff: string; grandTotal: string; amountPaid: string; balanceDue: string; notes: string | null; createdAt: string; customer: Customer | null; items: SaleItem[]; payments: Payment[]; createdBy?: { id: string; name: string } }
export interface CashSession { id: string; status: string; openingCash: string; expectedCash: string | null; actualCash: string | null; difference: string | null; openedAt: string; closedAt: string | null; notes: string | null }

export interface InventoryVariant extends ProductVariant {
  product: Omit<Product, 'variants'>;
}

export interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  notes: string | null;
  createdAt: string;
  variant: { id: string; sku: string; size: string | null; color: string | null; product: { id: string; name: string; productCode: string } };
  stockAdjustment: { reason: string; notes: string | null; createdBy: { id: string; name: string } } | null;
}

export interface ApiSuccess<T> { success: true; data: T; meta?: Record<string, number> }
export interface ApiFailure { success: false; error: { code: string; message: string; details?: unknown } }
