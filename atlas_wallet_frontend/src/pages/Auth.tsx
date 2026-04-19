import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Wallet, Zap } from "lucide-react";

export default function Auth() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/app" replace />;

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    nav("/app");
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome to Atlas! Your wallet is ready.");
    nav("/app");
  };

  return (
    <div className="min-h-screen gradient-soft grid lg:grid-cols-2">
      {/* Hero */}
      <div className="hidden lg:flex flex-col justify-between p-12 gradient-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur grid place-items-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display font-bold text-xl">Atlas</span>
        </div>
        <div className="space-y-6">
          <h1 className="font-display text-5xl font-bold leading-tight">
            Your AI commerce<br />operating system.
          </h1>
          <p className="text-lg text-white/90 max-w-md">
            Describe what you need. Get 3 perfect options. Pay your way — instant, split, or financed. All in one place.
          </p>
          <div className="grid gap-3 max-w-md">
            {[
              { icon: Sparkles, t: "AI picks the best 3", d: "No more comparing tabs" },
              { icon: Wallet, t: "Smart payment routing", d: "Instant · BNPL · Credit" },
              { icon: Zap, t: "One-tap checkout", d: "Live delivery tracking" },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3 rounded-2xl bg-white/10 backdrop-blur p-4">
                <f.icon className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">{f.t}</div>
                  <div className="text-sm text-white/80">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-white/70">Demo wallet seeded with 5 000 MAD on signup.</p>
      </div>

      {/* Auth form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-10 w-10 rounded-xl gradient-primary grid place-items-center text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display font-bold text-xl">Atlas</div>
              <div className="text-xs text-muted-foreground">AI Smart Wallet</div>
            </div>
          </div>

          <h2 className="font-display text-3xl font-bold mb-2">Get started</h2>
          <p className="text-muted-foreground mb-8">Sign in or create your wallet — takes 5 seconds.</p>

          <Tabs defaultValue="signup">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="signup">Create account</TabsTrigger>
              <TabsTrigger value="signin">Sign in</TabsTrigger>
            </TabsList>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amine" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-su">Email</Label>
                  <Input id="email-su" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw-su">Password</Label>
                  <Input id="pw-su" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
                </div>
                <Button type="submit" disabled={busy} className="w-full h-11 gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
                  {busy ? "Creating…" : "Create wallet"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-in">Email</Label>
                  <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw-in">Password</Label>
                  <Input id="pw-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full h-11">
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
