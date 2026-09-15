const crypto = require("crypto");

const firstHeader = (req, names) => names.map((name) => req.headers[name]).find(Boolean);

/**
 * Parse user agent to extract browser, OS, device info
 * @param {Object} req - Express request object
 * @returns {Object} - Parsed user agent data
 */
const parseUserAgent = (req) => {
  const userAgent = String(req.headers["user-agent"] || "");
  const browser = userAgent.match(/(Edg|OPR|Chrome|Firefox|Version|Safari|MSIE|Trident)\/?([\d.]+)/i);
  const operatingSystem = userAgent.match(/(Windows NT|Android|iPhone OS|iPad; CPU OS|Mac OS X|Linux)\s?([\d._-]*)/i);
  const isTablet = /ipad|tablet|android(?!.*mobile)/i.test(userAgent);
  const isMobile = /mobile|iphone|ipod|android/i.test(userAgent) && !isTablet;
  const deviceModel = userAgent.match(/(?:Android[^;]*;\s*(?:[a-z]{2}-[a-z]{2};\s*)?)([^;)]+)|\((iPhone[^;)]+|iPad[^;)]+)\)/i);

  return {
    browser: { 
      name: browser ? ({ Edg: "Edge", OPR: "Opera", MSIE: "Internet Explorer", Trident: "Internet Explorer" }[browser[1]] || browser[1]) : "Unknown", 
      version: browser?.[2] || "Unknown" 
    },
    operatingSystem: { 
      name: operatingSystem?.[1] || "Unknown", 
      version: operatingSystem?.[2]?.replace(/_/g, ".") || "Unknown" 
    },
    deviceType: isMobile ? "mobile" : isTablet ? "tablet" : /laptop/i.test(userAgent) ? "laptop" : "desktop",
    deviceModel: deviceModel?.[1]?.trim() || deviceModel?.[2]?.trim() || "Unknown",
  };
};

/**
 * Get IP address from request
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
const getClientIP = (req) => {
  return String(req.ip || firstHeader(req, ["x-forwarded-for", "x-real-ip"]) || "unknown")
    .split(",")[0]
    .trim()
    .slice(0, 128);
};

/**
 * Get location info from request headers
 * @param {Object} req - Express request object
 * @returns {Object} - Location data
 */
const getLocationInfo = (req) => {
  return {
    country: String(firstHeader(req, ["cf-ipcountry", "x-vercel-ip-country"]) || "Unknown").slice(0, 80),
    region: String(firstHeader(req, ["x-vercel-ip-country-region"]) || "Unknown").slice(0, 120),
    city: String(firstHeader(req, ["x-vercel-ip-city"]) || "Unknown").slice(0, 120),
  };
};

/**
 * Create device fingerprint from request data
 * Creates a unique hash based on browser, OS, device model, and user agent
 * @param {Object} req - Express request object
 * @returns {string} - Device fingerprint hash
 */
const generateDeviceFingerprint = (req) => {
  const userAgent = String(req.headers["user-agent"] || "");
  const acceptLanguage = String(req.headers["accept-language"] || "");
  const acceptEncoding = String(req.headers["accept-encoding"] || "");
  
  // Create fingerprint from multiple factors
  const fingerprintData = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
  
  return crypto
    .createHash("sha256")
    .update(fingerprintData)
    .digest("hex")
    .slice(0, 32); // Take first 32 chars for readability
};

/**
 * Get comprehensive device info from request
 * @param {Object} req - Express request object
 * @returns {Object} - Complete device information
 */
const getDeviceInfo = (req) => {
  const userAgentInfo = parseUserAgent(req);
  const ipAddress = getClientIP(req);
  const location = getLocationInfo(req);
  const deviceFingerprint = generateDeviceFingerprint(req);

  return {
    deviceFingerprint,
    browser: userAgentInfo.browser,
    operatingSystem: userAgentInfo.operatingSystem,
    deviceType: userAgentInfo.deviceType,
    deviceModel: userAgentInfo.deviceModel,
    ipAddress,
    location,
  };
};

/**
 * Check if device info indicates a significant change
 * (e.g., different IP, VPN, browser, OS)
 * @param {Object} newDeviceInfo - Current device info
 * @param {Object} oldDeviceInfo - Previous device info
 * @returns {Object} - Changes detected
 */
const detectDeviceChanges = (newDeviceInfo, oldDeviceInfo) => {
  const changes = {
    ipChanged: newDeviceInfo.ipAddress !== oldDeviceInfo.ipAddress,
    locationChanged: newDeviceInfo.location.country !== oldDeviceInfo.location.country || 
                     newDeviceInfo.location.city !== oldDeviceInfo.location.city,
    browserChanged: newDeviceInfo.browser.name !== oldDeviceInfo.browser.name,
    osChanged: newDeviceInfo.operatingSystem.name !== oldDeviceInfo.operatingSystem.name,
    fingerPrintChanged: newDeviceInfo.deviceFingerprint !== oldDeviceInfo.deviceFingerprint,
  };

  changes.isSignificantChange = Object.values(changes).some(val => val === true);
  return changes;
};

/**
 * Check if two devices are likely the same
 * Allows for minor variations but flags significant changes
 * @param {Object} device1 - First device info
 * @param {Object} device2 - Second device info
 * @returns {boolean} - True if devices are considered same
 */
const isSameDevice = (device1, device2) => {
  // Fingerprint mismatch = different device
  if (device1.deviceFingerprint !== device2.deviceFingerprint) {
    return false;
  }

  // Browser and OS must match
  if (device1.browser.name !== device2.browser.name || 
      device1.operatingSystem.name !== device2.operatingSystem.name) {
    return false;
  }

  // Same device if fingerprint, browser, and OS match
  return true;
};

module.exports = {
  parseUserAgent,
  getClientIP,
  getLocationInfo,
  generateDeviceFingerprint,
  getDeviceInfo,
  detectDeviceChanges,
  isSameDevice,
};
