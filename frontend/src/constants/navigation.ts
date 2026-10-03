import { Archive, Barcode, Boxes, CircleDollarSign, ContactRound, FileBarChart, LayoutDashboard, Package, ReceiptIndianRupee, RotateCcw, Settings, ShoppingBag, Tags, Truck, Users, WalletCards } from 'lucide-react';

export const navigation = [
  { label: 'Overview', href: '/', icon: LayoutDashboard, permission: 'dashboard:read' },
  { label: 'Generate bill', href: '/pos', icon: ShoppingBag, permission: 'pos:access' },
  { label: 'Sales & invoices', href: '/sales', icon: ReceiptIndianRupee, permission: 'sales:read' },
  { label: 'Returns', href: '/returns', icon: RotateCcw, permission: 'sales:return' },
  { label: 'Customers', href: '/customers', icon: ContactRound, permission: 'customers:read' },
  { label: 'Products', href: '/products', icon: Package, permission: 'products:read' },
  { label: 'Inventory', href: '/inventory', icon: Boxes, permission: 'inventory:read' },
  { label: 'Purchases', href: '/purchases', icon: Truck, permission: 'purchases:read' },
  { label: 'Suppliers', href: '/suppliers', icon: Users, permission: 'suppliers:read' },
  { label: 'Cash drawer', href: '/cash', icon: WalletCards, permission: 'cash:manage' },
  { label: 'Expenses', href: '/expenses', icon: CircleDollarSign, permission: 'expenses:read' },
  { label: 'Reports', href: '/reports', icon: FileBarChart, permission: 'reports:read' },
  { label: 'Barcodes', href: '/barcodes', icon: Barcode, permission: 'products:read' },
  { label: 'Categories & brands', href: '/catalogue', icon: Tags, permission: 'products:manage' },
  { label: 'Users', href: '/users', icon: Users, permission: 'users:read' },
  { label: 'Tax & coupons', href: '/settings', icon: Settings, permission: 'taxes:manage' },
  { label: 'Data & backups', href: '/admin-tools', icon: Archive, permission: 'data:import' },
];
