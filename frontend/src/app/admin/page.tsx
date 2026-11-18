"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Check,
  Download,
  Eye,
  Landmark,
  Plus,
  Search,
  Send,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import type {
  FinanceCompany,
  LoanApplication,
  NotificationItem,
  PayoutItem,
  PilotFarm,
  UserProfile,
  UserRole,
} from "@/types/agrotwin";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminPortalPage() {
  const [farms, setFarms] = useState<PilotFarm[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [inspectedUser, setInspectedUser] = useState<UserProfile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [payoutSummary, setPayoutSummary] = useState({ total_paid_bdt: 0, total_pending_bdt: 0 });
  const [companies, setCompanies] = useState<FinanceCompany[]>([]);
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [satProvider, setSatProvider] = useState("Google Earth Engine");

  // Add User Form
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("farmer");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("Bogura");

  // Add Finance Company Form
  const [compName, setCompName] = useState("");
  const [compType, setCompType] = useState<"MFI" | "BANK" | "AGRI_INSURER">("MFI");
  const [compRate, setCompRate] = useState(9.0);
  const [compMaxLoan, setCompMaxLoan] = useState(200000);

  // Trigger Notification Form
  const [notifFarmId, setNotifFarmId] = useState("farm-bogura-01");
  const [notifChannel, setNotifChannel] = useState<"SMS" | "IVR_VOICE" | "IN_APP">("SMS");

  // Generate Payout Form
  const [payFarmId, setPayFarmId] = useState("farm-bogura-01");
  const [payFarmerName, setPayFarmerName] = useState("Abdul Karim (Farmer)");
  const [payBkash, setPayBkash] = useState("01812000003");
  const [payAmount, setPayAmount] = useState(3500);

  const loadAll = useCallback(async (searchQuery = "") => {
    try {
      const qParam = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : "";
      const [fRes, uRes, nRes, pRes, cRes, lRes] = await Promise.all([
        fetch(`${API_BASE}/api/farms`),
        fetch(`${API_BASE}/api/users${qParam}`),
        fetch(`${API_BASE}/api/notifications`),
        fetch(`${API_BASE}/api/payouts`),
        fetch(`${API_BASE}/api/finance-companies`),
        fetch(`${API_BASE}/api/loans`),
      ]);

      if (fRes.ok) {
        const fData = await fRes.json();
        setFarms(fData.farms || []);
        setSupabaseConnected(Boolean(fData.supabase_connected));
        setSatProvider(fData.satellite_provider || "Simulation");
      }
      if (uRes.ok) {
        const uData = await uRes.json();
        setUsers(uData.users || []);
      }
      if (nRes.ok) {
        const nData = await nRes.json();
        setNotifications(nData.notifications || []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setPayouts(pData.payouts || []);
        if (pData.summary) setPayoutSummary(pData.summary);
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setCompanies(cData.companies || []);
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
    loadAll();
  }, [loadAll]);

  const handleSearchUsers = (val: string) => {
    setUserSearch(val);
    loadAll(val);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;
    const res = await fetch(`${API_BASE}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        role,
        phone,
        bkash_number: phone,
        district,
      }),
    });
    if (res.ok) {
      setFullName("");
      setPhone("");
      loadAll(userSearch);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const res = await fetch(`${API_BASE}/api/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) loadAll(userSearch);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) return;
    const res = await fetch(`${API_BASE}/api/finance-companies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: compName,
        company_type: compType,
        interest_rate_pct: compRate,
        max_loan_bdt: compMaxLoan,
      }),
    });
    if (res.ok) {
      setCompName("");
      loadAll(userSearch);
    }
  };

  const handleToggleCompany = async (companyId: string) => {
    const res = await fetch(`${API_BASE}/api/finance-companies/${companyId}/toggle`, {
      method: "PATCH",
    });
    if (res.ok) loadAll(userSearch);
  };

  const handleLoanStatus = async (loanId: string, status: "APPROVED" | "REJECTED") => {
    const res = await fetch(`${API_BASE}/api/loans/${loanId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) loadAll(userSearch);
  };

  const handleTriggerNotification = async () => {
    const res = await fetch(`${API_BASE}/api/notifications/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farm_id: notifFarmId,
        channel: notifChannel,
      }),
    });
    if (res.ok) loadAll(userSearch);
  };

  const handleGeneratePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/api/payouts/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farm_id: payFarmId,
        farmer_name: payFarmerName,
        bkash_number: payBkash,
        tco2e_share: Number((payAmount / 1248).toFixed(2)),
        amount_bdt: payAmount,
        provider: "BKASH",
      }),
    });
    if (res.ok) loadAll(userSearch);
  };

  const handleApprovePayout = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/payouts/${id}/approve`, {
      method: "PATCH",
    });
    if (res.ok) loadAll(userSearch);
  };

  const handleExportAuditJson = () => {
    const bundle = {
      exported_at: new Date().toISOString(),
      platform: "CarbonCredit dMRV",
      clusters: farms,
      finance_companies: companies,
      loans,
      payouts,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carboncredit-dmrv-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalAcres = farms.reduce((sum, f) => sum + f.area_acres, 0);
  const totalCo2e = farms.reduce(
    (sum, f) => sum + f.analysis.carbon_aggregation.estimated_tco2e_per_year,
    0
  );

  // Inspected User Data
  const inspectedFarm = inspectedUser?.farm_id
    ? farms.find((f) => f.id === inspectedUser.farm_id)
    : farms.find((f) => f.district.toLowerCase() === inspectedUser?.district.toLowerCase());
  const inspectedLoans = inspectedUser
    ? loans.filter(
        (l) =>
          l.phone === inspectedUser.phone ||
          l.farmer_name.toLowerCase().includes(inspectedUser.full_name.toLowerCase())
      )
    : [];
  const inspectedPayouts = inspectedUser
    ? payouts.filter(
        (p) =>
          p.bkash_number === inspectedUser.phone ||
          p.farmer_name.toLowerCase().includes(inspectedUser.full_name.toLowerCase())
      )
    : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar supabaseConnected={supabaseConnected} satProvider={satProvider} />

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Admin Operations, Finance Partners & Revenue Ledger
            </h2>
            <p className="text-sm text-slate-500">
              Search & manage users/roles, manage MFI/Bank finance partners, approve loans & payouts, and export dMRV audits.
            </p>
          </div>
          <button
            onClick={handleExportAuditJson}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Export dMRV Audit JSON
          </button>
        </div>

        {/* National KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Total Pilot Area</div>
            <div className="text-2xl font-bold text-slate-900">{totalAcres} Acres</div>
            <div className="text-xs text-emerald-700">{farms.length} active clusters</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Annual Carbon Pool</div>
            <div className="text-2xl font-bold text-emerald-700">{totalCo2e.toFixed(1)} tCO2e</div>
            <div className="text-xs text-slate-500">~${(totalCo2e * 16).toLocaleString()} gross FX</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Disbursed to Farmers</div>
            <div className="text-2xl font-bold text-slate-900">
              ৳{payoutSummary.total_paid_bdt.toLocaleString()}
            </div>
            <div className="text-xs text-amber-700">
              Pending: ৳{payoutSummary.total_pending_bdt.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Finance Partners & Loans</div>
            <div className="text-2xl font-bold text-slate-900">{companies.length} Partners</div>
            <div className="text-xs text-violet-700">{loans.length} loan applications</div>
          </div>
        </div>

        {/* User Search & Role Management + User Data Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                User Search & Role Management
              </h3>
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  placeholder="Search name, phone, district..."
                  className="rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs w-full sm:w-56"
                />
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="col-span-2 sm:col-span-1 rounded-lg border border-slate-300 px-2.5 py-2"
                required
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="rounded-lg border border-slate-300 px-2 py-2 bg-white"
              >
                <option value="farmer">Farmer</option>
                <option value="field_agent">Field Agent</option>
                <option value="b2b_partner">B2B / MFI</option>
                <option value="admin">Admin</option>
              </select>
              <input
                type="text"
                placeholder="Phone (017...)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-2"
                required
              />
              <input
                type="text"
                placeholder="District"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-2"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-2"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </form>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {users.map((u) => (
                <div key={u.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{u.full_name}</div>
                    <div className="text-xs text-slate-500">
                      {u.phone} · {u.district}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
                    >
                      <option value="farmer">farmer</option>
                      <option value="field_agent">field_agent</option>
                      <option value="b2b_partner">b2b_partner</option>
                      <option value="admin">admin</option>
                    </select>
                    <button
                      onClick={() => setInspectedUser(u)}
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Data
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Data Inspector OR Notification Center */}
          <div className="lg:col-span-5 space-y-6">
            {inspectedUser && (
              <div className="rounded-xl border-2 border-sky-300 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 text-sm">
                    User Data Inspector: {inspectedUser.full_name}
                  </h3>
                  <button
                    onClick={() => setInspectedUser(null)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>
                    <strong>Role:</strong> {inspectedUser.role} · <strong>Phone:</strong>{" "}
                    {inspectedUser.phone} · <strong>District:</strong> {inspectedUser.district}
                  </div>
                  {inspectedFarm && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-emerald-900 mt-2">
                      <div>
                        <strong>Cluster:</strong> {inspectedFarm.name} ({inspectedFarm.area_acres} acres)
                      </div>
                      <div>
                        <strong>Credit Score:</strong>{" "}
                        {inspectedFarm.analysis.fintech_traceability.credit_score}/100 ·{" "}
                        <strong>Carbon:</strong>{" "}
                        {inspectedFarm.analysis.carbon_aggregation.estimated_tco2e_per_year} tCO2e/yr
                      </div>
                    </div>
                  )}
                  <div className="pt-1">
                    <strong>Loans ({inspectedLoans.length}):</strong>{" "}
                    {inspectedLoans.length === 0
                      ? "None"
                      : inspectedLoans
                          .map((l) => `৳${l.requested_amount_bdt.toLocaleString()} (${l.status})`)
                          .join(", ")}
                  </div>
                  <div>
                    <strong>Payouts ({inspectedPayouts.length}):</strong>{" "}
                    {inspectedPayouts.length === 0
                      ? "None"
                      : inspectedPayouts
                          .map((p) => `৳${p.amount_bdt.toLocaleString()} (${p.status})`)
                          .join(", ")}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" />
                Bangla SMS / IVR Notification Center
              </h3>

              <div className="flex flex-wrap gap-2 text-xs">
                <select
                  value={notifFarmId}
                  onChange={(e) => setNotifFarmId(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-2.5 py-2 bg-white"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.district} — {f.name}
                    </option>
                  ))}
                </select>
                <select
                  value={notifChannel}
                  onChange={(e) => setNotifChannel(e.target.value as "SMS" | "IVR_VOICE" | "IN_APP")}
                  className="rounded-lg border border-slate-300 px-2.5 py-2 bg-white"
                >
                  <option value="SMS">SMS</option>
                  <option value="IVR_VOICE">IVR Voice</option>
                  <option value="IN_APP">In-App</option>
                </select>
                <button
                  onClick={handleTriggerNotification}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold px-3 py-2"
                >
                  <Send className="h-3.5 w-3.5" /> Send Alert
                </button>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                    <div className="flex justify-between text-slate-500 mb-1">
                      <span className="font-semibold text-sky-700">{n.channel}</span>
                      <span>{new Date(n.sent_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-slate-800">{n.message_bn}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Finance Companies Management + Agri-Loan Applications */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-violet-600" />
              Finance Companies Management (MFI / Bank / Insurer)
            </h3>

            <form onSubmit={handleCreateCompany} className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <input
                type="text"
                placeholder="Company Name"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                className="col-span-2 rounded-lg border border-slate-300 px-2.5 py-2"
                required
              />
              <select
                value={compType}
                onChange={(e) => setCompType(e.target.value as "MFI" | "BANK" | "AGRI_INSURER")}
                className="rounded-lg border border-slate-300 px-2 py-2 bg-white"
              >
                <option value="MFI">MFI</option>
                <option value="BANK">BANK</option>
                <option value="AGRI_INSURER">INSURER</option>
              </select>
              <input
                type="number"
                step="0.5"
                placeholder="Rate %"
                value={compRate}
                onChange={(e) => setCompRate(Number(e.target.value) || 0)}
                className="rounded-lg border border-slate-300 px-2 py-2"
              />
              <button
                type="submit"
                className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold px-3 py-2"
              >
                + Add
              </button>
            </form>

            <div className="divide-y divide-slate-100">
              {companies.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">
                      {c.company_type} · {c.interest_rate_pct}% interest · Max ৳
                      {c.max_loan_bdt.toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleCompany(c.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                      c.active
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-slate-100 border-slate-200 text-slate-500"
                    }`}
                  >
                    {c.active ? "Active" : "Paused"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900">
              Farmer Agri-Loan Applications (Credit-Score Backed)
            </h3>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {loans.map((l) => (
                <div key={l.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium text-slate-900">
                      {l.farmer_name} — ৳{l.requested_amount_bdt.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">
                      {l.finance_company_name} · Score {l.credit_score}/100 · {l.purpose}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {l.status === "PENDING" ? (
                      <>
                        <button
                          onClick={() => handleLoanStatus(l.id, "APPROVED")}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 py-1"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleLoanStatus(l.id, "REJECTED")}
                          className="rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold px-2.5 py-1"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          l.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {l.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue & Payout Ledger */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600" />
            Carbon Revenue & Farmer Payout Ledger (bKash / Nagad)
          </h3>

          <form onSubmit={handleGeneratePayout} className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <select
              value={payFarmId}
              onChange={(e) => setPayFarmId(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-2 bg-white"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.district} Cluster
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Farmer Name"
              value={payFarmerName}
              onChange={(e) => setPayFarmerName(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-2"
              required
            />
            <input
              type="text"
              placeholder="bKash Number"
              value={payBkash}
              onChange={(e) => setPayBkash(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-2"
              required
            />
            <input
              type="number"
              placeholder="Amount BDT"
              value={payAmount}
              onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
              className="rounded-lg border border-slate-300 px-2.5 py-2"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-2"
            >
              + Queue Payout
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2">Farmer</th>
                  <th className="py-2">Wallet</th>
                  <th className="py-2">CO2e Share</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 font-medium text-slate-900">{p.farmer_name}</td>
                    <td className="py-2.5 text-slate-600">
                      {p.provider} · {p.bkash_number}
                    </td>
                    <td className="py-2.5 text-slate-600">{p.tco2e_share} t</td>
                    <td className="py-2.5 font-semibold text-slate-900">
                      ৳{p.amount_bdt.toLocaleString()}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          p.status === "PAID"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {p.status === "PENDING" ? (
                        <button
                          onClick={() => handleApprovePayout(p.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve & Pay
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Disbursed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
