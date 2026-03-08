"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Droplets, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab]         = useState<"login"|"register">("login");
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [form, setForm]       = useState({ name:"", email:"", password:"", farmName:"" });

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    if (res?.error) { setError("Invalid email or password"); setLoading(false); }
    else router.push("/dashboard");
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Registration failed"); setLoading(false); return; }
    await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
             style={{ background: "radial-gradient(circle, #4b5563, transparent)" }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10"
             style={{ background: "radial-gradient(circle, #006ba5, transparent)" }} />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4"
               style={{ background: "linear-gradient(135deg,#4b5563,#064b71)", boxShadow: "0 8px 32px rgba(148, 163, 184,0.4)" }}>
            <Droplets className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-pond-100">AquaFarm</h1>
          <p className="text-pond-200/75 text-sm mt-1">Catfish Farm Management</p>
        </div>

        {/* Card */}
        <div className="glass-card p-6">
          {/* Tabs */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: "rgba(12, 12, 14,0.6)" }}>
            {(["login","register"] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 capitalize ${
                  tab === t
                    ? "text-white shadow" : "text-pond-200/75 hover:text-pond-300"
                }`}
                style={tab === t ? { background: "linear-gradient(135deg,#4b5563,#374151)" } : {}}>
                {t}
              </button>
            ))}
          </div>

          <form onSubmit={tab === "login" ? handleLogin : handleRegister} className="space-y-4">
            {tab === "register" && (
              <>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Full Name</label>
                  <input className="field" placeholder="Enter your name" required
                    value={form.name} onChange={e => update("name", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-pond-300 mb-1.5 font-medium">Farm Name</label>
                  <input className="field" placeholder="e.g. Abuja Fresh Fish Farm"
                    value={form.farmName} onChange={e => update("farmName", e.target.value)} />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-pond-300 mb-1.5 font-medium">Email</label>
              <input className="field" type="email" placeholder="you@example.com" required
                value={form.email} onChange={e => update("email", e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-pond-300 mb-1.5 font-medium">Password</label>
              <div className="relative">
                <input className="field pr-10" type={showPw ? "text" : "password"}
                  placeholder="••••••••" required minLength={6}
                  value={form.password} onChange={e => update("password", e.target.value)} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pond-200/65 hover:text-pond-300 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm text-red-300"
                   style={{ background: "rgba(220,53,69,0.15)", border: "1px solid rgba(220,53,69,0.3)" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Please wait…" : tab === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-pond-200/60 mt-6">
          AquaFarm — Professional Catfish Farm Tracker
        </p>
      </div>
    </div>
  );
}
