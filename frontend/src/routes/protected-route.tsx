import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { LoadingScreen } from '../components/loading-screen';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.isLoading) return <LoadingScreen />;
  if (auth.isError || !auth.data) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (auth.data.mustChangePassword && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  return <Outlet />;
}

export function PermissionRoute({ permission }: { permission: string }) {
  const { data: user } = useAuth();
  return user?.permissions.includes(permission) ? <Outlet /> : <Navigate to="/forbidden" replace />;
}
