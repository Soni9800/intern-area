import { selectuser } from "@/Feature/Userslice";
import axios from "axios";
import {
  ArrowUpRight,
  Calendar,
  Clock,
  DollarSign,
  ExternalLink,
  MapPin,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const getRouteId = () => {
  if (typeof window === "undefined") return undefined;
  const segments = window.location.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1];
};

const PLAN_DETAILS = [
  { id: "free", name: "Free", price: 0, limit: 1, description: "1 internship application per month" },
  { id: "bronze", name: "Bronze", price: 100, limit: 3, description: "₹100/month – up to 3 applications" },
  { id: "silver", name: "Silver", price: 300, limit: 5, description: "₹300/month – up to 5 applications" },
  { id: "gold", name: "Gold", price: 1000, limit: Infinity, description: "₹1000/month – unlimited applications" },
];

const index = () => {
  const [id, setId] = useState<string | undefined>(undefined);
  const [internshipData, setinternship] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>(PLAN_DETAILS);
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [availability, setAvailability] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [busy, setBusy] = useState(false);
  const user = useSelector(selectuser);

  useEffect(() => {
    const currentId = getRouteId();
    setId(currentId);
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchdata = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/internship/${id}`);
        setinternship(res.data);
      } catch (error) {
        console.log(error);
      }
    };
    fetchdata();
  }, [id]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/application/plans`);
        if (response.data?.plans?.length) setPlans(response.data.plans);
      } catch (error) {
        console.log(error);
      }
    };

    fetchPlans();
  }, []);

  useEffect(() => {
    const userId = user?.uid || user?.email;
    if (!userId) {
      setSubscription({ planId: "free", planName: "Free", limit: 1, remaining: 1, used: 0, isSubscribed: false, status: "free" });
      setSelectedPlan("free");
      return;
    }

    const fetchSubscription = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/application/subscription/${encodeURIComponent(userId)}`);
        setSubscription({
          ...response.data,
          planId: response.data.planId || "free",
          remaining: Number.isFinite(response.data.remaining) ? response.data.remaining : 1,
        });
        setSelectedPlan(response.data.planId || "free");
      } catch (error) {
        console.log(error);
      }
    };

    fetchSubscription();
  }, [user]);

  if (!internshipData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const currentPlanId = subscription?.planId || "free";
  const currentRank: Record<string, number> = { free: 0, bronze: 1, silver: 2, gold: 3 };

  const requestOtp = async () => {
    if (!user?.email) {
      toast.error("Please sign in to continue.");
      return;
    }

    setBusy(true);
    try {
      await axios.post(`${API_BASE}/api/application/request-otp`, {
        userId: user.uid || user.email,
        email: user.email,
      });
      setOtpSent(true);
      toast.success("OTP sent to your registered email.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Unable to send OTP.");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!user?.email || !otp) {
      toast.error("Enter the OTP sent to your email.");
      return;
    }

    setBusy(true);
    try {
      const response = await axios.post(`${API_BASE}/api/application/verify-otp`, {
        userId: user.uid || user.email,
        email: user.email,
        otp,
      });
      setVerificationToken(response.data.verificationToken);
      toast.success("OTP verified. Continue with your selected plan.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setBusy(false);
    }
  };

  const refreshSubscription = async () => {
    if (!user) return;
    const userId = user.uid || user.email;
    if (!userId) return;
    try {
      const response = await axios.get(`${API_BASE}/api/application/subscription/${encodeURIComponent(userId)}`);
      setSubscription({
        ...response.data,
        planId: response.data.planId || "free",
        remaining: Number.isFinite(response.data.remaining) ? response.data.remaining : 1,
      });
      setSelectedPlan(response.data.planId || "free");
    } catch (error) {
      console.log(error);
    }
  };

  const buyApplicationPass = async (planId: string, action: string = "purchase") => {
    if (!user?.email) {
      toast.error("Please sign in to continue.");
      return;
    }

    if (planId === "free") {
      try {
        setBusy(true);
        await axios.post(`${API_BASE}/api/application/plan-change`, {
          userId: user.uid || user.email,
          email: user.email,
          planId: "free",
          action: "downgrade",
        });
        await refreshSubscription();
        setSelectedPlan("free");
        toast.success("Free plan is active.");
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Unable to switch to the free plan.");
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      let token = verificationToken;
      if (!token) {
        setBusy(true);
        await requestOtp();
        const enteredOtp = window.prompt("Enter the OTP sent to your registered email:") || "";
        if (!enteredOtp) {
          setBusy(false);
          return;
        }
        const otpResponse = await axios.post(`${API_BASE}/api/application/verify-otp`, {
          userId: user.uid || user.email,
          email: user.email,
          otp: enteredOtp,
        });
        token = otpResponse.data.verificationToken;
        setVerificationToken(token);
      }

      setBusy(true);
      const orderResponse = await axios.post(`${API_BASE}/api/application/create-order`, {
        userId: user.uid || user.email,
        email: user.email,
        verificationToken: token,
        planId,
        action,
      });

      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Payment gateway could not be loaded."));
        document.body.appendChild(script);
      });

      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) throw new Error("Payment gateway could not be loaded.");

      new Razorpay({
        key: orderResponse.data.keyId,
        amount: orderResponse.data.order.amount,
        currency: "INR",
        name: "InternArea",
        description: `Internship plan: ${planId}`,
        order_id: orderResponse.data.order.id,
        handler: async (payment: any) => {
          try {
            await axios.post(`${API_BASE}/api/application/verify-payment`, {
              userId: user.uid || user.email,
              email: user.email,
              verificationToken: token,
              planId,
              action,
              ...payment,
            });
            setVerificationToken("");
            setOtp("");
            setOtpSent(false);
            await refreshSubscription();
            toast.success("Your internship plan has been updated successfully.");
          } catch (error: any) {
            toast.error(error?.response?.data?.message || "Payment verification failed.");
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            toast.info("Payment cancelled. Your plan was not changed.");
          },
        },
      }).open();
    } catch (error: any) {
      setBusy(false);
      toast.error(error?.response?.data?.message || error.message || "Unable to start payment.");
    }
  };

  const handlesubmitapplication = async () => {
    if (!user) {
      toast.error("Please sign in to apply.");
      return;
    }

    if (!coverLetter.trim()) {
      toast.error("Please write a cover letter.");
      return;
    }
    if (!availability) {
      toast.error("Please select your availability.");
      return;
    }

    const remaining = subscription?.remaining ?? 1;
    if (remaining <= 0) {
      toast.error("Your internship application limit has been used up for this billing cycle.");
      return;
    }

    try {
      const applicationdata = {
        category: internshipData.category,
        company: internshipData.company,
        coverLetter,
        user,
        Application: id,
        availability,
        userId: user.uid || user.email,
        email: user.email,
      };

      const response = await axios.post(`${API_BASE}/api/application`, applicationdata);
      if (response.data?.remaining !== undefined) {
        setSubscription((current: any) => ({
          ...current,
          remaining: response.data.remaining,
          used: current?.used + 1 || 1,
        }));
      }
      toast.success(`Application submitted successfully. ${response.data?.remaining ?? "More"} applications remaining.`);
      setIsModalOpen(false);
      setCoverLetter("");
      setAvailability("");
      if (typeof window !== "undefined") {
        window.location.href = "/internship";
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || "Failed to submit application");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center space-x-2 text-blue-600 mb-4">
            <ArrowUpRight className="h-5 w-5" />
            <span className="font-medium">Actively Hiring</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {internshipData.title}
          </h1>
          <p className="text-lg text-gray-600 mb-4">{internshipData.company}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-2 text-gray-600">
              <MapPin className="h-5 w-5" />
              <span>{internshipData.location}</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <DollarSign className="h-5 w-5" />
              <span>{String(internshipData.stipend ?? "").replace(/\$/g, "")}</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <Calendar className="h-5 w-5" />
              <span>{internshipData.startDate}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-green-500" />
              <span className="text-green-500 text-sm">Posted on {internshipData.createdAt}</span>
            </div>
            <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {subscription?.isSubscribed ? `${subscription.remaining} applications left` : "Apply pass required"}
            </div>
          </div>
        </div>

        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900 mb-4">About {internshipData.company}</h2>
          <div className="flex items-center space-x-2 mb-4">
            <a href="#" className="text-blue-600 hover:text-blue-700 flex items-center space-x-1">
              <span>Visit company website</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <p className="text-gray-600">{internshipData.aboutCompany}</p>
        </div>

        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900 mb-4">About the Internship</h2>
          <p className="text-gray-600 mb-6">{internshipData.aboutInternship}</p>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">Who can apply</h3>
          <p className="text-gray-600 mb-6">{internshipData.whoCanApply}</p>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">Perks</h3>
          <p className="text-gray-600 mb-6">{internshipData.perks}</p>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">Additional Information</h3>
          <p className="text-gray-600 mb-6">{internshipData.additionalInfo}</p>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">Number of Openings</h3>
          <p className="text-gray-600">{internshipData.numberOfOpening}</p>
        </div>

        <div className="p-6 flex justify-center">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition duration-150"
          >
            Apply Now
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Apply to {internshipData.company}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {!user ? (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                  <p className="font-semibold">Sign in to apply.</p>
                  <Link href="/" className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">
                    Sign up to apply
                  </Link>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Current plan</p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">{subscription?.planName || "Free"}</h3>
                      </div>
                      <div className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white">
                        {subscription?.amount ? `₹${subscription.amount}` : "Free"}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                      <span>
                        {subscription?.remaining !== undefined
                          ? `${subscription.remaining} applications left in this cycle.`
                          : "Free plan gives you 1 application per month."}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {plans.map((plan: { id: string; name: string; description: string; price: number }) => {
                        const isCurrent = currentPlanId === plan.id;
                        const rank = currentRank[plan.id] ?? 0;
                        const currentRankValue = currentRank[currentPlanId] ?? 0;
                        const action = rank > currentRankValue ? "upgrade" : rank < currentRankValue ? "downgrade" : "renew";
                        const buttonLabel = isCurrent ? "Current plan" : plan.id === "free" ? "Use free plan" : rank > currentRankValue ? "Upgrade" : rank < currentRankValue ? "Downgrade" : "Renew";

                        return (
                          <div key={plan.id} className={`rounded-xl border p-3 ${isCurrent ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-base font-bold text-slate-900">{plan.name}</div>
                                <div className="text-xs text-slate-500">{plan.description}</div>
                              </div>
                              <div className="font-bold text-slate-900">{plan.price === 0 ? "Free" : `₹${plan.price}`}</div>
                            </div>
                            <button
                              disabled={busy || isCurrent}
                              onClick={() => buyApplicationPass(plan.id, action)}
                              className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold ${isCurrent ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white"}`}
                            >
                              {buttonLabel}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button disabled={busy} onClick={requestOtp} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        {otpSent ? "Resend OTP" : "Send OTP"}
                      </button>
                      {otpSent && (
                        <>
                          <input
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="Enter OTP"
                            inputMode="numeric"
                            className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                          />
                          <button disabled={busy || otp.length !== 6} onClick={verifyOtp} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                            Verify OTP
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Resume</h3>
                    <p className="text-gray-600">Your current resume will be submitted with the application.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Cover Letter</h3>
                    <p className="text-gray-600 mb-2">Why should you be selected for this internship?</p>
                    <textarea
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                      placeholder="Write your cover letter here..."
                    ></textarea>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Availability</h3>
                    <div className="space-y-3">
                      {[
                        "Yes, I am available to join immediately",
                        "No, I am currently on notice period",
                        "No, I will have to serve notice period",
                        "Other",
                      ].map((option) => (
                        <label key={option} className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="availability"
                            value={option}
                            checked={availability === option}
                            onChange={(e) => setAvailability(e.target.value)}
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={handlesubmitapplication}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={busy || (subscription?.remaining ?? 1) <= 0}
                    >
                      Submit Application
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default index;