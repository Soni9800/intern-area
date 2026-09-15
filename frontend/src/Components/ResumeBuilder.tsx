import { CheckCircle2, Download, FileText, LockKeyhole, Palette, Plus, ShieldCheck, Sparkles, Trash2, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const sections = ["education", "skills", "experience", "internships", "projects", "certifications", "achievements", "languages", "socialLinks", "references"] as const;
type Section = typeof sections[number];
type Content = { fullName: string; email: string; phone: string; objective: string; profilePhoto: string } & Record<Section, string>;
type Resume = { _id: string; title: string; template: string; color: string; font: string; isDefault: boolean; createdAt: string };
const initialContent: Content = { fullName: "", email: "", phone: "", objective: "", profilePhoto: "", education: "", skills: "", experience: "", internships: "", projects: "", certifications: "", achievements: "", languages: "", socialLinks: "", references: "" };
const labels: Record<string, string> = { fullName: "Full name", email: "Email", phone: "Phone", objective: "Career objective", education: "Education", skills: "Skills", experience: "Work experience", internships: "Internships", projects: "Projects", certifications: "Certifications", achievements: "Achievements", languages: "Languages", socialLinks: "Social links", references: "References" };

const callApi = async (path: string, body?: unknown, method = "POST") => {
  const response = await fetch(`${apiBase}/api/resume/${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Resume request failed.");
  return data;
};

const ResumeBuilder = ({ user }: { user: any }) => {
  const [content, setContent] = useState<Content>({ ...initialContent, fullName: user?.name || "", email: user?.email || "" });
  const [template, setTemplate] = useState("classic");
  const [color, setColor] = useState("#2563eb");
  const [font, setFont] = useState("Arial");
  const [otp, setOtp] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Resume[]>([]);
  const [membership, setMembership] = useState(Boolean(user?.isPremium ?? user?.premium ?? false));
  const [membershipOtpSent, setMembershipOtpSent] = useState(false);
  const [membershipOtp, setMembershipOtp] = useState("");
  const [membershipVerificationToken, setMembershipVerificationToken] = useState("");

  const userId = user?.uid || user?.email;
  const isPremium = membership;
  const refreshHistory = async () => { if (!userId) return; try { const data = await callApi(`history/${encodeURIComponent(userId)}`, undefined, "GET"); setHistory(data.resumes || []); } catch { /* The builder remains usable while the API is offline. */ } };
  useEffect(() => { refreshHistory(); }, [userId]);
  useEffect(() => { if (!userId) return; callApi(`membership/${encodeURIComponent(userId)}`, undefined, "GET").then((data) => setMembership(Boolean(data.isPremium))).catch(() => undefined); }, [userId]);
  useEffect(() => { const selected = new URLSearchParams(window.location.search).get("template"); if (selected && ["classic", "modern", "minimal"].includes(selected)) setTemplate(selected); }, []);

  const update = (key: keyof Content, value: string) => setContent((current) => ({ ...current, [key]: value }));
  const uploadPhoto = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => update("profilePhoto", String(reader.result)); reader.readAsDataURL(file); };
  const identity = { userId, email: user?.email, isPremium };
  const sendOtp = async () => { try { setBusy(true); await callApi("request-otp", identity); setOtpSent(true); toast.success("OTP sent to your registered email."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to send OTP."); } finally { setBusy(false); } };
  const verifyOtp = async () => { try { setBusy(true); const data = await callApi("verify-otp", { ...identity, otp }); setVerificationToken(data.verificationToken); toast.success("Identity verified. Payment is now enabled."); } catch (error) { toast.error(error instanceof Error ? error.message : "Invalid or expired OTP."); } finally { setBusy(false); } };
  const payAndGenerate = async () => {
    if (!verificationToken) return toast.error("Verify the OTP before payment.");
    try {
      setBusy(true);
      const orderData = await callApi("create-order", { ...identity, verificationToken, content, template, color, font });
      await new Promise<void>((resolve, reject) => { const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Payment gateway could not be loaded.")); document.body.appendChild(script); });
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) throw new Error("Payment gateway could not be loaded.");
      new Razorpay({ key: orderData.keyId, amount: orderData.order.amount, currency: "INR", name: "InternArea", description: "Premium resume generation", order_id: orderData.order.id, handler: async (payment: any) => { try { await callApi("verify-payment", { ...identity, verificationToken, ...payment, content, template, color, font }); setContent({ ...initialContent }); toast.success("Resume generated and set as your default."); setVerificationToken(""); setOtpSent(false); setOtp(""); await refreshHistory(); } catch (error) { toast.error(error instanceof Error ? error.message : "Payment verification failed."); } finally { setBusy(false); } }, modal: { ondismiss: () => { setBusy(false); toast.info("Payment cancelled. Your resume was not generated."); } } }).open();
    } catch (error) { setBusy(false); toast.error(error instanceof Error ? error.message : "Unable to start payment."); }
  };
  const setDefault = async (id: string) => { try { await callApi(`${id}/default`, { userId }, "PATCH"); await refreshHistory(); toast.success("Default resume updated."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update default resume."); } };
  const download = (id: string) => { window.open(`${apiBase}/api/resume/download/${id}`, "_blank"); };
  const remove = async (id: string) => { if (!window.confirm("Delete this resume?")) return; try { await callApi(id, { userId }, "DELETE"); await refreshHistory(); toast.success("Resume deleted."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete resume."); } };
  const requestMembershipOtp = async () => { try { setBusy(true); await callApi("request-otp", { userId, email: user?.email }); setMembershipOtpSent(true); toast.success("OTP sent to your registered email."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to send OTP."); } finally { setBusy(false); } };
  const startMembershipPayment = async (verificationToken: string) => {
    try {
      setBusy(true);
      const orderData = await callApi("membership-order", { userId, email: user?.email, verificationToken });
      await new Promise<void>((resolve, reject) => { const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Payment gateway could not be loaded.")); document.body.appendChild(script); });
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) throw new Error("Payment gateway could not be loaded.");
      new Razorpay({ key: orderData.keyId, amount: orderData.order.amount, currency: "INR", name: "InternArea", description: "Premium Resume Builder membership", order_id: orderData.order.id, handler: async (payment: any) => { try { await callApi("membership-payment", { userId, email: user?.email, verificationToken, ...payment }); setMembership(true); setMembershipVerificationToken(""); setMembershipOtpSent(false); setMembershipOtp(""); toast.success("Premium membership activated. Resume Builder unlocked."); } catch (error) { toast.error(error instanceof Error ? error.message : "Membership payment verification failed."); } finally { setBusy(false); } }, modal: { ondismiss: () => { setBusy(false); toast.info("Payment cancelled. Premium features remain locked."); } } }).open();
    } catch (error) { setBusy(false); toast.error(error instanceof Error ? error.message : "Unable to start membership payment."); }
  };
  const buyMembership = async () => {
    if (!membershipVerificationToken) {
      await requestMembershipOtp();
      const enteredOtp = window.prompt("Enter the OTP sent to your registered email:") || "";
      if (!enteredOtp) return;
      try { setBusy(true); const data = await callApi("verify-otp", { userId, email: user?.email, otp: enteredOtp }); setMembershipVerificationToken(data.verificationToken); await startMembershipPayment(data.verificationToken); } catch (error) { toast.error(error instanceof Error ? error.message : "Invalid or expired OTP."); } finally { setBusy(false); }
      return;
    }
    await startMembershipPayment(membershipVerificationToken);
  };

  if (!user) return <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><LockKeyhole className="mx-auto mb-3 text-slate-400" /><h2 className="text-xl font-semibold text-slate-900">Sign in to build your resume</h2></section>;
  if (!isPremium) return <section className="relative mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm"><div className="pointer-events-none h-64 select-none overflow-hidden opacity-35 blur-[1px]"><div className="grid h-full gap-5 p-6 md:grid-cols-2"><div className="space-y-3 rounded-2xl bg-white p-6"><div className="h-5 w-2/3 rounded bg-slate-300" /><div className="h-3 w-1/2 rounded bg-slate-200" />{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-10 rounded border border-slate-200 bg-slate-50" />)}</div><div className="rounded-2xl bg-white p-6"><div className="h-6 w-1/2 rounded bg-blue-200" /><div className="my-5 h-px bg-slate-200" />{[1, 2, 3, 4, 5].map((item) => <div key={item} className="mb-4 h-3 rounded bg-slate-200" />)}</div></div></div><div className="absolute inset-0 flex items-center justify-center bg-slate-950/10 p-6"><div className="max-w-lg rounded-2xl border border-white/60 bg-white/95 p-7 text-center shadow-xl backdrop-blur-sm"><Sparkles className="mx-auto mb-3 text-amber-500" size={28} /><h2 className="text-2xl font-bold text-slate-950">Premium Resume Builder</h2><p className="mt-2 text-sm leading-6 text-slate-600">Unlock ATS-friendly templates, professional previews, PDF downloads, and multiple resume versions.</p><button disabled={busy} onClick={buyMembership} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">Get a premium membership to build a ATS friendly resume · ₹50</button></div></div></section>;
  return <section className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 bg-slate-950 px-6 py-7 text-white md:px-8"><div className="flex items-start justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><Sparkles size={14} /> Premium workspace</p><h2 className="text-2xl font-bold">Resume Builder</h2><p className="mt-2 max-w-2xl text-sm text-slate-300">Build a polished, ATS-friendly resume. ₹50 is charged only after email verification for each generated version.</p></div><ShieldCheck className="hidden text-cyan-300 sm:block" size={28} /></div></div>
    <div className="grid gap-8 p-6 md:p-8 xl:grid-cols-[1.1fr_.9fr]">
      <div className="space-y-6">
        <div><h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><FileText size={18} className="text-blue-600" /> Your details</h3><div className="grid gap-3 sm:grid-cols-2">{(["fullName", "email", "phone"] as const).map((key) => <input key={key} value={content[key]} onChange={(event) => update(key, event.target.value)} placeholder={labels[key]} className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500" />)}</div><div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3"><label htmlFor="resume-profile-image" className="cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Enter your image</label><input id="resume-profile-image" type="file" accept="image/png,image/jpeg" onChange={uploadPhoto} className="sr-only" />{content.profilePhoto && <img src={content.profilePhoto} alt="Profile preview" className="h-12 w-12 rounded-full object-cover" />}</div><textarea value={content.objective} onChange={(event) => update("objective", event.target.value)} placeholder="Career objective" rows={3} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500" /></div>
        <div><h3 className="mb-3 font-semibold text-slate-900">Experience and credentials</h3><div className="grid gap-3 sm:grid-cols-2">{sections.map((key) => <textarea key={key} value={content[key]} onChange={(event) => update(key, event.target.value)} placeholder={labels[key]} rows={3} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500" />)}</div></div>
        <div><div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold text-slate-900"><Palette size={18} className="text-blue-600" /> Style</h3><Link href="/resume-templates" className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><LayoutTemplate size={15} /> Browse templates</Link></div><div className="flex flex-wrap gap-2">{["classic", "modern", "minimal"].map((item) => <button key={item} onClick={() => setTemplate(item)} className={`rounded-lg border px-4 py-2 text-sm capitalize ${template === item ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>{item}</button>)}<label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">Color <input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label><select value={font} onChange={(event) => setFont(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"><option>Arial</option><option>Georgia</option><option>Trebuchet MS</option></select></div></div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><div className="mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-blue-600" /><h3 className="font-semibold text-slate-900">Verify before payment</h3></div><p className="mb-4 text-sm text-slate-600">We will send a 6-digit OTP to <strong>{user.email}</strong>. Razorpay stays locked until it is verified.</p>{otpSent && <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Enter OTP" inputMode="numeric" className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />}<div className="flex flex-wrap gap-3"><button disabled={busy} onClick={sendOtp} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{otpSent ? "Resend OTP" : "Send OTP"}</button>{otpSent && <button disabled={busy || otp.length !== 6} onClick={verifyOtp} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Verify OTP</button>}<button disabled={busy || !verificationToken} onClick={payAndGenerate} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Pay ₹50 & generate</button></div>{verificationToken && <p className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700"><CheckCircle2 size={14} /> Verified. Payment enabled for 10 minutes.</p>}</div>
      </div>
      <div className="space-y-6"><div className={`min-h-130 rounded-xl border border-slate-200 bg-white p-7 text-slate-800 shadow-inner ${template === "modern" ? "border-t-8" : ""}`} style={{ borderTopColor: color, fontFamily: font }}>{content.profilePhoto && <img src={content.profilePhoto} alt="Profile preview" className="mb-3 h-16 w-16 rounded-full object-cover" />}<h3 className="text-2xl font-bold" style={{ color }}>{content.fullName || "Your name"}</h3><p className="mt-1 text-xs text-slate-500">{content.email || "email@example.com"} {content.phone && `| ${content.phone}`}</p><div className="my-5 h-px bg-slate-200" /><h4 className="text-xs font-bold uppercase tracking-widest" style={{ color }}>Career objective</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{content.objective || "Your objective will appear here."}</p>{sections.map((key) => content[key] && <div key={key} className="mt-5"><h4 className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{labels[key]}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{content[key]}</p></div>)}</div>
        <div><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-slate-900">Resume history</h3><span className="text-xs text-slate-500">{history.length} version{history.length === 1 ? "" : "s"}</span></div>{history.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500"><Plus className="mx-auto mb-2" size={18} />Your generated versions will appear here.</div> : <div className="space-y-2">{history.map((resume) => <div key={resume._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="text-sm font-semibold text-slate-800">{resume.title}</p><p className="text-xs text-slate-500">{new Date(resume.createdAt).toLocaleDateString()} · {resume.template} {resume.isDefault && "· Default"}</p></div><div className="flex gap-2"><button title="Download PDF" onClick={() => download(resume._id)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Download size={16} /></button><button title="Delete resume" onClick={() => remove(resume._id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>{!resume.isDefault && <button onClick={() => setDefault(resume._id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Set default</button>}</div></div>)}</div>}</div></div>
    </div>
  </section>;
};
export default ResumeBuilder;