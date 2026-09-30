import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Droplets, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";
import { toast } from "sonner";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "Owner Dashboard — Rai's Auto Spa" },
      { name: "description", content: "Rai's private dashboard: routes, bookings, subscriptions, leads and wrap approvals." },
      { property: "og:title", content: "Owner Dashboard — Rai's Auto Spa" },
      { property: "og:description", content: "Private owner tools for Rai's Auto Spa, Gangtok." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerPage,
});

function OwnerPage() {
  const [state, setState] = useState<"loading" | "signed_out" | "denied" | "ok">("loading");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setState("signed_out");
      setEmail(data.user.email ?? "");
      const { data: ok } = await supabase.rpc("claim_owner");
      setState(ok ? "ok" : "denied");
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT") setTimeout(check, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/owner" });
    if (r.error) toast.error("Sign-in failed. Please try again.");
  }

  if (state === "ok")
    return (
      <div className="min-h-screen bg-muted/40">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2 font-display font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"><Droplets className="h-4 w-4" /></span>
              Rai's Auto Spa · Owner
            </Link>
            <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut()}><LogOut /> <span className="hidden sm:inline">{email}</span></Button>
          </div>
        </header>
        <OwnerDashboard />
      </div>
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Droplets /></span>
        <h1 className="mt-4 text-2xl font-bold">Owner Dashboard</h1>
        {state === "loading" && <Loader2 className="mx-auto mt-6 animate-spin text-muted-foreground" />}
        {state === "signed_out" && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">Only Rai can see this. The first account to sign in becomes the owner.</p>
            <Button className="mt-6 w-full" size="lg" onClick={signIn}>Continue with Google</Button>
          </>
        )}
        {state === "denied" && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{email} isn't the owner account.</p>
            <Button className="mt-6 w-full" variant="outline" onClick={() => supabase.auth.signOut()}>Sign out</Button>
          </>
        )}
        <Link to="/" className="mt-4 block text-sm text-muted-foreground hover:underline">← Back to site</Link>
      </div>
    </div>
  );
}
