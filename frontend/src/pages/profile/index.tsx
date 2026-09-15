import { selectuser } from "@/Feature/Userslice";
import { ExternalLink, History, LockKeyhole, Mail, MonitorSmartphone, User } from "lucide-react";
import ResumeBuilder from "@/Components/ResumeBuilder";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

const PLAN_DETAILS = [
  { id: "free", name: "Free", price: 0, limit: 1, description: "1 internship application per month", features: ["1 application/month", "Basic profile access"] },
  { id: "bronze", name: "Bronze", price: 100, limit: 3, description: "₹100/month – up to 3 applications", features: ["3 applications/month", "Priority internship access"] },
  { id: "silver", name: "Silver", price: 300, limit: 5, description: "₹300/month – up to 5 applications", features: ["5 applications/month", "Faster shortlist visibility"] },
  { id: "gold", name: "Gold", price: 1000, limit: Infinity, description: "₹1000/month – unlimited applications", features: ["Unlimited applications", "Premium internship access"] },
];

interface User {
  name: string;
  email: string;
  photo: string;
}
const index = () => {
  // const [user, setuser] = useState<User | null>({
  //   name: "Rahul",
  //   email: "xyz@gmail.com",
  //   photo:
  //     "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=faces",
  // });
  const user=useSelector(selectuser)
  const [history, setHistory] = useState<any[]>([]);
  const [postHistory, setPostHistory] = useState<any[]>([]);
  const [showPostHistory, setShowPostHistory] = useState(false);
  const [postHistoryLoading, setPostHistoryLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showResetHistory, setShowResetHistory] = useState(false);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
  const [loginHistoryError, setLoginHistoryError] = useState("");
  const [billing, setBilling] = useState<any>({
    currentPlan: "Free",
    remainingQuota: 1,
    renewalDate: new Date(),
    invoices: [],
  });
  const [billingLoading, setBillingLoading] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [plans, setPlans] = useState<any[]>(PLAN_DETAILS);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [planBusy, setPlanBusy] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState("");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/application/plans`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.plans?.length) setPlans(data.plans);
      })
      .catch(() => setPlans(PLAN_DETAILS));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/auth/password-reset-history/${user.id}`)
      .then((response) => response.json())
      .then((data) => setHistory(data.history || []))
      .catch(() => setHistory([]));
  }, [user?.id]);

  const accountIdentifier = user?.id || user?.uid || user?.email;

  useEffect(() => {
    if (!accountIdentifier) return;
    setLoginHistoryLoading(true);
    setLoginHistoryError("");
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/auth/login-history/${encodeURIComponent(accountIdentifier)}`)
      .then(async (response) => {
        const responseText = await response.text();
        let data: { message?: string; history?: any[] };
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          data = { message: `The API returned an unexpected response (${response.status}).` };
        }
        if (!response.ok) throw new Error(data.message || "Unable to load login history.");
        return data;
      })
      .then((data) => setLoginHistory(data.history || []))
      .catch((error) => { setLoginHistory([]); setLoginHistoryError(error instanceof Error ? error.message : "Unable to load login history."); })
      .finally(() => setLoginHistoryLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    setBillingLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/application/profile/${encodeURIComponent(user.id)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load billing details.");
        setBilling({
          currentPlan: data.currentPlan || "Free",
          remainingQuota: data.remainingQuota ?? 1,
          renewalDate: data.renewalDate || new Date(),
          invoices: data.invoices || data.paymentHistory || [],
        });
      })
      .catch(() => {
        setBilling({
          currentPlan: "Free",
          remainingQuota: 1,
          renewalDate: new Date(),
          invoices: [],
        });
      })
      .finally(() => setBillingLoading(false));
  }, [user?.id]);

  const requestOtp = async () => {
    if (!user?.email) {
      toast.error("Please sign in to continue.");
      return;
    }

    setPlanBusy(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/application/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id || user.uid || user.email, email: user.email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to send OTP.");
      setOtpSent(true);
      toast.success("OTP sent to your email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send OTP.");
    } finally {
      setPlanBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!user?.email || !otp.trim()) {
      toast.error("Enter the OTP sent to your email.");
      return;
    }

    setPlanBusy(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/application/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id || user.uid || user.email, email: user.email, otp }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "OTP verification failed.");
      setVerificationToken(data.verificationToken);
      setOtpSuccessMessage("OTP verification successful. You are now able to purchase this plan.");
      setOtpModalOpen(true);
      toast.success("OTP verification successful. You are now able to purchase a plan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "OTP verification failed.");
    } finally {
      setPlanBusy(false);
    }
  };

  const refreshBilling = async () => {
    if (!user?.id && !(user as any)?.uid && !user?.email) return;
    const userId = user?.id || user?.uid || user?.email;
    if (!userId) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/application/profile/${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load billing details.");
      setBilling({
        currentPlan: data.currentPlan || "Free",
        remainingQuota: data.remainingQuota ?? 1,
        renewalDate: data.renewalDate || new Date(),
        invoices: data.invoices || data.paymentHistory || [],
      });
    } catch (error) {
      console.error(error);
    }
  };

  const buyPlan = async (planId: string) => {
    if (!user?.email) {
      toast.error("Please sign in to continue.");
      return;
    }

    if (planId === "free") {
      setPlanBusy(true);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/application/plan-change`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id || user.uid || user.email, email: user.email, planId: "free", action: "downgrade" }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to switch to the free plan.");
        await refreshBilling();
        toast.success("Free plan is active.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to switch plan.");
      } finally {
        setPlanBusy(false);
      }
      return;
    }

    let token = verificationToken;
    if (!token) {
      setPendingPlanId(planId);
      setOtpSuccessMessage("");
      setOtp("");
      setOtpSent(false);
      setOtpModalOpen(true);
      await requestOtp();
      return;
    }

    try {
      setPlanBusy(true);
      const orderResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/application/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id || user.uid || user.email, email: user.email, verificationToken: token, planId }),
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.message || "Unable to create the payment order.");

      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Payment gateway could not be loaded."));
        document.body.appendChild(script);
      });

      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) throw new Error("Payment gateway could not be loaded.");

      new Razorpay({
        key: orderData.keyId,
        amount: orderData.order.amount,
        currency: "INR",
        name: "InternArea",
        description: `Internship plan: ${planId}`,
        order_id: orderData.order.id,
        handler: async (payment: any) => {
          try {
            const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/application/verify-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user.id || user.uid || user.email, email: user.email, verificationToken: token, planId, ...payment }),
            });
            const verifyData = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verifyData.message || "Payment verification failed.");
            setVerificationToken("");
            setOtp("");
            setOtpSent(false);
            await refreshBilling();
            toast.success("Plan purchased successfully.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Payment verification failed.");
          } finally {
            setPlanBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPlanBusy(false);
            toast.info("Payment cancelled. No subscription was changed.");
          },
        },
      }).open();
    } catch (error) {
      setPlanBusy(false);
      toast.error(error instanceof Error ? error.message : "Unable to start payment.");
    }
  };

  const loadPostHistory = async () => {
    if (!user?.id) return;
    setShowPostHistory((current) => !current);
    if (postHistory.length || showPostHistory) return;
    setPostHistoryLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/social/posts/history/${user.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load post history.");
      setPostHistory(data.posts || []);
    } catch (error) {
      setPostHistory([]);
    } finally {
      setPostHistoryLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Profile Header */}
          <div className="relative h-32 bg-linear-to-r from-blue-500 to-blue-600">
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
              {user?.photo ? (
                <img
                  src={user?.photo}
                  alt={user?.name}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center">
                  <User className="h-12 w-12 text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* Profile Content */}
          <div className="pt-16 pb-8 px-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
              <div className="mt-2 flex items-center justify-center text-gray-500">
                <Mail className="h-4 w-4 mr-2" />
                <span>{user?.email}</span>
              </div>
            </div>

            {/* Profile Details */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <span className="text-blue-600 font-semibold text-2xl">
                    {billingLoading ? "…" : billing.remainingQuota}
                  </span>
                  <p className="text-blue-600 text-sm mt-1">
                    Remaining applications
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <span className="text-green-600 font-semibold text-2xl">
                    {billing.currentPlan}
                  </span>
                  <p className="text-green-600 text-sm mt-1">
                    Current plan
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Subscription</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">{billing.currentPlan}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPlans((current) => !current)}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    {showPlans ? "Hide plans" : "View plans"}
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-slate-600">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-slate-500">Renewal date</p>
                    <p className="mt-1 font-semibold text-slate-900">{new Date(billing.renewalDate).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-slate-500">Plan status</p>
                    <p className="mt-1 font-semibold text-emerald-600">Active</p>
                  </div>
                </div>

                {showPlans && (
                  <div className="mt-6 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      {plans.map((plan) => {
                        const isCurrent = billing.currentPlan?.toLowerCase() === plan.name.toLowerCase();
                        const buttonLabel = isCurrent ? "Current plan" : plan.id === "free" ? "Use free plan" : "Purchase plan";

                        return (
                          <div key={plan.id} className={`rounded-2xl border p-4 ${isCurrent ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-lg font-bold text-slate-900">{plan.name}</p>
                                <p className="text-xs text-slate-500">{plan.description}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-black text-slate-900">{plan.price === 0 ? "Free" : `₹${plan.price}`}</p>
                              </div>
                            </div>
                            <ul className="mt-4 space-y-2 text-sm text-slate-600">
                              {plan.features?.map((feature: string) => (
                                <li key={feature} className="flex items-start gap-2">
                                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              onClick={() => buyPlan(plan.id)}
                              disabled={planBusy || isCurrent}
                              className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-semibold ${isCurrent ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                            >
                              {buttonLabel}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {otpModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                  <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-bold text-slate-900">OTP verification</h3>
                      <button type="button" onClick={() => setOtpModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">We’ve sent a one-time code to <span className="font-semibold text-slate-900">{user?.email}</span>.</p>

                    {otpSuccessMessage ? (
                      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                        <p className="font-semibold">OTP verification successful.</p>
                        <p className="mt-1">{otpSuccessMessage}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpModalOpen(false);
                            if (pendingPlanId) {
                              buyPlan(pendingPlanId);
                            }
                          }}
                          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
                        >
                          Continue to payment
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="Enter OTP"
                          className="mt-5 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                          inputMode="numeric"
                        />
                        <div className="mt-5 flex gap-3">
                          <button type="button" onClick={requestOtp} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            Resend OTP
                          </button>
                          <button type="button" onClick={verifyOtp} disabled={planBusy || otp.length !== 6} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                            Verify OTP
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-gray-900">Payment history</h2>
                  <span className="text-sm text-slate-500">{billing.invoices.length} invoices</span>
                </div>
                {billing.invoices.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs text-gray-600">
                      <thead>
                        <tr className="border-b text-gray-500">
                          <th className="px-2 py-2">Invoice</th>
                          <th className="px-2 py-2">Plan</th>
                          <th className="px-2 py-2">Amount</th>
                          <th className="px-2 py-2">Date</th>
                          <th className="px-2 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billing.invoices.map((entry: any) => (
                          <tr key={entry._id || entry.paymentId || entry.invoiceNumber} className="border-b">
                            <td className="px-2 py-2 font-semibold text-slate-700">{entry.invoiceNumber || entry.paymentId || "Invoice"}</td>
                            <td className="px-2 py-2">{entry.planName || entry.planId || "Plan"}</td>
                            <td className="px-2 py-2">₹{entry.amount ?? 0}</td>
                            <td className="px-2 py-2">{new Date(entry.createdAt || entry.billingPeriodStart || Date.now()).toLocaleDateString("en-IN")}</td>
                            <td className="px-2 py-2 capitalize text-emerald-600">{entry.status || "Paid"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No billing invoices yet. Purchase a plan to get started.</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap justify-center gap-3 pt-4">
                <Link
                  href="/userapplication"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  View Applications
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
                {user?.id && (
                  <>
                    <button type="button" onClick={loadPostHistory} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-6 py-3 font-medium text-blue-700 hover:bg-blue-100">
                      <History className="h-4 w-4" /> Post history
                    </button>
                    <button type="button" onClick={() => setShowPasswordReset((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">
                      <LockKeyhole className="h-4 w-4" /> Password reset
                    </button>
                    <Link href="/login-activity" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">
                      <MonitorSmartphone className="h-4 w-4" /> View all login activity
                    </Link>
                    <button type="button" onClick={() => setShowLoginHistory((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">
                      <History className="h-4 w-4" /> Recent logins
                    </button>
                  </>
                )}
              </div>
              {user?.id && showLoginHistory && (
                <section className="border-t border-slate-200 pt-6">
                  <div className="mb-4 flex items-center gap-2"><History className="h-5 w-5 text-blue-600" /><h2 className="text-lg font-bold text-gray-900">Recent login activity</h2></div>
                  {loginHistoryLoading && <p className="text-sm text-slate-500">Loading login history...</p>}
                  {!loginHistoryLoading && loginHistoryError && <p className="text-sm text-red-600">{loginHistoryError}</p>}
                  {!loginHistoryLoading && !loginHistory.length && <p className="text-sm text-slate-500">No login activity recorded yet.</p>}
                  {!loginHistoryLoading && loginHistory.length > 0 && <div className="overflow-x-auto"><table className="min-w-full text-left text-xs text-gray-600"><thead><tr className="border-b text-gray-500"><th className="px-2 py-2">Date and time</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Browser</th><th className="px-2 py-2">Operating system</th><th className="px-2 py-2">Device</th><th className="px-2 py-2">IP / location</th></tr></thead><tbody>{loginHistory.map((entry) => <tr key={entry._id} className="border-b"><td className="whitespace-nowrap px-2 py-2">{new Date(entry.loggedInAt).toLocaleString()}</td><td className={`px-2 py-2 font-semibold ${entry.status === "success" ? "text-emerald-600" : "text-red-600"}`}>{entry.status}</td><td className="px-2 py-2">{entry.browser?.name || "Unknown"} {entry.browser?.version || ""}</td><td className="px-2 py-2">{entry.operatingSystem?.name || "Unknown"} {entry.operatingSystem?.version || ""}</td><td className="px-2 py-2">{entry.deviceType || "Unknown"}{entry.deviceModel && entry.deviceModel !== "Unknown" ? ` (${entry.deviceModel})` : ""}</td><td className="max-w-xs px-2 py-2">{entry.ipAddress || "Unknown"} / {[entry.location?.city, entry.location?.region, entry.location?.country].filter((value) => value && value !== "Unknown").join(", ") || "Unknown"}</td></tr>)}</tbody></table></div>}
                </section>
              )}
              {user?.id && (
                <div className={showPostHistory ? "border-t border-slate-200 pt-6" : "hidden"}>
                  {showPostHistory && (
                    <div className="mt-5 space-y-3">
                      {postHistoryLoading && <p className="text-sm text-slate-500">Loading post history...</p>}
                      {!postHistoryLoading && !postHistory.length && <p className="text-sm text-slate-500">No posts published yet.</p>}
                      {postHistory.map((post) => (
                        <article key={post._id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs text-slate-500">{new Date(post.createdAt).toLocaleString()} {post.editedAt ? "(edited)" : ""}</span>
                            <span className="text-xs font-semibold uppercase text-slate-500">{post.deletedAt ? "Deleted" : post.privacy}</span>
                          </div>
                          {post.text && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{post.text}</p>}
                          <p className="mt-2 text-xs text-slate-500">Friends: {post.friendCountAtPost} | Likes: {post.likeCount} | Comments: {post.comments?.length || 0} | Shares: {post.shares} | Views: {post.views}</p>
                          {post.media?.length > 0 && <p className="mt-1 text-xs text-slate-500">Media: {post.media.map((item: { type: string }) => item.type).join(", ")}</p>}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {user?.id && (
                <div className={showPasswordReset ? "border-t border-slate-200 pt-6" : "hidden"}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><LockKeyhole className="h-5 w-5 text-blue-600" /> Password security</h2><p className="mt-1 text-sm text-gray-500">Manage your password and review recovery activity.</p></div>
                    <Link href="/change-password" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Change password</Link>
                  </div>
                  <div className="mt-6 overflow-x-auto">
                    <button type="button" onClick={() => setShowResetHistory((current) => !current)} className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><History className="h-4 w-4" /> Reset history</button>
                    {showResetHistory && (history.length ? <table className="min-w-full text-left text-xs text-gray-600"><thead><tr className="border-b text-gray-500"><th className="px-2 py-2">Requested</th><th className="px-2 py-2">Method</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">IP</th><th className="px-2 py-2">Browser / Device</th></tr></thead><tbody>{history.map((entry) => <tr key={entry._id} className="border-b"><td className="px-2 py-2">{new Date(entry.requestedAt).toLocaleString()}</td><td className="px-2 py-2 uppercase">{entry.method}</td><td className="px-2 py-2">{entry.verificationStatus}</td><td className="px-2 py-2">{entry.ipAddress || "unknown"}</td><td className="max-w-xs px-2 py-2">{entry.browser || "unknown"} / {entry.device || "unknown"}</td></tr>)}</tbody></table> : <p className="text-sm text-gray-500">No password reset activity yet.</p>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <ResumeBuilder user={user} />
      </div>
    </div>
  );
};

export default index;