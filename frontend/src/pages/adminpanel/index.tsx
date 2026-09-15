import axios from "axios";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

const navigate = (path: string) => {
  if (typeof window !== "undefined") {
    window.location.href = path;
  }
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const isAdminAuthenticated = () => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("isAdminLoggedIn") === "true";
};

const index = () => {
  const [internships, setInternships] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const authorized = isAdminAuthenticated();

    if (!authorized) {
      toast.error("Please login to access the admin panel.");
      navigate("/adminlogin");
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    setIsAuthorized(true);

    const fetchDashboardData = async () => {
      try {
        const [internshipsRes, jobsRes, applicationsRes] = await Promise.all([
          axios.get(`${apiBaseUrl}/api/internship`),
          axios.get(`${apiBaseUrl}/api/job`),
          axios.get(`${apiBaseUrl}/api/application`),
        ]);

        setInternships(internshipsRes.data || []);
        setJobs(jobsRes.data || []);
        setApplications(applicationsRes.data || []);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleAdminLogout = () => {
    localStorage.removeItem("isAdminLoggedIn");
    localStorage.removeItem("adminUsername");
    toast.success("Logged out successfully");
    navigate("/adminlogin");
  };

  const handleDeleteListing = async (type: "internship" | "job", id: string) => {
    const label = type === "internship" ? "internship" : "job";
    if (!window.confirm(`Delete this ${label}?`)) return;

    try {
      await axios.delete(`${apiBaseUrl}/api/${type}/${id}`);
      if (type === "internship") {
        setInternships((current) => current.filter((item) => item._id !== id));
      } else {
        setJobs((current) => current.filter((item) => item._id !== id));
      }
      toast.success(`${label[0].toUpperCase() + label.slice(1)} deleted successfully.`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to delete ${label}.`);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        Checking admin access...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">
              Admin Dashboard
            </p>
            <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
          </div>
          <button
            onClick={handleAdminLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-500">Total Internships</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">{internships.length}</h2>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-500">Total Jobs</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">{jobs.length}</h2>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-500">Total Applications</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">{applications.length}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                href="/postinternship"
                className="block w-full text-center bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700"
              >
                Post New Internship
              </Link>
              <Link
                href="/postjob"
                className="block w-full text-center bg-gray-900 text-white px-4 py-3 rounded-md hover:bg-gray-800"
              >
                Post New Job
              </Link>
              <Link
                href="/applications"
                className="block w-full text-center border border-gray-300 text-gray-700 px-4 py-3 rounded-md hover:bg-gray-50"
              >
                Review Applications
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : (
              <ul className="space-y-3 text-sm text-gray-600">
                <li>Internships available: {internships.length}</li>
                <li>Jobs available: {jobs.length}</li>
                <li>Applications received: {applications.length}</li>
                <li>Admin login status: Active</li>
              </ul>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-bold text-gray-900">Latest Listings</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Internships</h3>
              <div className="space-y-3">
                {internships.map((item: any) => (
                  <div key={item._id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-500">{item.company}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteListing("internship", item._id)}
                      className="shrink-0 rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {!internships.length && <p className="text-sm text-gray-500">No internships posted yet.</p>}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Jobs</h3>
              <div className="space-y-3">
                {jobs.map((item: any) => (
                  <div key={item._id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-500">{item.company}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteListing("job", item._id)}
                      className="shrink-0 rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {!jobs.length && <p className="text-sm text-gray-500">No jobs posted yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default index;