import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
type Method = "email" | "sms";

export default function ForgotPassword() {
  const [method, setMethod] = useState<Method>("email");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [requestId, setRequestId] = useState("");
  const [step, setStep] = useState<"request" | "verify" | "done">("request");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("requestId")) {
      setRequestId(query.get("requestId") || "");
      setMethod(query.get("method") === "sms" ? "sms" : "email");
      setIdentifier(query.get("identifier") || "");
      setStep("verify");
      setMessage("A verification code was sent to your registered email.");
    }
  }, []);

  const callApi = async (path: string, body: Record<string, string>) => {
    const response = await fetch(`${apiBaseUrl}/api/password-reset/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Something went wrong.");
    return data;
  };

  const requestOtp = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = await callApi("request", { method, identifier });
      setRequestId(data.requestId || ""); setMessage(data.message);
      if (data.requestId) setStep("verify");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to send OTP."); }
    finally { setBusy(false); }
  };

  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = await callApi("verify", { requestId, otp });
      setStep("done"); setMessage(data.message);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to verify OTP."); }
    finally { setBusy(false); }
  };

  const resendOtp = async () => {
    setBusy(true); setError("");
    try { const data = await callApi("resend", { requestId }); setMessage(data.message); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to resend OTP."); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-[#f4f7fb] px-4 py-12 text-slate-900 sm:px-6">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-[0.85fr_1.15fr]">
        <section className="bg-[#10233f] p-8 text-white sm:p-12">
          <ShieldCheck size={34} className="mb-12 text-cyan-300" />
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Account recovery</p>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">Get back to the work that matters.</h1>
          <p className="mt-5 leading-7 text-slate-300">Verify your registered contact, then choose a secure new password.</p>
          <div className="mt-12 space-y-4 text-sm text-slate-300"><p className="flex gap-3"><CheckCircle2 size={18} className="shrink-0 text-cyan-300" /> One request every 24 hours</p><p className="flex gap-3"><CheckCircle2 size={18} className="shrink-0 text-cyan-300" /> OTP expires after 5 minutes</p><p className="flex gap-3"><CheckCircle2 size={18} className="shrink-0 text-cyan-300" /> Change the temporary password after sign-in</p></div>
        </section>
        <section className="p-8 sm:p-12">
          <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"><ArrowLeft size={16} /> Back to home</Link>
          {step === "request" && <form onSubmit={requestOtp} className="space-y-6"><div><h2 className="text-2xl font-bold">Forgot your password?</h2><p className="mt-2 text-sm text-slate-500">Choose where to receive your verification code.</p></div><div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1"><button type="button" onClick={() => setMethod("email")} className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${method === "email" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><Mail size={16} /> Email</button><button type="button" onClick={() => setMethod("sms")} className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${method === "sms" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><MessageSquare size={16} /> Mobile</button></div><label className="block text-sm font-semibold" htmlFor="identifier">{method === "email" ? "Registered email address" : "Registered mobile number"}<input id="identifier" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} type={method === "email" ? "email" : "tel"} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500" placeholder={method === "email" ? "you@example.com" : "+91 9876543210"} /></label><button disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? "Sending..." : "Send verification code"}</button></form>}
          {step === "verify" && <form onSubmit={verifyOtp} className="space-y-6"><div><h2 className="text-2xl font-bold">Enter your OTP</h2><p className="mt-2 text-sm text-slate-500">{message || "The code is valid for 5 minutes."}</p></div><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none focus:border-blue-500" placeholder="000000" /><button disabled={busy || !requestId} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? "Verifying..." : "Verify OTP"}</button><button type="button" disabled={busy || !requestId} onClick={resendOtp} className="w-full text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50">Resend code</button></form>}
          {step === "done" && <div className="space-y-4"><CheckCircle2 size={42} className="text-emerald-500" /><h2 className="text-2xl font-bold">Temporary password sent</h2><p className="text-slate-500">{message} Log in with it, then change it immediately.</p><Link href="/register" className="inline-block pt-4 font-bold text-blue-600">Go to login</Link></div>}
          {error && <p role="alert" className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </section>
      </div>
    </main>
  );
}