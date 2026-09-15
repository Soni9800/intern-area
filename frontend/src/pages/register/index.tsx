import Link from "next/link";
import { ArrowLeft, LockKeyhole, Mail, UserPlus } from "lucide-react";
import { signInWithPopup } from "firebase/auth";
import { FormEvent, useState } from "react";
import { toast } from "react-toastify";
import { auth, provider } from "@/firebase/firebase";

const navigate = (path: string) => {
  if (typeof window !== "undefined") {
    window.location.assign(path);
  }
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])\S{10,72}$/;

type Account = { id: string; email: string; mustChangePassword: boolean };

export default function Register() {
  const [signupEmail, setSignupEmail] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showChangePrompt, setShowChangePrompt] = useState(false);

  const saveAccount = (account: Account) => {
    localStorage.setItem("internareaAccount", JSON.stringify(account));
  };

  const accountRequest = async (path: string, body: Record<string, string>) => {
    const response = await fetch(`${apiBaseUrl}/api/auth/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to continue.");
    return data;
  };

  const signup = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordPattern.test(signupPassword)) {
      toast.error("Use 10-72 characters with uppercase, lowercase, number, and special character.");
      return;
    }
    setBusy(true);
    try {
      const data = await accountRequest("signup", { email: signupEmail, username: signupUsername, password: signupPassword });
      saveAccount(data.account); toast.success("Account created successfully."); navigate("/");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create account."); }
    finally { setBusy(false); }
  };

  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const data = await accountRequest("login", { email: loginEmail, password: loginPassword });
      saveAccount(data.account); toast.success("Logged in successfully.");
      if (data.account.mustChangePassword) setShowChangePrompt(true);
      else navigate("/");
    } catch (error) { toast.error(error instanceof Error ? error.message : "No user found with those credentials."); }
    finally { setBusy(false); }
  };

  const googleLogin = async () => {
    setBusy(true);
    try {
      let result;
      try {
        // Try popup authentication first
        result = await signInWithPopup(auth, provider);
      } catch (popupError: any) {
        // If popup fails, try redirect flow
        if (popupError?.code === "auth/popup-closed-by-user") {
          toast.info("Popup was closed. Trying alternative method...");
          // Fallback: Show message to user
          toast.warning("Please make sure popups are not blocked in your browser.");
          throw new Error("Popup was closed. Please allow popups and try again.");
        }
        throw popupError;
      }

      if (!result?.user?.email) {
        throw new Error("Unable to get email from Google account.");
      }

      const email = result.user.email;
      const response = await fetch(`${apiBaseUrl}/api/admin/resolve-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const responseText = await response.text();
      let data: { message?: string; isAdmin?: boolean; account?: Account } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(`The server returned an unexpected HTML response. Check that the backend is running and the API URL is correct. URL used: ${apiBaseUrl}/api/admin/resolve-email`);
      }

      if (!response.ok) throw new Error(data.message || "Unable to continue.");

      if (!data.isAdmin && data.account) saveAccount(data.account);
      toast.success("Logged in successfully.");
      navigate(data.isAdmin ? "/adminpanel" : "/");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Google sign-in failed.";
      toast.error(errorMessage);
      
      // Log error for debugging
      console.error("Google login error:", error);
    }
    finally {
      setBusy(false);
    }
  };

  const startPasswordRecovery = async () => {
    if (!loginEmail.trim()) {
      toast.error("Please enter your email first.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "email", identifier: loginEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Invalid email.");
      if (!data.requestId) throw new Error("Please enter a valid email.");
      toast.success("Verification code sent to your email.");
      navigate(`/forgot-password?requestId=${encodeURIComponent(data.requestId)}&method=email&identifier=${encodeURIComponent(loginEmail)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-[#f4f7fb] px-4 py-12 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow-xl sm:p-10">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"><ArrowLeft size={16} /> Back to home</Link>
        <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Welcome to InternArea</p><h1 className="mt-2 text-3xl font-black">Your next opportunity starts here</h1></div>
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3"><UserPlus className="text-blue-600" /><div><h2 className="text-2xl font-bold">Create account</h2><p className="text-sm text-slate-500">New to InternArea?</p></div></div>
            <form onSubmit={signup} className="space-y-4">
              <label htmlFor="signup-username" className="block text-sm font-semibold">Username<input id="signup-username" type="text" required value={signupUsername} onChange={(event) => setSignupUsername(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500" placeholder="your_username" /></label>
              <label htmlFor="signup-email" className="block text-sm font-semibold">Email address<input id="signup-email" type="email" required value={signupEmail} onChange={(event) => setSignupEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500" placeholder="you@example.com" /></label>
              <label htmlFor="signup-password" className="block text-sm font-semibold">Password<input id="signup-password" type="password" required value={signupPassword} onChange={(event) => setSignupPassword(event.target.value)} minLength={10} maxLength={72} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500" placeholder="Create a strong password" /></label>
              <p className="text-xs leading-5 text-slate-500">10-72 characters with uppercase, lowercase, number, and special character.</p>
              <button disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? "Creating..." : "Create account"}</button>
            </form>
          </section>
          <section className="rounded-xl border border-slate-200 p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3"><LockKeyhole className="text-blue-600" /><div><h2 className="text-2xl font-bold">Log in</h2><p className="text-sm text-slate-500">Already have an account?</p></div></div>
            <form onSubmit={login} className="space-y-4">
              <label htmlFor="login-email" className="block text-sm font-semibold">Email address<input id="login-email" type="email" required value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500" placeholder="you@example.com" /></label>
              <label htmlFor="login-password" className="block text-sm font-semibold">Password<input id="login-password" type="password" required value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500" placeholder="Enter your password" /></label>
              <button disabled={busy} className="w-full rounded-lg bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-50">{busy ? "Logging in..." : "Log in"}</button>
            </form>
            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" /></div>
            <button type="button" disabled={busy} onClick={googleLogin} className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Mail size={18} className="text-blue-600" /> Continue with Google</button>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={startPasswordRecovery} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-600 hover:text-blue-600"><LockKeyhole size={15} /> Forgot password?</button><Link href="/adminlogin" className="flex items-center justify-center rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-600 hover:text-blue-600">Admin login</Link></div>
          </section>
        </div>
      </div>
      {showChangePrompt && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"><div className="w-full max-w-md rounded-xl bg-white p-7 shadow-2xl"><LockKeyhole size={38} className="text-blue-600" /><h2 className="mt-4 text-2xl font-bold">Change your password now</h2><p className="mt-2 text-sm text-slate-500">For your security, this temporary password should be replaced soon.</p><button type="button" onClick={() => navigate("/change-password")} className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700">Change password</button><button type="button" onClick={() => { setShowChangePrompt(false); navigate("/"); }} className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-600 hover:bg-slate-50">I&apos;ll do it later</button></div></div>}
    </main>
  );
}
