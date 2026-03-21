import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const Signup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(false);

  const validateAndGetPromo = async (code: string) => {
    if (!code.trim()) return null;
    const { data, error } = await supabase
      .from("promo_codes")
      .select("id, code, discount_percent")
      .eq("code", code.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate promo code if entered
    let promoData = null;
    if (promoCode.trim()) {
      promoData = await validateAndGetPromo(promoCode);
      if (!promoData) {
        toast.error("Invalid or expired promo code.");
        setLoading(false);
        return;
      }
    }

    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    // Save promo code to profile and track referral
    if (promoData && authData.user) {
      await supabase
        .from("profiles")
        .update({ used_promo_code: promoData.code } as any)
        .eq("id", authData.user.id);

      await supabase
        .from("referral_signups")
        .insert({ promo_code_id: promoData.id, user_id: authData.user.id } as any);
    }

    const discountMsg = promoData
      ? ` You get ${promoData.discount_percent}% discount!`
      : "";
    toast.success(`Account created!${discountMsg} Purchase credits to start practicing.`);
    navigate("/dashboard");
  };

  const handleGoogleSignup = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="neo-card w-full max-w-md bg-card p-8">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block"><Logo size="large" /></Link>
          <p className="mt-2 text-sm text-muted-foreground">Create your account to start practicing.</p>
        </div>

        <button onClick={handleGoogleSignup} className="neo-btn mb-6 flex w-full items-center justify-center gap-3 bg-background text-foreground">
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-ink" /></div>
          <div className="relative flex justify-center"><span className="bg-card px-3 font-heading text-xs uppercase text-muted-foreground">or</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" type="text" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 border-2 border-ink" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 border-2 border-ink" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1 border-2 border-ink" />
          </div>
          <div>
            <Label htmlFor="promo">Promo Code <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="promo"
              type="text"
              placeholder="e.g. TESTPROMO"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              className="mt-1 border-2 border-ink uppercase tracking-wider"
            />
          </div>
          <button type="submit" disabled={loading} className="neo-btn w-full bg-primary text-primary-foreground disabled:opacity-50">
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/login" className="font-semibold text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
