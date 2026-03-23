import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import NewInterview from "./pages/interview/NewInterview";
import LiveInterview from "./pages/interview/LiveInterview";
import Report from "./pages/Report";
import Roadmap from "./pages/Roadmap";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Clears all cached queries on auth transitions — prevents data leaking between sessions
const AuthQuerySync = () => {
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        queryClient.clear();
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AuthQuerySync />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />
            <Route
              path="/onboarding"
              element={
                <ErrorBoundary>
                  <ProtectedRoute children={<Onboarding />} />
                </ErrorBoundary>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ErrorBoundary>
                  <ProtectedRoute children={<Dashboard />} />
                </ErrorBoundary>
              }
            />
            <Route
              path="/roadmap"
              element={
                <ErrorBoundary>
                  <ProtectedRoute children={<Roadmap />} />
                </ErrorBoundary>
              }
            />
            <Route
              path="/interview/new"
              element={
                <ErrorBoundary>
                  <ProtectedRoute children={<NewInterview />} />
                </ErrorBoundary>
              }
            />
            <Route
              path="/interview/:id"
              element={
                <ErrorBoundary>
                  <ProtectedRoute children={<LiveInterview />} />
                </ErrorBoundary>
              }
            />
            <Route
              path="/report/:id"
              element={
                <ErrorBoundary>
                  <ProtectedRoute children={<Report />} />
                </ErrorBoundary>
              }
            />
            <Route
              path="/pricing"
              element={
                <ErrorBoundary>
                  <ProtectedRoute children={<Pricing />} />
                </ErrorBoundary>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
