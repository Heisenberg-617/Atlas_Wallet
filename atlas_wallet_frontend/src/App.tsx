import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AppLayout from "./components/AppLayout";
import Chat from "./pages/Chat";
import WalletPage from "./pages/WalletPage";
import Orders from "./pages/Orders";
import Cart from "./pages/Cart";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ConfigErrorScreen() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-2xl w-full rounded-2xl border bg-card p-6 space-y-4">
        <h1 className="font-display text-2xl font-bold">Deployment configuration missing</h1>
        <p className="text-sm text-muted-foreground">
          This frontend needs Supabase environment variables at build time.
        </p>
        <div className="rounded-xl bg-secondary p-4 text-sm space-y-1">
          <div>Required:</div>
          <div>VITE_SUPABASE_URL</div>
          <div>VITE_SUPABASE_PUBLISHABLE_KEY</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Add the variables in Railway, then trigger a new deploy so Vite rebuilds with them.
        </p>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {isSupabaseConfigured ? (
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Chat />} />
                <Route path="cart" element={<Cart />} />
                <Route path="wallet" element={<WalletPage />} />
                <Route path="orders" element={<Orders />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      ) : (
        <ConfigErrorScreen />
      )}
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
