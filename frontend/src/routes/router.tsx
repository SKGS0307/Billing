import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { LoadingScreen } from '../components/loading-screen';
import { DashboardPage } from '../pages/dashboard-page';
import { ChangePasswordPage } from '../pages/change-password-page';
import { LoginPage } from '../pages/login-page';
import { ForbiddenPage, NotFoundPage } from '../pages/status-pages';
import { UsersPage } from '../pages/users-page';
import { PermissionRoute, ProtectedRoute } from './protected-route';

const ProductsPage = lazy(() => import('../pages/products-page').then((module) => ({ default: module.ProductsPage })));
const NewProductPage = lazy(() => import('../pages/new-product-page').then((module) => ({ default: module.NewProductPage })));
const ProductDetailPage = lazy(() => import('../pages/product-detail-page').then((module) => ({ default: module.ProductDetailPage })));
const InventoryPage = lazy(() => import('../pages/inventory-page').then((module) => ({ default: module.InventoryPage })));
const CataloguePage = lazy(() => import('../pages/catalogue-page').then((module) => ({ default: module.CataloguePage })));
const PosPage = lazy(() => import('../pages/pos-page').then((module) => ({ default: module.PosPage })));
const SalesPage = lazy(() => import('../pages/sales-pages').then((module) => ({ default: module.SalesPage })));
const InvoicePage = lazy(() => import('../pages/sales-pages').then((module) => ({ default: module.InvoicePage })));
const CustomersPage = lazy(() => import('../pages/parties-pages').then((module) => ({ default: module.CustomersPage })));
const SuppliersPage = lazy(() => import('../pages/parties-pages').then((module) => ({ default: module.SuppliersPage })));
const CashPage = lazy(() => import('../pages/operations-pages').then((module) => ({ default: module.CashPage })));
const ExpensesPage = lazy(() => import('../pages/operations-pages').then((module) => ({ default: module.ExpensesPage })));
const PurchasesPage = lazy(() => import('../pages/operations-pages').then((module) => ({ default: module.PurchasesPage })));
const SaleReturnsPage = lazy(() => import('../pages/operations-pages').then((module) => ({ default: module.SaleReturnsPage })));
const PurchaseReturnsPage = lazy(() => import('../pages/operations-pages').then((module) => ({ default: module.PurchaseReturnsPage })));
const ReportsPage = lazy(() => import('../pages/reports-admin-pages').then((module) => ({ default: module.ReportsPage })));
const AdminToolsPage = lazy(() => import('../pages/reports-admin-pages').then((module) => ({ default: module.AdminToolsPage })));
const SettingsPage = lazy(() => import('../pages/reports-admin-pages').then((module) => ({ default: module.SettingsPage })));
const BarcodesPage = lazy(() => import('../pages/reports-admin-pages').then((module) => ({ default: module.BarcodesPage })));
const deferred = (page: ReactNode) => <Suspense fallback={<LoadingScreen />}>{page}</Suspense>;

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [{ element: <AppShell />, children: [
      { index: true, element: <DashboardPage /> },
      { path: 'change-password', element: <ChangePasswordPage /> },
      { path: 'forbidden', element: <ForbiddenPage /> },
      { element: <PermissionRoute permission="pos:access" />, children: [{ path: 'pos', element: deferred(<PosPage />) }] },
      { element: <PermissionRoute permission="sales:read" />, children: [{ path: 'sales', element: deferred(<SalesPage />) }, { path: 'sales/:id/invoice', element: deferred(<InvoicePage />) }] },
      { element: <PermissionRoute permission="sales:return" />, children: [{ path: 'returns', element: deferred(<SaleReturnsPage />) }] },
      { element: <PermissionRoute permission="customers:read" />, children: [{ path: 'customers', element: deferred(<CustomersPage />) }] },
      { element: <PermissionRoute permission="suppliers:read" />, children: [{ path: 'suppliers', element: deferred(<SuppliersPage />) }] },
      { element: <PermissionRoute permission="purchases:read" />, children: [{ path: 'purchases', element: deferred(<PurchasesPage />) }] },
      { element: <PermissionRoute permission="purchases:return" />, children: [{ path: 'purchase-returns', element: deferred(<PurchaseReturnsPage />) }] },
      { element: <PermissionRoute permission="cash:manage" />, children: [{ path: 'cash', element: deferred(<CashPage />) }] },
      { element: <PermissionRoute permission="expenses:read" />, children: [{ path: 'expenses', element: deferred(<ExpensesPage />) }] },
      { element: <PermissionRoute permission="reports:read" />, children: [{ path: 'reports', element: deferred(<ReportsPage />) }] },
      { element: <PermissionRoute permission="data:import" />, children: [{ path: 'admin-tools', element: deferred(<AdminToolsPage />) }] },
      { element: <PermissionRoute permission="taxes:manage" />, children: [{ path: 'settings', element: deferred(<SettingsPage />) }] },
      { element: <PermissionRoute permission="products:read" />, children: [{ path: 'barcodes', element: deferred(<BarcodesPage />) }] },
      { element: <PermissionRoute permission="products:read" />, children: [{ path: 'products', element: deferred(<ProductsPage />) }] },
      { element: <PermissionRoute permission="products:manage" />, children: [
        { path: 'products/new', element: deferred(<NewProductPage />) },
        { path: 'products/:id', element: deferred(<ProductDetailPage />) },
        { path: 'catalogue', element: deferred(<CataloguePage />) },
      ] },
      { element: <PermissionRoute permission="inventory:read" />, children: [{ path: 'inventory', element: deferred(<InventoryPage />) }] },
      { element: <PermissionRoute permission="users:read" />, children: [{ path: 'users', element: <UsersPage /> }] },
    ] }],
  },
  { path: '*', element: <NotFoundPage /> },
]);
