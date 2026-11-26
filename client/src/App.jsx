import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { FoodListingsPage } from './pages/FoodListingsPage.jsx';
import { FoodDetailsPage } from './pages/FoodDetailsPage.jsx';
import { FoodRequestPage } from './pages/FoodRequestPage.jsx';
import { ProviderDashboardPage } from './pages/ProviderDashboardPage.jsx';
import { SeekerDashboardPage } from './pages/SeekerDashboardPage.jsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.jsx';
import { RequestManagementPage } from './pages/RequestManagementPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { NotificationsPage } from './pages/NotificationsPage.jsx';

function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="card">Verifying session...</div>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const fallback =
      user.role === 'provider'
        ? '/provider/dashboard'
        : user.role === 'seeker'
          ? '/seeker/dashboard'
          : '/admin/dashboard';
    return <Navigate to={fallback} replace />;
  }
  return children;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/foods" element={<FoodListingsPage />} />
            <Route path="/foods/:id" element={<FoodDetailsPage />} />

            <Route
              path="/foods/:id/request"
              element={
                <ProtectedRoute roles={['seeker']}>
                  <FoodRequestPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/provider/dashboard"
              element={
                <ProtectedRoute roles={['provider', 'admin']}>
                  <ProviderDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seeker/dashboard"
              element={
                <ProtectedRoute roles={['seeker', 'admin']}>
                  <SeekerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests"
              element={
                <ProtectedRoute>
                  <RequestManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="footer">
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span>Food Rescue Management System (FRMS) — Three-Tier Web Application</span>
            <span>Connecting Food Providers &amp; Food Seekers to Reduce Food Waste</span>
          </div>
        </footer>
      </BrowserRouter>
    </AuthProvider>
  );
}
export default App;
