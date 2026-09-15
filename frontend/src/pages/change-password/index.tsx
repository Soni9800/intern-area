import Link from "next/link";
import { ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "react-toastify";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])\S{10,72}$/;

export default function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [redirectCounter, setRedirectCounter] = useState(3);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordPattern.test(password)) return toast.error("Use 10-72 characters with uppercase, lowercase, number, and special character.");
    if (password !== confirmation) return toast.error("Passwords do not match.");
    const stored = localStorage.getItem("internareaAccount");
    const account = stored ? JSON.parse(stored) : null;
    if (!account?.id) return toast.error("Please log in before changing your password.");
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/change-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: account.id, newPassword: password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to change password.");
      localStorage.setItem("internareaAccount", JSON.stringify(data.account));
      setDone(true); toast.success("Password changed successfully. Redirecting to home...");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to change password."); }
    finally { setBusy(false); }
  };

  // Auto-redirect after 3 seconds when password change is successful
  useEffect(() => {
    if (!done) return;

    const timer = window.setInterval(() => {
      setRedirectCounter((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          window.clearInterval(timer);
          window.location.assign("/");
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [done]);

  return <main className="min-h-[calc(100vh-8rem)] bg-[#f4f7fb] px-4 py-12 text-slate-900 sm:px-6"><div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-xl sm:p-12"><Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"><ArrowLeft size={16} /> Back to home</Link>{done ? <div className="space-y-4"><CheckCircle2 size={42} className="text-emerald-500" /><h1 className="text-2xl font-bold">Password changed</h1><p className="text-slate-500">Your new password is active. You can use it for future logins.</p><p className="text-sm text-slate-400">Redirecting to home in {redirectCounter} seconds...</p><Link href="/" className="inline-block pt-4 font-bold text-blue-600">Click here if not redirected</Link></div> : <><LockKeyhole size={34} className="text-blue-600" /><h1 className="mt-5 text-3xl font-black">Create a new password</h1><p className="mt-2 text-slate-500">Choose a password you have not used elsewhere.</p><form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-semibold" htmlFor="new-password">New password<input id="new-password" type="password" required minLength={10} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500" /></label><label className="block text-sm font-semibold" htmlFor="confirm-password">Confirm new password<input id="confirm-password" type="password" required minLength={10} maxLength={72} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500" /></label><p className="text-xs leading-5 text-slate-500">10-72 characters with uppercase, lowercase, number, and special character.</p><button disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? "Saving..." : "Save new password"}</button></form></>}</div></main>;
}