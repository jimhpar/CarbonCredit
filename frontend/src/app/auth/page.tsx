"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, Phone, Sprout, UserPlus } from "lucide-react";
import Navbar from "@/components/Navbar";
import type { UserRole } from "@/types/agrotwin";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("farmer");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [bkash, setBkash] = useState("");
  const [district, setDistrict] = useState("Bogura");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "signin" ? "/api/auth/signin" : "/api/auth/signup";
      const body =
        mode === "signin"
          ? { phone, password }
          : {
              full_name: fullName,
              role,
              phone,
              password,
              bkash_number: bkash || phone,
              district,
            };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }
      localStorage.setItem("cc_user", JSON.stringify(data.user));
      if (data.user.role === "farmer") router.push("/farmer");
      else if (data.user.role === "admin") router.push("/admin");
      else router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  const quickDemoLogin = async (demoPhone: string) => {
    setPhone(demoPhone);
    setPassword("demo123");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: demoPhone, password: "demo123" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Demo login failed");
      localStorage.setItem("cc_user", JSON.stringify(data.user));
      router.push(data.user.role === "farmer" ? "/farmer" : "/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {mode === "signin" ? "Sign In to CarbonCredit" : "Create Account"}
              </h2>
              <p className="text-xs text-slate-500">
                Farmer, Field Agent, B2B Partner & Admin Access
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-md py-2 transition ${
                mode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-md py-2 transition ${
                mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            {mode === "signup" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Abdul Karim"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    >
                      <option value="farmer">Farmer</option>
                      <option value="field_agent">Field Agent</option>
                      <option value="b2b_partner">B2B / MFI</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">District</label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01812000003"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2"
                />
              </div>
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  bKash / Nagad Number (Optional)
                </label>
                <input
                  type="text"
                  value={bkash}
                  onChange={(e) => setBkash(e.target.value)}
                  placeholder="Same as phone if empty"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 transition disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="border-t border-slate-200 pt-4 space-y-2">
            <div className="text-xs font-medium text-slate-500 text-center">
              Quick Demo Sign-In (Password: demo123)
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => quickDemoLogin("01812000003")}
                className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 py-2 font-semibold text-slate-700"
              >
                Demo Farmer
              </button>
              <button
                type="button"
                onClick={() => quickDemoLogin("01700000001")}
                className="rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 py-2 font-semibold text-emerald-800"
              >
                Demo Admin
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
