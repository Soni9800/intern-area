import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import {
  ArrowUpRight,
  Banknote,
  Calendar,
  ChevronRight,
  MapPin,
  Search,
  Sparkles,
  BriefcaseBusiness,
} from "lucide-react";
import Link from "next/link";
import axios from "axios";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function SvgSlider() {
  const categories = [
    "Big Brands",
    "Work From Home",
    "Part-time",
    "MBA",
    "Engineering",
    "Media",
    "Design",
    "Data Science",
  ];
  // const internships = [
  //   {
  //     _id: "1",
  //     title: "Software Engineering Intern",
  //     company: "Google",
  //     location: "Remote",
  //     stipend: "$1,500/month",
  //     duration: "3 months",
  //     category: "Engineering",
  //   },
  //   {
  //     _id: "2",
  //     title: "Marketing Intern",
  //     company: "Meta",
  //     location: "New York",
  //     stipend: "$1,200/month",
  //     duration: "6 months",
  //     category: "Media",
  //   },
  //   {
  //     _id: "3",
  //     title: "Graphic Design Intern",
  //     company: "Adobe",
  //     location: "San Francisco",
  //     stipend: "$1,000/month",
  //     duration: "4 months",
  //     category: "Design",
  //   },
  // ];

  // const jobs = [
  //   {
  //     _id: "101",
  //     title: "Frontend Developer",
  //     company: "Amazon",
  //     location: "Seattle",
  //     CTC: "$100K/year",
  //     Experience: "2+ years",
  //     category: "Engineering",
  //   },
  //   {
  //     _id: "102",
  //     title: "Data Analyst",
  //     company: "Microsoft",
  //     location: "Remote",
  //     CTC: "$90K/year",
  //     Experience: "1+ years",
  //     category: "Data Science",
  //   },
  //   {
  //     _id: "103",
  //     title: "UX Designer",
  //     company: "Apple",
  //     location: "California",
  //     CTC: "$110K/year",
  //     Experience: "3+ years",
  //     category: "Design",
  //   },
  // ];
  const slides = [
    {
      title: "Start Your Career Journey",
      bgColor: "bg-indigo-600",
      image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1600&q=85",
      imageAlt: "A team collaborating around a table in a modern office",
    },
    {
      title: "Learn From The Best",
      bgColor: "bg-blue-600",
      image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=85",
      imageAlt: "Students learning together with laptops",
    },
    {
      title: "Grow Your Skills",
      bgColor: "bg-purple-600",
      image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=85",
      imageAlt: "Developer working on a laptop in a creative workspace",
    },
    {
      title: "Connect With Top Companies",
      bgColor: "bg-teal-600",
      image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&q=85",
      imageAlt: "Professionals connecting in a bright meeting room",
    },
  ];

  const stats = [
    { number: "300K+", label: "companies hiring" },
    { number: "10K+", label: "new openings everyday" },
    { number: "21Mn+", label: "active students" },
    { number: "600K+", label: "learners" },
  ];
  const [internships, setinternship] = useState<any>([]);
  const [jobs, setjob] = useState<any>([]);
  useEffect(() => {
    const fetchdata = async () => {
      try {
        const [internshipres, jobres] = await Promise.all([
          axios.get(`${apiBaseUrl}/api/internship`),
          axios.get(`${apiBaseUrl}/api/job`),
        ]);
        setinternship(internshipres.data);
        setjob(jobres.data);
      } catch (error) {
        console.log(error);
      }
    };
    fetchdata();
  }, []);
  const [selectedCategory, setSelectedCategory] = useState("");
  const filteredInternships = internships.filter(
    (item: any) => !selectedCategory || item.category === selectedCategory
  );
  const filteredJobs = jobs.filter(
    (item: any) => !selectedCategory || item.category === selectedCategory
  );
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white px-4 pb-12 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-10">
          <div className="max-w-3xl">
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              <Sparkles size={14} /> Your next chapter starts here
            </p>
            <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Find work that moves your future forward.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Explore internships and jobs from ambitious teams, then build the experience that gets you noticed.
            </p>
            <div className="mt-8 flex max-w-2xl flex-col gap-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:flex-row">
              <div className="flex flex-1 items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-slate-400">
                <Search size={18} />
                <input className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" placeholder="Search roles, skills, or companies" />
              </div>
              <Link href="/internship" className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                Explore opportunities <ArrowUpRight className="ml-2" size={16} />
              </Link>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-6 lg:mt-0">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="text-2xl font-black text-slate-900">300K+</p>
              <p className="mt-1 text-xs text-slate-500">companies hiring</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="text-2xl font-black text-slate-900">10K+</p>
              <p className="mt-1 text-xs text-slate-500">fresh openings</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="text-2xl font-black text-slate-900">21Mn+</p>
              <p className="mt-1 text-xs text-slate-500">active students</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-12">
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={24}
            slidesPerView={1}
            navigation
            pagination={{ clickable: true }}
            autoplay={{ delay: 5000 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            {slides.map((slide, index) => (
              <SwiperSlide key={index}>
                <div className="relative h-72 overflow-hidden sm:h-80">
                  <img src={slide.image} alt={slide.imageAlt} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-slate-900/50" />
                  <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                    <div>
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-blue-200">InternArea spotlight</p>
                      <h2 className="text-3xl font-black text-white sm:text-5xl">{slide.title}</h2>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        <div className="mb-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Curated for you</p>
              <h2 className="text-2xl font-bold text-slate-900">Latest internships on Intern Area</h2>
            </div>
            <BriefcaseBusiness className="hidden text-slate-300 sm:block" size={30} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-slate-700">POPULAR CATEGORIES:</span>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${
                  selectedCategory === category
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredInternships.map((internship: any, index: any) => (
            <div key={index} className="card-soft h-full rounded-2xl p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-blue-600">
                <ArrowUpRight size={18} />
                <span>Actively Hiring</span>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900">{internship.title}</h3>
              <p className="mb-4 text-sm text-slate-500">{internship.company}</p>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-2"><MapPin size={16} /><span>{internship.location}</span></div>
                <div className="flex items-center gap-2"><Banknote size={16} /><span>{String(internship.stipend ?? "").replace(/\$/g, "")}</span></div>
                <div className="flex items-center gap-2"><Calendar size={16} /><span>{internship.duration}</span></div>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Internship</span>
                <Link href={`/detailiternship/${internship._id}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                  View details <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-12">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">Latest Jobs</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job: any, index: any) => (
              <div key={index} className="card-soft h-full rounded-2xl p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-blue-600">
                  <ArrowUpRight size={18} />
                  <span>Actively Hiring</span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{job.title}</h3>
                <p className="mb-4 text-sm text-slate-500">{job.company}</p>
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2"><MapPin size={16} /><span>{job.location}</span></div>
                  <div className="flex items-center gap-2"><Banknote size={16} /><span>{String(job.CTC ?? "").replace(/\$/g, "")}</span></div>
                  <div className="flex items-center gap-2"><Calendar size={16} /><span>{job.Experience}</span></div>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Jobs</span>
                  <Link href={`/detailInternship?q=${job._id}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                    View details <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={index} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                <div className="mb-2 text-3xl font-black text-blue-600 sm:text-4xl">{stat.number}</div>
                <div className="text-sm text-slate-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}