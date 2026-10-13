import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { ChildrenPage } from './pages/ChildrenPage';
import { ChildDetailPage } from './pages/ChildDetailPage';
import { ChildFormPage } from './pages/ChildFormPage';
import { NewApplicationPage } from './pages/NewApplicationPage';
import { ApplicationRunPage } from './pages/ApplicationRunPage';
import { ApplicationResultPage } from './pages/ApplicationResultPage';
import { ProfilePage } from './pages/ProfilePage';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Preparando" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/dashboard"
        element={
          <Protected>
            <DashboardPage />
          </Protected>
        }
      />
      <Route
        path="/children"
        element={
          <Protected>
            <ChildrenPage />
          </Protected>
        }
      />
      <Route
        path="/children/new"
        element={
          <Protected>
            <ChildFormPage />
          </Protected>
        }
      />
      <Route
        path="/children/:id"
        element={
          <Protected>
            <ChildDetailPage />
          </Protected>
        }
      />
      <Route
        path="/applications/new"
        element={
          <Protected>
            <NewApplicationPage />
          </Protected>
        }
      />
      <Route
        path="/applications/:id/run"
        element={
          <Protected>
            <ApplicationRunPage />
          </Protected>
        }
      />
      <Route
        path="/applications/:id/result"
        element={
          <Protected>
            <ApplicationResultPage />
          </Protected>
        }
      />
      <Route
        path="/profile"
        element={
          <Protected>
            <ProfilePage />
          </Protected>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}