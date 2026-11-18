"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, LogIn, LogOut, Radio, Shield, Sprout, User } from "lucide-react";
import type { UserProfile } from "@/types/agrotwin";

interface NavbarProps {
  supabaseConnected?: boolean;
  satProvider?: string;
}

export default function Navbar({
  supabaseConnected = false,
  satProvider = "Google Earth Engine",
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cc_user");
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [pathname]);

  const handleSignOut = () => {
    localStorage.removeItem("cc_user");
    setCurrentUser(null);
    router.push("/auth");
  };

  const navItems = [
    { href: "/", label: "Command Center", icon: LayoutDashboard },
    { href: "/farmer", label: "Farmer Portal", icon: User },
    { href: "/admin", label: "Admin & Ledger", icon: Shield },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Sprout className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              CarbonCredit — Hybrid AgriTech & dMRV
            </h1>
            <p className="text-xs text-slate-500">
              1 Core Engine (Satellite + IoT) → 4 Revenue Modules
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1.5">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${
              supabaseConnected
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}
          >
            PostGIS: {supabaseConnected ? "Supabase Live" : "Local"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-1 font-medium text-sky-700">
            <Radio className="h-3.5 w-3.5" />
            {satProvider.split("(")[0].trim()}
          </span>

          {currentUser ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
              <span className="font-semibold text-slate-800">{currentUser.full_name.split(" ")[0]}</span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                {currentUser.role}
              </span>
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="text-slate-500 hover:text-rose-600"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-2.5 py-1 font-semibold text-slate-700"
            >
              <LogIn className="h-3.5 w-3.5 text-emerald-600" />
              Sign In / Up
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
