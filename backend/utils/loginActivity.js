const LoginHistory = require("../Model/LoginHistory");

const firstHeader = (req, names) => names.map((name) => req.headers[name]).find(Boolean);
const parseUserAgent = (req) => {
  const userAgent = String(req.headers["user-agent"] || "");
  const browser = userAgent.match(/(Edg|OPR|Chrome|Firefox|Version|Safari|MSIE|Trident)\/?([\d.]+)/i);
  const operatingSystem = userAgent.match(/(Windows NT|Android|iPhone OS|iPad; CPU OS|Mac OS X|Linux)\s?([\d._-]*)/i);
  const isTablet = /ipad|tablet|android(?!.*mobile)/i.test(userAgent);
  const isMobile = /mobile|iphone|ipod|android/i.test(userAgent) && !isTablet;
  const deviceModel = userAgent.match(/(?:Android[^;]*;\s*(?:[a-z]{2}-[a-z]{2};\s*)?)([^;)]+)|\((iPhone[^;)]+|iPad[^;)]+)\)/i);
  return {
    browser: { name: browser ? ({ Edg: "Edge", OPR: "Opera", MSIE: "Internet Explorer", Trident: "Internet Explorer" }[browser[1]] || browser[1]) : "Unknown", version: browser?.[2] || "Unknown" },
    operatingSystem: { name: operatingSystem?.[1] || "Unknown", version: operatingSystem?.[2]?.replace(/_/g, ".") || "Unknown" },
    deviceType: isMobile ? "mobile" : isTablet ? "tablet" : /laptop/i.test(userAgent) ? "laptop" : "desktop",
    deviceModel: deviceModel?.[1]?.trim() || deviceModel?.[2]?.trim() || "Unknown",
  };
};

const recordLogin = async (req, accountId, status) => {
  try {
    await LoginHistory.create({
      accountId: accountId || null,
      ...parseUserAgent(req),
      ipAddress: String(req.ip || firstHeader(req, ["x-forwarded-for", "x-real-ip"]) || "unknown").split(",")[0].trim().slice(0, 128),
      location: {
        country: String(firstHeader(req, ["cf-ipcountry", "x-vercel-ip-country"]) || "Unknown").slice(0, 80),
        region: String(firstHeader(req, ["x-vercel-ip-country-region"]) || "Unknown").slice(0, 120),
        city: String(firstHeader(req, ["x-vercel-ip-city"]) || "Unknown").slice(0, 120),
      },
      status,
    });
  } catch (error) {
    console.error("Unable to record login activity:", error.message);
  }
};

module.exports = { recordLogin };