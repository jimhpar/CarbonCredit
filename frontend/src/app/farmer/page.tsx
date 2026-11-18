"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Droplets,
  Landmark,
  Leaf,
  ShieldCheck,
  Volume2,
  Wallet,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import type {
  FinanceCompany,
  LoanApplication,
  NotificationItem,
  PayoutItem,
  PilotFarm,
} from "@/types/agrotwin";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function FarmerPortalPage() {
  const [farms, setFarms] = useState<PilotFarm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<PilotFarm | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [companies, setCompanies] = useState<FinanceCompany[]>([]);
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [satProvider, setSatProvider] = useState("Google Earth Engine");
  const [speaking, setSpeaking] = useState(false);

  // Loan Application Form
  const [farmerName, setFarmerName] = useState("Abdul Karim (Farmer)");
  const [farmerPhone, setFarmerPhone] = useState("01812000003");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [loanAmount, setLoanAmount] = useState(25000);
  const [loanPurpose, setLoanPurpose] = useState("AWD Irrigation & Fertilizer");
  const [loanMsg, setLoanMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cc_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.full_name) setFarmerName(u.full_name);
        if (u.phone) setFarmerPhone(u.phone);
      }
    } catch {
      // ignore
    }

    const load = async () => {
      try {
        const [fRes, cRes] = await Promise.all([
          fetch(`${API_BASE}/api/farms`),
          fetch(`${API_BASE}/api/finance-companies`),
        ]);
        if (fRes.ok) {
          const data = await fRes.json();
          setFarms(data.farms || []);
          setSupabaseConnected(Boolean(data.supabase_connected));
          setSatProvider(data.satellite_provider || "Simulation");
          if (data.farms?.length > 0) setSelectedFarm(data.farms[0]);
        }
        if (cRes.ok) {
          const cData = await cRes.json();
          const activeList = (cData.companies || []).filter((c: FinanceCompany) => c.active);
          setCompanies(activeList);
          if (activeList.length > 0) setSelectedCompanyId(activeList[0].id);
        }
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  const loadFarmDetails = useCallback(async (farmId: string) => {
    try {
      const [nRes, pRes, lRes] = await Promise.all([
        fetch(`${API_BASE}/api/notifications?farm_id=${farmId}`),
        fetch(`${API_BASE}/api/payouts?farm_id=${farmId}`),
        fetch(`${API_BASE}/api/loans?farm_id=${farmId}`),
      ]);
      if (nRes.ok) {
        const nData = await nRes.json();
        setNotifications(nData.notifications || []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setPayouts(pData.payouts || []);
      }
      if (lRes.ok) {
        const lData = await lRes.json();
        setLoans(lData.loans || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (selectedFarm) loadFarmDetails(selectedFarm.id);
  }, [selectedFarm, loadFarmDetails]);

  const handlePlayBanglaVoice = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "bn-BD";
    utter.rate = 0.95;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarm || !selectedCompanyId) return;
    const comp = companies.find((c) => c.id === selectedCompanyId);
    if (!comp) return;
    setLoanMsg(null);

    const res = await fetch(`${API_BASE}/api/loans/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farm_id: selectedFarm.id,
        farmer_name: farmerName,
        phone: farmerPhone,
        finance_company_id: comp.id,
        finance_company_name: comp.name,
        requested_amount_bdt: loanAmount,
        credit_score: selectedFarm.analysis.fintech_traceability.credit_score,
        purpose: loanPurpose,
      }),
    });
    if (res.ok) {
      setLoanMsg("লোন আবেদন সফলভাবে জমা হয়েছে! (Loan Application Submitted)");
      loadFarmDetails(selectedFarm.id);
    }
  };

  const statusStyle = (status?: string) => {
    if (status === "HIGH_SALINITY") return "border-rose-300 bg-rose-50 text-rose-900";
    if (status === "IRRIGATE_NOW") return "border-amber-300 bg-amber-50 text-amber-900";
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  };

  const totalEarnedBdt = payouts
    .filter((p) => p.status === "PAID")
    .reduce((acc, p) => acc + p.amount_bdt, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar supabaseConnected={supabaseConnected} satProvider={satProvider} />

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">কৃষক পোর্টাল (Farmer Portal)</h2>
            <p className="text-sm text-slate-500">
              জমির অবস্থা, কার্বন ক্রেডিট, লোন ক্রেডিট স্কোর ও কৃষি ঋণ আবেদন।
            </p>
          </div>

          <select
            value={selectedFarm?.id || ""}
            onChange={(e) => {
              const found = farms.find((f) => f.id === e.target.value);
              if (found) setSelectedFarm(found);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.district} — {f.name}
              </option>
            ))}
          </select>
        </div>

        {selectedFarm && (
          <>
            {/* Status & Bangla Voice Card */}
            <div
              className={`rounded-2xl border p-6 shadow-sm space-y-4 ${statusStyle(
                selectedFarm.analysis.farmer_advisory.status
              )}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">
                  আজকের জমির পরামর্শ ({selectedFarm.district})
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">
                  <Droplets className="h-3.5 w-3.5" />
                  {selectedFarm.analysis.farmer_advisory.estimated_irrigation_savings_pct}% সেচ সাশ্রয়
                </span>
              </div>

              <p className="text-lg font-medium leading-relaxed">
                {selectedFarm.analysis.farmer_advisory.bangla_voice_sms}
              </p>

              <button
                onClick={() =>
                  handlePlayBanglaVoice(selectedFarm.analysis.farmer_advisory.bangla_voice_sms)
                }
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 transition"
              >
                <Volume2 className="h-4 w-4" />
                {speaking ? "ভয়েস চলছে..." : "বাংলা ভয়েস শুনুন (Play Audio)"}
              </button>
            </div>

            {/* Loan Credit + Carbon Credit + Sensor Health */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
                <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-violet-600" />
                  লোন ক্রেডিট স্কোর (Loan Credit)
                </div>
                <div className="text-2xl font-bold text-violet-700">
                  {selectedFarm.analysis.fintech_traceability.credit_score}/100
                </div>
                <div className="text-xs text-slate-600">
                  {selectedFarm.analysis.fintech_traceability.risk_tier} · সীমা: ৳
                  {selectedFarm.analysis.fintech_traceability.recommended_loan_limit_bdt.toLocaleString()}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
                <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <Leaf className="h-4 w-4 text-emerald-600" />
                  কার্বন ক্রেডিট ডেটা (Carbon Credit)
                </div>
                <div className="text-2xl font-bold text-emerald-700">
                  {selectedFarm.analysis.carbon_aggregation.estimated_tco2e_per_year} tCO2e
                </div>
                <div className="text-xs text-slate-600">
                  বোনাস (৬৫%): ৳
                  {selectedFarm.analysis.carbon_aggregation.farmer_payout_65_pct_bdt.toLocaleString()}
                  /বছর · প্রাপ্ত: ৳{totalEarnedBdt.toLocaleString()}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
                <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-sky-600" />
                  মাঠের সেন্সর ও NDVI
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  NDVI {selectedFarm.analysis.satellite_dmrv.ndvi}
                </div>
                <div className="text-xs text-slate-500">
                  আর্দ্রতা: {selectedFarm.iot.soil_moisture_pct}% · লবণাক্ততা:{" "}
                  {selectedFarm.iot.salinity_dsm} dS/m
                </div>
              </div>
            </div>

            {/* Apply for Agri-Loan */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Landmark className="h-4 w-4 text-violet-600" />
                কৃষি ঋণের জন্য আবেদন করুন (Apply for Agri-Loan)
              </h3>

              <form onSubmit={handleApplyLoan} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    ফাইন্যান্স কোম্পানি (Finance Partner)
                  </label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    required
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.company_type} · {c.interest_rate_pct}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    ঋণের পরিমাণ (Amount BDT)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    max={500000}
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    আবেদনকারীর নাম ও ফোন
                  </label>
                  <input
                    type="text"
                    value={farmerName}
                    onChange={(e) => setFarmerName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    ঋণের উদ্দেশ্য (Purpose)
                  </label>
                  <input
                    type="text"
                    value={loanPurpose}
                    onChange={(e) => setLoanPurpose(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    required
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-1">
                  <button
                    type="submit"
                    className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold px-5 py-2.5 text-sm transition"
                  >
                    আবেদন জমা দিন (Submit Loan Application)
                  </button>
                  {loanMsg && <span className="text-xs font-semibold text-emerald-700">{loanMsg}</span>}
                </div>
              </form>

              {loans.length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-500">আপনার ঋণ আবেদনের অবস্থা</div>
                  {loans.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium text-slate-900">{l.finance_company_name}</div>
                        <div className="text-xs text-slate-500">
                          {l.purpose} · Score {l.credit_score}/100
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">
                          ৳{l.requested_amount_bdt.toLocaleString()}
                        </div>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            l.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : l.status === "REJECTED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {l.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payout History */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-600" />
                কার্বন পেমেন্ট হিস্ট্রি (bKash / Nagad Payouts)
              </h3>
              {payouts.length === 0 ? (
                <p className="text-sm text-slate-500">এখনো কোনো পেমেন্ট রেকর্ড নেই।</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {payouts.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium text-slate-900">{p.farmer_name}</div>
                        <div className="text-xs text-slate-500">
                          {p.provider} · {p.bkash_number} · {p.tco2e_share} tCO2e
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">৳{p.amount_bdt.toLocaleString()}</div>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            p.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Bangla Notifications */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" />
                সাম্প্রতিক SMS ও ভয়েস অ্যালার্ট
              </h3>
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500">কোনো অ্যালার্ট নেই।</p>
              ) : (
                <div className="space-y-2">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-sky-700">{n.channel}</span>
                        <span>{new Date(n.sent_at).toLocaleString()}</span>
                      </div>
                      {n.message_bn}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
