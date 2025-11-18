import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { Documents } from './pages/Documents';
import { CreateDocument } from './pages/CreateDocument';
import { Users } from './pages/Users';
import { FileManager } from './pages/FileManager';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Protected routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="documents" element={<Documents />} />
                <Route path="documents/new" element={<CreateDocument />} />
                <Route path="users" element={<Users />} />
                <Route path="files" element={<FileManager />} />
                <Route path="notifications" element={<div className="p-4">Notifications Page (Coming Soon)</div>} />
                <Route path="settings" element={<div className="p-4">Settings Page (Coming Soon)</div>} />
                <Route path="profile" element={<div className="p-4">Profile Page (Coming Soon)</div>} />
              </Route>
              
              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            
            {/* Toast notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                className: 'text-sm',
                success: {
                  style: {
                    background: '#10B981',
                    color: 'white',
                  },
                },
                error: {
                  style: {
                    background: '#EF4444',
                    color: 'white',
                  },
                },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
