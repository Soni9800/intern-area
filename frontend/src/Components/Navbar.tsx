import React, { useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "../firebase/firebase";
import { Menu, Search, X } from "lucide-react";
import { signOut } from "firebase/auth";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { selectuser } from "@/Feature/Userslice";
import {
  getStoredLanguage,
  languageLabels,
  languageOptions,
  navTranslations,
  persistLanguagePreference,
  sendLanguageOtp,
  verifyLanguageOtp,
  type LanguageCode,
} from "@/utils/language";

const Navbar = () => {
  const user = useSelector(selectuser);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<LanguageCode | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const saved = getStoredLanguage();
    setLanguage(saved);
    document.documentElement.lang = saved;
  }, []);

  const handlelogout = () => {
    signOut(auth);
    localStorage.removeItem("internareaAccount");
    window.location.href = "/";
  };

  const applyLanguage = async (nextLanguage: LanguageCode) => {
    if (!user?.email) {
      setShowLoginPrompt(true);
      setShowLanguageMenu(false);
      return;
    }

    setPendingLanguage(nextLanguage);
    setOtpStep(true);
    setShowLanguageMenu(false);
    setOtpError("");
    setOtpSending(true);

    try {
      await sendLanguageOtp(user.email, nextLanguage);
      toast.info("OTP sent to your registered email. Enter it to change language.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send OTP.";
      setOtpError(message);
      toast.error(message);
    } finally {
      setOtpSending(false);
    }
  };

  const confirmFrenchOtp = async () => {
    if (!user?.email || !pendingLanguage) return;

    try {
      await verifyLanguageOtp(user.email, otpCode);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid or expired OTP.");
      return;
    }

    setLanguage(pendingLanguage);
    persistLanguagePreference(pendingLanguage);
    setOtpStep(false);
    setOtpCode("");
    setPendingLanguage(null);
    setOtpError("");
    toast.success(`Language changed to ${languageLabels[pendingLanguage]}.`);
  };

  const t = navTranslations[language] || navTranslations.en;

  return (
    <div className="relative z-20">
      <nav className="site-navbar relative z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3 lg:h-18">
            <div className="flex h-10 w-24 shrink-0 items-center sm:w-28">
              <a href="/" className="flex h-full w-full items-center overflow-hidden text-xl font-bold text-blue-600">
                <img src={"/logo.png"} alt="InternArea home" className="h-full w-full object-contain object-left" />
              </a>
            </div>

            <div className="hidden min-w-0 flex-1 items-center justify-center gap-5 lg:flex xl:gap-8">
              <Link href="/internship" className="shrink-0 text-sm font-medium text-slate-700 hover:text-blue-600">
                {t.internships}
              </Link>
              <Link href="/job" className="shrink-0 text-sm font-medium text-slate-700 hover:text-blue-600">
                {t.jobs}
              </Link>

              <div className="flex min-w-0 max-w-xs flex-1 items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                <Search size={16} className="text-slate-400" />
                <input
                  type="text"
                  placeholder={t.search}
                  className="ml-2 min-w-0 w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="hidden shrink-0 items-center gap-2 lg:flex xl:gap-3">
              {user && (
                <Link href="/public-space" className="text-sm font-medium text-slate-700 hover:text-blue-600">
                  Public Space
                </Link>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLanguageMenu((prev) => !prev)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                >
                  {t.language}: {languageLabels[language]}
                </button>

                {showLanguageMenu && (
                  <div className="absolute right-0 top-12 z-30 w-44 rounded-md border border-slate-200 bg-white shadow-lg">
                    {languageOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applyLanguage(option.value)}
                        className={`block w-full px-3 py-2 text-left text-sm ${
                          language === option.value ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {user ? (
                <div className="flex items-center gap-2">
                  <Link href="/profile" className="flex items-center rounded-full border border-slate-200 p-1 hover:border-blue-200">
                    <img src={user.photo} alt="Profile" className="h-8 w-8 rounded-full" />
                  </Link>
                  <button
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    onClick={handlelogout}
                  >
                    {t.logout}
                  </button>
                </div>
              ) : (
                <Link href="/register" className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
                  Login / Signup
                </Link>
              )}
            </div>

            <button
              type="button"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-700 lg:hidden"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4">
              <Link href="/internship" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => setMobileMenuOpen(false)}>
                {t.internships}
              </Link>
              <Link href="/job" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => setMobileMenuOpen(false)}>
                {t.jobs}
              </Link>
              {user && (
                <Link href="/public-space" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => setMobileMenuOpen(false)}>
                  Public Space
                </Link>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLanguageMenu((prev) => !prev)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700"
                >
                  {t.language}: {languageLabels[language]}
                </button>

                {showLanguageMenu && (
                  <div className="mt-2 rounded-md border border-slate-200 bg-white shadow-md">
                    {languageOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applyLanguage(option.value)}
                        className={`block w-full px-3 py-2 text-left text-sm ${
                          language === option.value ? "bg-blue-50 text-blue-700" : "text-slate-700"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {user ? (
                <div className="flex flex-col gap-2 pt-1">
                  <Link href="/profile" className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700" onClick={() => setMobileMenuOpen(false)}>
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handlelogout();
                    }}
                    className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {t.logout}
                  </button>
                </div>
              ) : (
                <Link href="/register" className="rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white" onClick={() => setMobileMenuOpen(false)}>
                  Login / Signup
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {otpStep && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-2">Verify language change</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the one-time password sent to your registered email to enable {pendingLanguage ? languageLabels[pendingLanguage] : "this language"}.
            </p>
            {otpSending && (
              <p className="text-sm text-blue-600 mb-3">Sending OTP...</p>
            )}
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Enter OTP"
              className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 text-black"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setOtpStep(false);
                  setOtpCode("");
                  setPendingLanguage(null);
                  setOtpError("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmFrenchOtp}
                className="px-4 py-2 bg-blue-600 text-white rounded-md"
              >
                Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoginPrompt && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold mb-2 text-gray-900">Login required</h3>
            <p className="text-sm text-gray-600 mb-5">
              Please sign in first. An OTP will be sent to your registered email when you choose a language.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLoginPrompt(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLoginPrompt(false);
                  window.location.href = "/register";
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md"
              >
                Go to register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar;
