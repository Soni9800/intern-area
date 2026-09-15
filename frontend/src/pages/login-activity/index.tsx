import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { selectuser } from "@/Feature/Userslice";
import { Monitor, MapPin, Globe, Clock, CheckCircle, XCircle, Filter, Download, LogOut } from "lucide-react";
import Link from "next/link";

interface LoginRecord {
  _id: string;
  loggedInAt: string;
  status: "success" | "failed";
  browser?: { name: string; version: string };
  operatingSystem?: { name: string; version: string };
  deviceType: string;
  deviceModel: string;
  ipAddress: string;
  location?: { country?: string; region?: string; city?: string };
}

interface FilterOptions {
  status: "all" | "success" | "failed";
  deviceType: "all" | string;
  dateRange: "all" | "today" | "week" | "month";
}

const LoginActivityPage = () => {
  const user = useSelector(selectuser);
  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<FilterOptions>({
    status: "all",
    deviceType: "all",
    dateRange: "all",
  });
  const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch login history
  const accountIdentifier = user?.id || user?.uid || user?.email;

  useEffect(() => {
    if (!accountIdentifier) return;

    const fetchLoginHistory = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/auth/login-history/${encodeURIComponent(accountIdentifier)}`
        );
        const responseText = await response.text();
        let data: { message?: string; history?: LoginRecord[] };
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          data = { message: `The API returned an unexpected response (${response.status}).` };
        }

        if (!response.ok) {
          throw new Error(data.message || "Failed to load login history");
        }

        setLoginHistory(data.history || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load login history");
        setLoginHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLoginHistory();
  }, [user?.id]);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...loginHistory];

    // Filter by status
    if (filters.status !== "all") {
      filtered = filtered.filter((record) => record.status === filters.status);
    }

    // Filter by device type
    if (filters.deviceType !== "all") {
      filtered = filtered.filter((record) => record.deviceType === filters.deviceType);
    }

    // Filter by date range
    if (filters.dateRange !== "all") {
      const now = new Date();
      const recordDate = new Date();

      filtered = filtered.filter((record) => {
        const loginDate = new Date(record.loggedInAt);

        switch (filters.dateRange) {
          case "today":
            return loginDate.toDateString() === now.toDateString();
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return loginDate >= weekAgo;
          case "month":
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return loginDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Sort
    if (sortBy === "oldest") {
      filtered.sort((a, b) => new Date(a.loggedInAt).getTime() - new Date(b.loggedInAt).getTime());
    } else {
      filtered.sort((a, b) => new Date(b.loggedInAt).getTime() - new Date(a.loggedInAt).getTime());
    }

    setFilteredHistory(filtered);
  }, [loginHistory, filters, sortBy]);

  const handleLogoutSession = async (sessionId: string) => {
    // TODO: Implement session logout from this page
    alert("Session logout feature coming soon");
  };

  const downloadCSV = () => {
    const headers = ["Date/Time", "Status", "Browser", "OS", "Device Type", "Device Model", "IP Address", "Location"];
    const rows = filteredHistory.map((record) => [
      new Date(record.loggedInAt).toLocaleString(),
      record.status,
      `${record.browser?.name || "Unknown"} ${record.browser?.version || ""}`,
      `${record.operatingSystem?.name || "Unknown"} ${record.operatingSystem?.version || ""}`,
      record.deviceType,
      record.deviceModel,
      record.ipAddress,
      [record.location?.city, record.location?.region, record.location?.country]
        .filter((v) => v && v !== "Unknown")
        .join(", ") || "Unknown",
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `login-history-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getUniqueDeviceTypes = () => {
    const types = new Set(loginHistory.map((r) => r.deviceType).filter(Boolean));
    return Array.from(types);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/profile" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4">
            ← Back to Profile
          </Link>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Monitor className="h-8 w-8 text-blue-600" />
                Login Activity
              </h1>
              <p className="mt-2 text-gray-600">
                Review all login attempts and connected devices to your account.
              </p>
            </div>
            <button
              onClick={downloadCSV}
              disabled={filteredHistory.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Logins</p>
                <p className="text-3xl font-bold text-gray-900">{loginHistory.length}</p>
              </div>
              <Globe className="h-12 w-12 text-blue-100" />
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Successful</p>
                <p className="text-3xl font-bold text-green-600">
                  {loginHistory.filter((r) => r.status === "success").length}
                </p>
              </div>
              <CheckCircle className="h-12 w-12 text-green-100" />
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Failed</p>
                <p className="text-3xl font-bold text-red-600">
                  {loginHistory.filter((r) => r.status === "failed").length}
                </p>
              </div>
              <XCircle className="h-12 w-12 text-red-100" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as FilterOptions["status"] })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Device Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Device Type</label>
              <select
                value={filters.deviceType}
                onChange={(e) => setFilters({ ...filters, deviceType: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All</option>
                {getUniqueDeviceTypes().map((type) => (
                  <option key={type} value={type}>
                    {type?.charAt(0).toUpperCase() + type?.slice(1) || "Unknown"}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as FilterOptions["dateRange"] })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "recent" | "oldest")}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="rounded-lg bg-white p-8 shadow text-center">
            <p className="text-gray-600">Loading login history...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 shadow mb-6">
            <p className="text-red-700 font-medium">Error: {error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredHistory.length === 0 && (
          <div className="rounded-lg bg-white p-12 shadow text-center">
            <Monitor className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-600 font-medium">No login activity found</p>
            <p className="text-gray-500 text-sm">Try adjusting your filters</p>
          </div>
        )}

        {/* Login History List */}
        {!loading && !error && filteredHistory.length > 0 && (
          <div className="space-y-4">
            {filteredHistory.map((record) => (
              <div key={record._id} className="rounded-lg bg-white shadow hover:shadow-md transition-shadow">
                {/* Summary Row */}
                <button
                  onClick={() => setExpandedId(expandedId === record._id ? null : record._id)}
                  className="w-full text-left p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 flex items-center gap-4">
                    {/* Status Icon */}
                    {record.status === "success" ? (
                      <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600 shrink-0" />
                    )}

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">
                        {record.browser?.name || "Unknown"} on {record.operatingSystem?.name || "Unknown"}
                      </p>
                      <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                        <Clock className="h-4 w-4" />
                        {new Date(record.loggedInAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Device Type Badge */}
                    <div className="shrink-0 flex items-center gap-3">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {record.deviceType}
                      </span>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        record.status === "success"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}>
                        {record.status}
                      </span>
                    </div>
                  </div>

                  {/* Expand Arrow */}
                  <div className={`ml-4 transition-transform ${expandedId === record._id ? "rotate-180" : ""}`}>
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedId === record._id && (
                  <div className="border-t border-gray-200 px-6 py-6 bg-gray-50">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {/* Browser Info */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Browser</h3>
                        <p className="text-sm text-gray-600">
                          {record.browser?.name || "Unknown"}
                          {record.browser?.version && ` v${record.browser.version}`}
                        </p>
                      </div>

                      {/* OS Info */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Operating System</h3>
                        <p className="text-sm text-gray-600">
                          {record.operatingSystem?.name || "Unknown"}
                          {record.operatingSystem?.version && ` ${record.operatingSystem.version}`}
                        </p>
                      </div>

                      {/* Device Model */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Device Model</h3>
                        <p className="text-sm text-gray-600">{record.deviceModel || "Unknown"}</p>
                      </div>

                      {/* IP Address */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">IP Address</h3>
                        <p className="text-sm text-gray-600 font-mono">{record.ipAddress || "Unknown"}</p>
                      </div>

                      {/* Location */}
                      <div className="sm:col-span-2">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Location
                        </h3>
                        <p className="text-sm text-gray-600">
                          {[record.location?.city, record.location?.region, record.location?.country]
                            .filter((v) => v && v !== "Unknown")
                            .join(", ") || "Unknown"}
                        </p>
                      </div>

                      {/* Timestamp */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Full Timestamp</h3>
                        <p className="text-sm text-gray-600 font-mono">{new Date(record.loggedInAt).toISOString()}</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 pt-6 border-t border-gray-300 flex gap-3">
                      <button
                        onClick={() => handleLogoutSession(record._id)}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout This Session
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Security Tips */}
        <div className="mt-8 rounded-lg bg-blue-50 p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">🔒 Security Tips</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• Regularly review this list to ensure all logins are authorized</li>
            <li>• If you see any unfamiliar devices or locations, immediately change your password</li>
            <li>• Be cautious of login attempts from unusual locations or times</li>
            <li>• Consider enabling two-factor authentication for additional security</li>
            <li>• Logout unused sessions to reduce security risks</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LoginActivityPage;
