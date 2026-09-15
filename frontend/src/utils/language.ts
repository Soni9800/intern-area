export type LanguageCode = "en" | "es" | "hi" | "pt" | "zh" | "fr";

export const languageOptions: { value: LanguageCode; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "hi", label: "हिन्दी" },
  { value: "pt", label: "Português" },
  { value: "zh", label: "中文" },
  { value: "fr", label: "Français" },
];

export const languageLabels: Record<LanguageCode, string> = {
  en: "English",
  es: "Español",
  hi: "हिन्दी",
  pt: "Português",
  zh: "中文",
  fr: "Français",
};

export const navTranslations: Record<LanguageCode, Record<string, string>> = {
  en: {
    internships: "Internships",
    jobs: "Jobs",
    search: "Search opportunities...",
    admin: "Admin",
    login: "Continue with google",
    logout: "Logout",
    language: "Language",
  },
  es: {
    internships: "Prácticas",
    jobs: "Trabajos",
    search: "Buscar oportunidades...",
    admin: "Administración",
    login: "Continuar con Google",
    logout: "Cerrar sesión",
    language: "Idioma",
  },
  hi: {
    internships: "इंटर्नशिप",
    jobs: "नौकरियाँ",
    search: "अवसर खोजें...",
    admin: "एडमिन",
    login: "Google से जारी रखें",
    logout: "लॉग आउट",
    language: "भाषा",
  },
  pt: {
    internships: "Estágios",
    jobs: "Vagas",
    search: "Pesquisar oportunidades...",
    admin: "Admin",
    login: "Continuar com o Google",
    logout: "Sair",
    language: "Idioma",
  },
  zh: {
    internships: "实习",
    jobs: "职位",
    search: "搜索机会...",
    admin: "管理员",
    login: "继续使用 Google",
    logout: "退出",
    language: "语言",
  },
  fr: {
    internships: "Stages",
    jobs: "Offres d'emploi",
    search: "Rechercher des opportunités...",
    admin: "Admin",
    login: "Continuer avec Google",
    logout: "Se déconnecter",
    language: "Langue",
  },
};

export const getStoredLanguage = (): LanguageCode => {
  if (typeof window === "undefined") return "en";

  const saved = localStorage.getItem("preferredLanguage") as LanguageCode | null;
  if (saved && languageOptions.some((item) => item.value === saved)) {
    return saved;
  }

  return "en";
};

export const persistLanguagePreference = (language: LanguageCode) => {
  if (typeof window === "undefined") return;

  localStorage.setItem("preferredLanguage", language);
  document.documentElement.lang = language;

  const history = JSON.parse(localStorage.getItem("languageHistory") || "[]");
  const entry = {
    language,
    timestamp: new Date().toISOString(),
    browser: navigator.userAgent || "Unknown browser",
    device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? "Mobile" : "Desktop",
    ip: "unknown",
  };

  localStorage.setItem("languageHistory", JSON.stringify([entry, ...history].slice(0, 20)));
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const sendLanguageOtp = async (email: string, language: LanguageCode) => {
  const response = await fetch(`${apiBaseUrl}/api/language/request-language-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, language }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to send OTP.");
  return data;
};

export const verifyLanguageOtp = async (email: string, enteredOtp: string) => {
  const response = await fetch(`${apiBaseUrl}/api/language/verify-language-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp: enteredOtp }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Invalid or expired OTP.");
  return Boolean(data.success);
};
