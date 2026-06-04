"use client";

import "./schools.css";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa6";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { BsLightningFill } from "react-icons/bs";
import { FaGraduationCap, FaShieldAlt } from "react-icons/fa";
import { FaLock } from "react-icons/fa6";
import { FaSchool } from "react-icons/fa";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSettings } from "@/context/SettingsContext";

const ABOUT_CAROUSEL_ITEMS: { icon: ReactNode; title: string; body: string }[] =
  [
    {
      icon: <FaShieldAlt></FaShieldAlt>,
      title: "Private by design",
      body: "Campus boards stay scoped to each school and its verified members.",
    },
    {
      icon: <BsLightningFill></BsLightningFill>,
      title: "Fast item matching",
      body: "Post found items quickly and surface likely matches before they disappear.",
    },
    {
      icon: <FaSchool></FaSchool>,
      title: "One board per school",
      body: "Keep messages, items, and admin tools organized around the right campus.",
    },
    {
      icon: <FaLock></FaLock>,
      title: "Trusted access",
      body: "School codes and admin tools keep the whole experience clean and secure.",
    },
  ];

// ─── Types ────────────────────────────────────────────────────────────────────
interface School {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  color: string;
  theme: string;
  website_url: string | null;
  rep_name: string;
  rep_email: string;
  status: string;
}

interface SchoolItem {
  id: number;
  school_id: string;
  name: string;
  description: string;
  image_url: string | null;
  image_urls: string[] | null;
  author_name: string;
  author_avatar: string | null;
  author_id: string;
  author_email: string;
  status: string;
  date_found: string;
  created_at: string;
}

interface SchoolLostItem {
  id: number;
  school_id: string;
  name: string;
  description: string;
  image_url: string | null;
  image_urls: string[] | null;
  author_name: string;
  author_avatar: string | null;
  author_id: string;
  author_email: string;
  status: string;
  created_at: string;
}

const SCHOOLS_CACHE_TTL_MS = 5 * 60 * 1000;
const SCHOOL_BOARD_CACHE_TTL_MS = 5 * 60 * 1000;

function getMySchoolsCacheKey(userId: string) {
  return `findr_my_schools_${userId}`;
}

function readMySchoolsCache(userId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getMySchoolsCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; schools: School[] };
    if (!parsed?.timestamp || !Array.isArray(parsed.schools)) return null;
    if (Date.now() - parsed.timestamp > SCHOOLS_CACHE_TTL_MS) return null;
    return parsed.schools;
  } catch {
    return null;
  }
}

function writeMySchoolsCache(userId: string, schools: School[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      getMySchoolsCacheKey(userId),
      JSON.stringify({ timestamp: Date.now(), schools }),
    );
  } catch {
    // ignore storage quota / privacy errors
  }
}

function removeMySchoolsCache(userId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getMySchoolsCacheKey(userId));
  } catch {
    // ignore storage errors
  }
}

function getSchoolBoardCacheKey(schoolId: string) {
  return `findr_school_board_${schoolId}`;
}

function readSchoolBoardCache(schoolId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getSchoolBoardCacheKey(schoolId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      timestamp: number;
      found: SchoolItem[];
      lost: SchoolLostItem[];
    };
    if (
      !parsed?.timestamp ||
      !Array.isArray(parsed.found) ||
      !Array.isArray(parsed.lost)
    ) {
      return null;
    }
    if (Date.now() - parsed.timestamp > SCHOOL_BOARD_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSchoolBoardCache(
  schoolId: string,
  found: SchoolItem[],
  lost: SchoolLostItem[],
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      getSchoolBoardCacheKey(schoolId),
      JSON.stringify({ timestamp: Date.now(), found, lost }),
    );
  } catch {
    // ignore storage quota / privacy errors
  }
}

// ─── About / Landing Panel ────────────────────────────────────────────────────
function AboutPanel({
  onEnterCode,
  onRegister,
}: {
  onEnterCode: () => void;
  onRegister?: () => void;
}) {
  return (
    <div className="sc-about">
      <section className="sc-about__hero">
        <div className="sc-about__hero-copy">
          <p className="sc-about__eyebrow">Campus lost &amp; found</p>
          <h1 className="sc-about__title">Findr for Schools</h1>
          <p className="sc-about__subtitle">
            A private school board for lost items, announcements, and matching.
            Students and staff only see what belongs to their campus.
          </p>
          <div className="sc-about__cta-row">
            <button
              className="sc-btn sc-btn--primary sc-about__cta"
              onClick={onEnterCode}
            >
              Join Your School
            </button>
            <button
              className="sc-btn sc-btn--secondary sc-about__secondary"
              onClick={() => {
                if (onRegister) return onRegister();
                document
                  .querySelector("#register-anchor")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            >
              Register a School
            </button>
          </div>

          <div className="sc-about__stats">
            <div className="sc-about__stat">
              <strong>Private</strong>
              <span>school-code access</span>
            </div>
            <div className="sc-about__stat">
              <strong>Fast</strong>
              <span>item matching flow</span>
            </div>
            <div className="sc-about__stat">
              <strong>Trusted</strong>
              <span>admin-scoped controls</span>
            </div>
          </div>
        </div>

        <div className="sc-about__hero-visual" aria-hidden="true">
          <div className="sc-about__orb sc-about__orb--one" />
          <div className="sc-about__orb sc-about__orb--two" />
          <div className="sc-about__hero-card">
            <p className="sc-about__hero-label">Featured campus board</p>
            <h2>Hillcrest High School</h2>
            <p>
              Live updates, polished branding, and one place for everything that
              gets lost between classes.
            </p>
            <div className="sc-about__hero-tags">
              <span>Found items</span>
              <span>Admin tools</span>
              <span>Campus chat</span>
            </div>
          </div>
        </div>
      </section>

      <section className="sc-about__carousel-section">
        <div className="sc-section-title">Built to feel alive</div>
        <div></div>
        <p className="sc-hint sc-about__carousel-hint">
          Smooth motion, bold cards, and a campus-first layout that helps you reconnect
          with your lost items <b>and</b> your community.
        </p>
        <div className="sc-carousel">
          <div className="sc-carousel__track">
            <div className="sc-carousel__group">
              {ABOUT_CAROUSEL_ITEMS.map((item) => (
                <article key={item.title} className="sc-carousel__card">
                  <div className="sc-carousel__icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
            <div className="sc-carousel__group" aria-hidden="true">
              {ABOUT_CAROUSEL_ITEMS.map((item) => (
                <article
                  key={`${item.title}-duplicate`}
                  className="sc-carousel__card"
                >
                  <div className="sc-carousel__icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="sc-about__features">
        {[
          {
            icon: <FaGraduationCap></FaGraduationCap>,
            title: "Branded campus space",
            desc: "Each school can feel unique with its own color, logo, and tone.",
          },
          {
            icon: <BsLightningFill></BsLightningFill>,
            title: "Real-time momentum",
            desc: "Fast posting and scanning keep the board moving instead of stale.",
          },
          {
            icon: <FaShieldAlt></FaShieldAlt>,
            title: "School-scoped privacy",
            desc: "Members only see the board that belongs to their campus.",
          },
          {
            icon: <FaLock></FaLock>,
            title: "Admin controls",
            desc: "Trusted staff manage their own board without affecting others.",
          },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="sc-about__feature">
            <span className="sc-about__feature-icon">{icon}</span>
            <h3>{title}</h3>
            <p>{desc}</p>
          </div>
        ))}
      </div>

      <div className="sc-about__register-cta">
        <h2>Is your school not on Findr yet?</h2>
        <p>
          Submit a registration request and a Findr super-admin will review it
          within 48 hours.
        </p>
        <button
          className="sc-btn sc-btn--secondary"
          onClick={() => {
            if (onRegister) return onRegister();
            document
              .querySelector("#register-anchor")
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        >
          Register Your School
        </button>
      </div>
    </div>
  );
}

// ─── Enter Code Panel ─────────────────────────────────────────────────────────
function EnterCodePanel({
  user,
  mySchools,
  onJoined,
}: {
  user: any;
  mySchools: School[];
  onJoined: (school: School) => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Sign in first.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");

    const { data: school, error: fetchErr } = await supabase
      .from("schools")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("status", "approved")
      .maybeSingle();

    if (fetchErr || !school) {
      setError(
        "No approved school found with that code. Double-check and try again.",
      );
      setLoading(false);
      return;
    }

    if (mySchools.some((s) => s.id === school.id)) {
      setError("You're already a member of this school.");
      setLoading(false);
      return;
    }

    const { error: joinErr } = await supabase
      .from("user_schools")
      .insert({ user_id: user.id, school_id: school.id });

    if (joinErr) {
      setError("Something went wrong. Try again.");
    } else {
      setSuccess(`You've joined ${school.name}!`);
      onJoined(school as School);
      setCode("");
    }
    setLoading(false);
  };

  return (
    <div className="sc-panel-content">
      <div className="sc-section-title">Enter School Code</div>
      <p className="sc-hint">
        Your school administrator will give you a unique code. Codes are
        case-insensitive.
      </p>

      <form className="sc-form" onSubmit={handleJoin}>
        <label className="sc-form__label">School Code</label>
        <input
          className="sc-form__input sc-form__input--code"
          type="text"
          placeholder="e.g. LINCOLN-2025"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          maxLength={40}
        />
        {error && <p className="sc-form__error">{error}</p>}
        {success && <p className="sc-form__success">{success}</p>}
        <button
          type="submit"
          className="sc-btn sc-btn--primary sc-form__submit"
          disabled={loading}
        >
          {loading ? "Searching..." : "Join School"}
        </button>
      </form>

      {mySchools.length > 0 && (
        <>
          <div className="sc-section-title" style={{ marginTop: "2rem" }}>
            Your Schools
          </div>
          <div className="sc-school-list">
            {mySchools.map((s) => (
              <div
                key={s.id}
                className="sc-school-chip"
                style={{ borderLeftColor: s.color }}
              >
                {s.logo_url ? (
                  <img
                    src={s.logo_url}
                    alt={s.name}
                    className="sc-school-chip__logo"
                  />
                ) : (
                  <div
                    className="sc-school-chip__initial"
                    style={{ background: s.color }}
                  >
                    {s.name[0]}
                  </div>
                )}
                <span className="sc-school-chip__name">{s.name}</span>
                <span className="sc-school-chip__code">{s.code}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Register School Panel ────────────────────────────────────────────────────
function RegisterSchoolPanel({ user }: { user: any }) {
  const { theme } = useSettings();
  const [form, setForm] = useState({
    name: "",
    websiteUrl: "",
    repRole: "",
    extraInfo: "",
    color: "#2f80ed",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    let logoUrl = "";
    let docUrl = "";

    if (logoFile) {
      const fn = `school_logo_${Date.now()}_${logoFile.name}`;
      await supabase.storage.from("item-images").upload(fn, logoFile);
      const { data } = supabase.storage.from("item-images").getPublicUrl(fn);
      logoUrl = data.publicUrl;
    }

    if (docFile) {
      const fn = `school_doc_${Date.now()}_${docFile.name}`;
      await supabase.storage.from("item-images").upload(fn, docFile);
      const { data } = supabase.storage.from("item-images").getPublicUrl(fn);
      docUrl = data.publicUrl;
    }

    await supabase.from("school_requests").insert({
      name: form.name,
      website_url: form.websiteUrl || null,
      logo_url: logoUrl || null,
      doc_url: docUrl || null,
      color: form.color,
      theme,
      rep_name: user.fullName || user.username || "Unknown",
      rep_email: user.primaryEmailAddress?.emailAddress || "",
      rep_user_id: user.id,
      rep_role: form.repRole || null,
      extra_info: form.extraInfo || null,
      status: "pending",
    });

    setDone(true);
    setSubmitting(false);
  };

  if (done) {
    return (
      <div className="sc-panel-content">
        <div className="sc-success">
          <span className="sc-success__icon"></span>
          <p>Registration submitted!</p>
          <p className="sc-success__sub">
            A Findr super-admin will review within 48 hours and email you the
            school code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sc-panel-content" id="register-anchor">
      <div className="sc-section-title">Register Your School</div>
      <p className="sc-hint">
        Fill in your institution's details. A super-admin will review and
        approve your school, then send you a unique access code.
      </p>
      <form className="sc-form" onSubmit={handleSubmit}>
        <label className="sc-form__label">School / Institution Name *</label>
        <input
          className="sc-form__input"
          type="text"
          placeholder="Lincoln High School"
          required
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />

        <label className="sc-form__label">Website URL</label>
        <input
          className="sc-form__input"
          type="url"
          placeholder="https://lincolnhs.edu"
          value={form.websiteUrl}
          onChange={(e) =>
            setForm((p) => ({ ...p, websiteUrl: e.target.value }))
          }
        />

        <label className="sc-form__label">Your Role at the Institution *</label>
        <input
          className="sc-form__input"
          type="text"
          placeholder="e.g. Principal, IT Coordinator, Dean"
          required
          value={form.repRole}
          onChange={(e) => setForm((p) => ({ ...p, repRole: e.target.value }))}
        />

        <label className="sc-form__label">Your Name</label>
        <input
          className="sc-form__input"
          type="text"
          value={user?.fullName || ""}
          readOnly
        />

        <label className="sc-form__label">Your Email</label>
        <input
          className="sc-form__input"
          type="email"
          value={user?.primaryEmailAddress?.emailAddress || ""}
          readOnly
        />

        <label className="sc-form__label">School Logo</label>
        <label className="sc-form__file-label" htmlFor="school-logo-upload">
          <span className="sc-form__file-icon">+</span>
          <span>{logoFile ? logoFile.name : "Upload school logo"}</span>
        </label>
        <input
          id="school-logo-upload"
          className="sc-form__file"
          type="file"
          accept="image/*"
          onChange={(e) =>
            e.target.files?.[0] && setLogoFile(e.target.files[0])
          }
        />

        <label className="sc-form__label">
          Verification Document (optional)
        </label>
        <p className="sc-form__hint">
          Official letterhead, employee ID scan, or any document showing your
          affiliation.
        </p>
        <label className="sc-form__file-label" htmlFor="school-doc-upload">
          <span className="sc-form__file-icon">+</span>
          <span>{docFile ? docFile.name : "Upload verification doc"}</span>
        </label>
        <input
          id="school-doc-upload"
          className="sc-form__file"
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => e.target.files?.[0] && setDocFile(e.target.files[0])}
        />

        <label className="sc-form__label">School Brand Color</label>
        <div className="sc-color-row">
          <input
            type="color"
            className="sc-color-picker"
            value={form.color}
            onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
          />
          <span className="sc-color-value">{form.color}</span>
          <div
            className="sc-color-preview"
            style={{ background: form.color }}
          />
        </div>

        <input type="hidden" value={theme} readOnly />

        <label className="sc-form__label">Anything else?</label>
        <textarea
          className="sc-form__textarea"
          placeholder="e.g. We have 2000 students across 3 campuses..."
          value={form.extraInfo}
          onChange={(e) =>
            setForm((p) => ({ ...p, extraInfo: e.target.value }))
          }
        />

        <button
          type="submit"
          className="sc-btn sc-btn--primary sc-form__submit"
          disabled={submitting || !user}
        >
          {submitting ? "Submitting..." : "Submit Registration"}
        </button>
        {!user && (
          <p className="sc-form__error">Sign in to submit a registration.</p>
        )}
      </form>
    </div>
  );
}

// ─── My Schools Panel ─────────────────────────────────────────────────────────
function MySchoolsPanel({
  mySchools,
  user,
  onSelectSchool,
  onLeave,
}: {
  mySchools: School[];
  user: any;
  onSelectSchool: (school: School) => void;
  onLeave: (school: School) => void;
}) {
  if (!user) {
    return (
      <div className="sc-panel-content">
        <p className="sc-empty">Sign in to see your schools.</p>
      </div>
    );
  }

  if (mySchools.length === 0) {
    return (
      <div className="sc-panel-content">
        <p className="sc-empty">
          You haven't joined any schools yet. Enter your school code to get
          started.
        </p>
      </div>
    );
  }

  return (
    <div className="sc-panel-content">
      <div className="sc-section-title">My Schools</div>
      <div className="sc-school-cards">
        {mySchools.map((school) => (
          <div
            key={school.id}
            className="sc-school-card"
            style={{ "--sc-color": school.color } as React.CSSProperties}
          >
            <div
              className="sc-school-card__accent"
              style={{ background: school.color }}
            />
            <div className="sc-school-card__body">
              <div className="sc-school-card__top">
                {school.logo_url ? (
                  <img
                    src={school.logo_url}
                    alt={school.name}
                    className="sc-school-card__logo"
                  />
                ) : (
                  <div
                    className="sc-school-card__initial"
                    style={{ background: school.color }}
                  >
                    {school.name[0]}
                  </div>
                )}
                <div>
                  <p className="sc-school-card__name">{school.name}</p>
                  <p className="sc-school-card__code">{school.code}</p>
                </div>
              </div>
              <div className="sc-school-card__actions">
                <button
                  className="sc-btn sc-btn--school"
                  style={{ background: school.color }}
                  onClick={() => onSelectSchool(school)}
                >
                  View Board →
                </button>
                <button
                  className="sc-btn sc-btn--ghost"
                  onClick={() => onLeave(school)}
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── School Board ─────────────────────────────────────────────────────────────
function SchoolBoard({
  school,
  user,
  onBack,
}: {
  school: School;
  user: any;
  onBack: () => void;
}) {
  type BoardTab =
    | "items"
    | "add-item"
    | "report-lost"
    | "become-admin"
    | "admin-login";

  const BOARD_TABS: {
    id: BoardTab;
    label: string;
    icon: string;
  }[] = [
    { id: "items", label: "Items", icon: "" },
    { id: "add-item", label: "Report Found", icon: "" },
    { id: "report-lost", label: "Report Lost", icon: "" },
    { id: "become-admin", label: "Become Admin", icon: "" },
    { id: "admin-login", label: "Admin", icon: "" },
  ];

  const [activeTab, setActiveTab] = useState<BoardTab>("items");
  const [boardTab, setBoardTab] = useState<"found" | "lost">("found");
  const [searchQuery, setSearchQuery] = useState("");

  const [items, setItems] = useState<SchoolItem[]>([]);
  const [lostItems, setLostItems] = useState<SchoolLostItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);

  useEffect(() => {
    setIsSchoolAdmin(
      localStorage.getItem(`findr_school_admin_${school.id}`) === "true",
    );
  }, [school.id]);

  const color = school.color;

  useEffect(() => {
    const cachedBoard = readSchoolBoardCache(school.id);
    if (cachedBoard) {
      setItems(cachedBoard.found);
      setLostItems(cachedBoard.lost);
      setLoadingItems(false);
    } else {
      setLoadingItems(true);
    }

    const fetchItems = async () => {
      const [{ data: found }, { data: lost }] = await Promise.all([
        supabase
          .from("school_items")
          .select("*")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("school_lost_items")
          .select("*")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false }),
      ]);
      const nextFound = (found ?? []) as SchoolItem[];
      const nextLost = (lost ?? []) as SchoolLostItem[];
      setItems(nextFound);
      setLostItems(nextLost);
      writeSchoolBoardCache(school.id, nextFound, nextLost);
      setLoadingItems(false);
    };
    fetchItems();
  }, [school.id]);

  // ── Add Found Item ─────────────────────────────────────────────────────────
  const [foundName, setFoundName] = useState("");
  const [foundDesc, setFoundDesc] = useState("");
  const [foundFiles, setFoundFiles] = useState<File[]>([]);
  const [foundUploading, setFoundUploading] = useState(false);
  const [foundSuccess, setFoundSuccess] = useState(false);

  const handleAddFound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !foundName || !foundDesc) return;
    setFoundUploading(true);
    const imageUrls: string[] = [];
    for (const file of foundFiles.slice(0, 3)) {
      const fn = `school_${school.id}_${Date.now()}_${file.name}`;
      await supabase.storage.from("item-images").upload(fn, file);
      const { data } = supabase.storage.from("item-images").getPublicUrl(fn);
      imageUrls.push(data.publicUrl);
    }
    const { data: inserted } = await supabase
      .from("school_items")
      .insert({
        school_id: school.id,
        name: foundName,
        description: foundDesc,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        author_name: user.fullName || user.username || "Anonymous",
        author_avatar: user.imageUrl,
        author_id: user.id,
        author_email: user.primaryEmailAddress?.emailAddress,
        status: "waiting",
      })
      .select()
      .single();
    if (inserted) setItems((prev) => [inserted, ...prev]);
    setFoundName("");
    setFoundDesc("");
    setFoundFiles([]);
    setFoundSuccess(true);
    setTimeout(() => {
      setFoundSuccess(false);
      setActiveTab("items");
    }, 1500);
    setFoundUploading(false);
  };

  // ── Add Lost Item ──────────────────────────────────────────────────────────
  const [lostName, setLostName] = useState("");
  const [lostDesc, setLostDesc] = useState("");
  const [lostFiles, setLostFiles] = useState<File[]>([]);
  const [lostUploading, setLostUploading] = useState(false);
  const [lostSuccess, setLostSuccess] = useState(false);

  const handleAddLost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lostName || !lostDesc) return;
    setLostUploading(true);
    const imageUrls: string[] = [];
    for (const file of lostFiles.slice(0, 3)) {
      const fn = `school_lost_${school.id}_${Date.now()}_${file.name}`;
      await supabase.storage.from("item-images").upload(fn, file);
      const { data } = supabase.storage.from("item-images").getPublicUrl(fn);
      imageUrls.push(data.publicUrl);
    }
    const { data: inserted } = await supabase
      .from("school_lost_items")
      .insert({
        school_id: school.id,
        name: lostName,
        description: lostDesc,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        author_name: user.fullName || user.username || "Anonymous",
        author_avatar: user.imageUrl,
        author_id: user.id,
        author_email: user.primaryEmailAddress?.emailAddress,
        status: "looking",
      })
      .select()
      .single();
    if (inserted) setLostItems((prev) => [inserted, ...prev]);
    setLostName("");
    setLostDesc("");
    setLostFiles([]);
    setLostSuccess(true);
    setTimeout(() => {
      setLostSuccess(false);
      setActiveTab("items");
      setBoardTab("lost");
    }, 1500);
    setLostUploading(false);
  };

  // ── Admin login ────────────────────────────────────────────────────────────
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminChecking, setAdminChecking] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminChecking(true);
    setAdminError("");

    // Check 1: rep-level password stored on the school itself (set by super admin on approval)
    const { data: schoolRow } = await supabase
      .from("schools")
      .select("password")
      .eq("id", school.id)
      .maybeSingle();

    const repMatch =
      schoolRow?.password && schoolRow.password === adminPassword;

    // Check 2: per-staff password in school_admins (set when a "Become Admin" request is approved)
    const { data: staffRow } = repMatch
      ? { data: null }
      : await supabase
          .from("school_admins")
          .select("id")
          .eq("school_id", school.id)
          .eq("user_email", user?.primaryEmailAddress?.emailAddress ?? "")
          .eq("password", adminPassword)
          .maybeSingle();

    if (!repMatch && !staffRow) {
      setAdminError("Incorrect password or not approved yet.");
    } else {
      localStorage.setItem(`findr_school_admin_${school.id}`, "true");
      setIsSchoolAdmin(true);
      setAdminUnlocked(true);
    }
    setAdminChecking(false);
  };

  // ── Become admin ───────────────────────────────────────────────────────────
  const [reqForm, setReqForm] = useState({ teacherId: "", extraInfo: "" });
  const [reqFile, setReqFile] = useState<File | null>(null);
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqDone, setReqDone] = useState(false);

  const handleBecomeAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setReqSubmitting(true);
    let idImageUrl = "";
    if (reqFile) {
      const fn = `school_admin_req_${Date.now()}_${reqFile.name}`;
      await supabase.storage.from("item-images").upload(fn, reqFile);
      const { data } = supabase.storage.from("item-images").getPublicUrl(fn);
      idImageUrl = data.publicUrl;
    }
    await supabase.from("school_admin_requests").insert({
      school_id: school.id,
      name: user.fullName || user.username || "",
      email: user.primaryEmailAddress?.emailAddress || "",
      user_id: user.id,
      teacher_id: reqForm.teacherId || null,
      extra_info: reqForm.extraInfo || null,
      id_image_url: idImageUrl || null,
      status: "pending",
    });
    setReqDone(true);
    setReqSubmitting(false);
  };

  // ── Admin delete / status actions ──────────────────────────────────────────
  const handleDeleteFound = async (id: number) => {
    if (!confirm("Delete this item permanently?")) return;
    await supabase.from("school_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };
  const handleDeleteLost = async (id: number) => {
    if (!confirm("Delete this lost item?")) return;
    await supabase.from("school_lost_items").delete().eq("id", id);
    setLostItems((prev) => prev.filter((i) => i.id !== id));
  };
  const handleMarkClaimed = async (id: number) => {
    await supabase.from("school_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };
  const handleMarkFound = async (id: number) => {
    await supabase.from("school_lost_items").delete().eq("id", id);
    setLostItems((prev) => prev.filter((i) => i.id !== id));
  };

  const filteredFound = searchQuery.trim()
    ? items.filter((i) =>
        `${i.name} ${i.description}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      )
    : items;
  const filteredLost = searchQuery.trim()
    ? lostItems.filter((i) =>
        `${i.name} ${i.description}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      )
    : lostItems;

  return (
    <div
      className="sc-board"
      style={{ "--sc-color": color } as React.CSSProperties}
    >
      {/* School header banner */}
      <div className="sc-board__header" style={{ borderBottomColor: color }}>
        <button className="sc-board__back" onClick={onBack}>
          ← Back
        </button>
        <div className="sc-board__identity">
          {school.logo_url ? (
            <img
              src={school.logo_url}
              alt={school.name}
              className="sc-board__logo"
            />
          ) : (
            <div className="sc-board__initial" style={{ background: color }}>
              {school.name[0]}
            </div>
          )}
          <div>
            <p className="sc-board__name">{school.name}</p>
            <p className="sc-board__code">{school.code}</p>
          </div>
        </div>
        {isSchoolAdmin && (
          <div className="sc-admin-badge">
            School Admin
            <button
              className="sc-admin-badge__exit"
              onClick={() => {
                localStorage.removeItem(`findr_school_admin_${school.id}`);
                setIsSchoolAdmin(false);
              }}
            >
              Exit
            </button>
          </div>
        )}
      </div>

      {/* Board layout: sidebar + main */}
      <div className="sc-board__layout">
        <aside className="sc-board__sidebar">
          {BOARD_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`sc-board__tab${activeTab === tab.id ? " sc-board__tab--active" : ""}`}
              style={
                activeTab === tab.id ? { background: `${color}22`, color } : {}
              }
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="sc-board__tab-icon">{tab.icon}</span>
              <span className="sc-board__tab-label">{tab.label}</span>
              {activeTab === tab.id && (
                <span
                  className="sc-board__tab-pip"
                  style={{ background: color }}
                />
              )}
            </button>
          ))}
        </aside>

        <main className="sc-board__main">
          {/* ── ITEMS TAB ── */}
          {activeTab === "items" && (
            <>
              <div className="sc-search-row">
                <div className="sc-search-wrap">
                  <input
                    className="sc-search"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="sc-search__clear"
                      onClick={() => setSearchQuery("")}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <div className="sc-tabs-row">
                {(["found", "lost"] as const).map((t) => (
                  <button
                    key={t}
                    className={`sc-tab-btn${boardTab === t ? " sc-tab-btn--active" : ""}`}
                    style={
                      boardTab === t
                        ? {
                            background: color,
                            color: "#fff",
                            borderColor: color,
                          }
                        : {}
                    }
                    onClick={() => setBoardTab(t)}
                  >
                    {t === "found"
                      ? `Found Items (${filteredFound.filter((i) => i.status !== "claimed").length})`
                      : `Lost Items (${filteredLost.length})`}
                  </button>
                ))}
              </div>

              {loadingItems ? (
                <div className="sc-empty">Loading...</div>
              ) : boardTab === "found" ? (
                <div className="sc-items-grid">
                  {filteredFound
                    .filter((i) => i.status !== "claimed")
                    .map((item) => (
                      <div key={item.id} className="sc-item-card">
                        <div className="sc-item-card__img-wrap">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="sc-item-card__img"
                            />
                          ) : (
                            <div className="sc-item-card__no-img">No image</div>
                          )}
                        </div>
                        <div className="sc-item-card__info">
                          <p className="sc-item-card__name">{item.name}</p>
                          <p className="sc-item-card__desc">
                            {item.description}
                          </p>
                          <p className="sc-item-card__by">
                            Found by {item.author_name}
                          </p>
                          {item.status === "pending" && (
                            <span className="sc-item-card__status sc-item-card__status--pending">
                              Claim Pending
                            </span>
                          )}
                        </div>
                        {(isSchoolAdmin || user?.id === item.author_id) && (
                          <div className="sc-item-card__actions">
                            {user?.id === item.author_id &&
                              item.status === "pending" && (
                                <button
                                  className="sc-btn sc-btn--success sc-btn--sm"
                                  onClick={() => handleMarkClaimed(item.id)}
                                >
                                  Confirm Claimed
                                </button>
                              )}
                            <button
                              className="sc-btn sc-btn--danger sc-btn--sm sc-btn--icon"
                              onClick={() => handleDeleteFound(item.id)}
                            >
                              <FaTrash />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  {filteredFound.filter((i) => i.status !== "claimed")
                    .length === 0 && (
                    <div className="sc-empty">No found items yet.</div>
                  )}
                </div>
              ) : (
                <div className="sc-items-grid">
                  {filteredLost.map((item) => (
                    <div key={item.id} className="sc-item-card">
                      <div className="sc-item-card__img-wrap">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="sc-item-card__img"
                          />
                        ) : (
                          <div className="sc-item-card__no-img">No image</div>
                        )}
                      </div>
                      <div className="sc-item-card__info">
                        <p className="sc-item-card__name">{item.name}</p>
                        <p className="sc-item-card__desc">{item.description}</p>
                        <p className="sc-item-card__by">
                          Lost by {item.author_name}
                        </p>
                      </div>
                      {(isSchoolAdmin || user?.id === item.author_id) && (
                        <div className="sc-item-card__actions">
                          {user?.id === item.author_id && (
                            <button
                              className="sc-btn sc-btn--success sc-btn--sm"
                              onClick={() => handleMarkFound(item.id)}
                            >
                              Mark Found
                            </button>
                          )}
                          <button
                            className="sc-btn sc-btn--danger sc-btn--sm sc-btn--icon"
                            onClick={() => handleDeleteLost(item.id)}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredLost.length === 0 && (
                    <div className="sc-empty">No lost item reports yet.</div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── ADD FOUND ITEM ── */}
          {activeTab === "add-item" && (
            <div className="sc-panel-content">
              <div className="sc-section-title">Report Found Item</div>
              {foundSuccess ? (
                <div className="sc-success">
                  <span className="sc-success__icon"></span>
                  <p>Item posted!</p>
                </div>
              ) : (
                <form className="sc-form" onSubmit={handleAddFound}>
                  <label className="sc-form__label">Item Name</label>
                  <input
                    className="sc-form__input"
                    type="text"
                    placeholder="e.g. Blue water bottle"
                    required
                    value={foundName}
                    onChange={(e) => setFoundName(e.target.value)}
                  />
                  <label className="sc-form__label">Description</label>
                  <textarea
                    className="sc-form__textarea"
                    placeholder="Where did you find it? Any identifying features?"
                    required
                    value={foundDesc}
                    onChange={(e) => setFoundDesc(e.target.value)}
                  />
                  <label className="sc-form__label">Photos (up to 3)</label>
                  <label
                    className="sc-form__file-label"
                    htmlFor="sc-found-upload"
                  >
                    <span className="sc-form__file-icon">+</span>
                    <span>
                      {foundFiles.length > 0
                        ? `${foundFiles.length} photo(s) selected`
                        : "Upload photos"}
                    </span>
                  </label>
                  <input
                    id="sc-found-upload"
                    className="sc-form__file"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      e.target.files &&
                      setFoundFiles(Array.from(e.target.files).slice(0, 3))
                    }
                  />
                  {foundFiles.length > 0 && (
                    <div className="sc-form__previews">
                      {foundFiles.map((file, idx) => (
                        <div key={idx} className="sc-form__preview-wrap">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`preview ${idx + 1}`}
                            className="sc-form__preview"
                          />
                          <button
                            type="button"
                            className="sc-form__preview-remove"
                            onClick={() =>
                              setFoundFiles(
                                foundFiles.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="sc-form__actions">
                    <button
                      type="button"
                      className="sc-btn sc-btn--ghost"
                      onClick={() => setActiveTab("items")}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="sc-btn sc-btn--primary"
                      style={{ background: color, borderColor: color }}
                      disabled={foundUploading}
                    >
                      {foundUploading ? "Posting..." : "Post Item"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ── REPORT LOST ── */}
          {activeTab === "report-lost" && (
            <div className="sc-panel-content">
              <div className="sc-section-title">Report Lost Item</div>
              {lostSuccess ? (
                <div className="sc-success">
                  <span className="sc-success__icon"></span>
                  <p>Lost item reported!</p>
                </div>
              ) : (
                <form className="sc-form" onSubmit={handleAddLost}>
                  <label className="sc-form__label">What did you lose?</label>
                  <input
                    className="sc-form__input"
                    type="text"
                    placeholder="Item name"
                    required
                    value={lostName}
                    onChange={(e) => setLostName(e.target.value)}
                  />
                  <label className="sc-form__label">Description</label>
                  <textarea
                    className="sc-form__textarea"
                    placeholder="When/where did you lose it? Any details?"
                    required
                    value={lostDesc}
                    onChange={(e) => setLostDesc(e.target.value)}
                  />
                  <label className="sc-form__label">
                    Photos (optional, up to 3)
                  </label>
                  <label
                    className="sc-form__file-label"
                    htmlFor="sc-lost-upload"
                  >
                    <span className="sc-form__file-icon">+</span>
                    <span>
                      {lostFiles.length > 0
                        ? `${lostFiles.length} photo(s) selected`
                        : "Upload photos"}
                    </span>
                  </label>
                  <input
                    id="sc-lost-upload"
                    className="sc-form__file"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      e.target.files &&
                      setLostFiles(Array.from(e.target.files).slice(0, 3))
                    }
                  />
                  {lostFiles.length > 0 && (
                    <div className="sc-form__previews">
                      {lostFiles.map((file, idx) => (
                        <div key={idx} className="sc-form__preview-wrap">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`preview ${idx + 1}`}
                            className="sc-form__preview"
                          />
                          <button
                            type="button"
                            className="sc-form__preview-remove"
                            onClick={() =>
                              setLostFiles(
                                lostFiles.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="sc-form__actions">
                    <button
                      type="button"
                      className="sc-btn sc-btn--ghost"
                      onClick={() => setActiveTab("items")}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="sc-btn sc-btn--primary"
                      style={{ background: color, borderColor: color }}
                      disabled={lostUploading}
                    >
                      {lostUploading ? "Posting..." : "Post Lost Item"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ── BECOME ADMIN ── */}
          {activeTab === "become-admin" && (
            <div className="sc-panel-content">
              <div className="sc-section-title">
                Become a {school.name} Admin
              </div>
              {reqDone ? (
                <div className="sc-success">
                  <span className="sc-success__icon"></span>
                  <p>Request submitted!</p>
                  <p className="sc-success__sub">
                    The school's super-admin will review your request.
                  </p>
                </div>
              ) : (
                <form className="sc-form" onSubmit={handleBecomeAdmin}>
                  <label className="sc-form__label">Full Name</label>
                  <input
                    className="sc-form__input"
                    value={user?.fullName || ""}
                    readOnly
                  />
                  <label className="sc-form__label">Email</label>
                  <input
                    className="sc-form__input"
                    value={user?.primaryEmailAddress?.emailAddress || ""}
                    readOnly
                  />
                  <label className="sc-form__label">Teacher / Staff ID</label>
                  <input
                    className="sc-form__input"
                    type="text"
                    placeholder="T-00123"
                    value={reqForm.teacherId}
                    onChange={(e) =>
                      setReqForm((p) => ({ ...p, teacherId: e.target.value }))
                    }
                  />
                  <label className="sc-form__label">Upload ID or Badge</label>
                  <label
                    className="sc-form__file-label"
                    htmlFor="sc-admin-req-upload"
                  >
                    <span className="sc-form__file-icon">+</span>
                    <span>
                      {reqFile ? reqFile.name : "Upload ID or badge photo"}
                    </span>
                  </label>
                  <input
                    id="sc-admin-req-upload"
                    className="sc-form__file"
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      e.target.files?.[0] && setReqFile(e.target.files[0])
                    }
                  />
                  <label className="sc-form__label">Anything else?</label>
                  <textarea
                    className="sc-form__textarea"
                    placeholder="e.g. I manage the lost and found office..."
                    value={reqForm.extraInfo}
                    onChange={(e) =>
                      setReqForm((p) => ({ ...p, extraInfo: e.target.value }))
                    }
                  />
                  <button
                    type="submit"
                    className="sc-btn sc-btn--primary"
                    style={{ background: color, borderColor: color }}
                    disabled={reqSubmitting || !user}
                  >
                    {reqSubmitting ? "Submitting..." : "Submit Request"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ── ADMIN LOGIN ── */}
          {activeTab === "admin-login" && (
            <div className="sc-panel-content">
              <div className="sc-section-title">School Admin Access</div>
              {adminUnlocked ? (
                <div className="sc-success">
                  <span className="sc-success__icon"></span>
                  <p>Admin view unlocked!</p>
                  <p className="sc-success__sub">
                    You can now delete items and manage this school's board.
                  </p>
                </div>
              ) : (
                <form className="sc-form" onSubmit={handleAdminLogin}>
                  <p className="sc-hint">
                    Enter the password from your Findr approval email.
                  </p>
                  <label className="sc-form__label">Admin Password</label>
                  <input
                    className="sc-form__input"
                    type="password"
                    placeholder="e.g. FINDR-JANE-X4K2"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                  />
                  {adminError && <p className="sc-form__error">{adminError}</p>}
                  <button
                    type="submit"
                    className="sc-btn sc-btn--primary"
                    style={{ background: color, borderColor: color }}
                    disabled={adminChecking}
                  >
                    {adminChecking ? "Checking..." : "Unlock Admin View"}
                  </button>
                </form>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SchoolsPage() {
  const { user, isLoaded } = useUser();
  const { language } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // ── Translated strings ──────────────────────────────────────────────────────
  const [aboutText, setAboutText] = useState("About");
  const [enterCodeText, setEnterCodeText] = useState("Enter Code");
  const [mySchoolsText, setMySchoolsText] = useState("My Schools");
  const [registerSchoolText, setRegisterSchoolText] =
    useState("Register School");
  const [yourSchoolsText, setYourSchoolsText] = useState("Your Schools");
  const [schoolBoardsText, setSchoolBoardsText] = useState("School boards");

  type TopTab = "about" | "enter-code" | "my-schools" | "register";

  const [activeTab, setActiveTab] = useState<TopTab>("about");
  const [mySchools, setMySchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) {
      setMySchools([]);
      setLoadingSchools(false);
      return;
    }

    const cachedSchools = readMySchoolsCache(user.id);
    if (cachedSchools) {
      setMySchools(cachedSchools);
      setLoadingSchools(false);
    } else {
      setLoadingSchools(true);
    }

    const fetchMySchools = async () => {
      const { data: memberships } = await supabase
        .from("user_schools")
        .select("school_id")
        .eq("user_id", user.id);
      if (!memberships || memberships.length === 0) {
        setMySchools([]);
        writeMySchoolsCache(user.id, []);
        setLoadingSchools(false);
        return;
      }
      const ids = memberships.map((m: any) => m.school_id);
      const { data: schools } = await supabase
        .from("schools")
        .select("*")
        .in("id", ids)
        .eq("status", "approved");
      if (schools) {
        const nextSchools = schools as School[];
        setMySchools(nextSchools);
        writeMySchoolsCache(user.id, nextSchools);
      }
      setLoadingSchools(false);
    };
    fetchMySchools();
  }, [user]);

  // ── Translation effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (language === "en") {
      setAboutText("About");
      setEnterCodeText("Enter Code");
      setMySchoolsText("My Schools");
      setRegisterSchoolText("Register School");
      setYourSchoolsText("Your Schools");
      setSchoolBoardsText("School boards");
      setIsReady(true);
      return;
    }
    const translateAndCache = async () => {
      const translations = [
        { key: "About", setter: setAboutText, cacheKey: "sc_about" },
        {
          key: "Enter Code",
          setter: setEnterCodeText,
          cacheKey: "sc_enterCode",
        },
        {
          key: "My Schools",
          setter: setMySchoolsText,
          cacheKey: "sc_mySchools",
        },
        {
          key: "Register School",
          setter: setRegisterSchoolText,
          cacheKey: "sc_registerSchool",
        },
        {
          key: "Your Schools",
          setter: setYourSchoolsText,
          cacheKey: "sc_yourSchools",
        },
        {
          key: "School boards",
          setter: setSchoolBoardsText,
          cacheKey: "sc_schoolBoards",
        },
      ];
      for (const { key, setter, cacheKey } of translations) {
        const cached = localStorage.getItem(`${cacheKey}_${language}`);
        if (cached) {
          setter(cached);
          continue;
        }
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: key, target: language }),
          });
          if (res.ok) {
            const data = await res.json();
            const t = data.translatedText || key;
            setter(t);
            localStorage.setItem(`${cacheKey}_${language}`, t);
          }
        } catch {
          /* keep default */
        }
      }
      setIsReady(true);
    };
    translateAndCache();
  }, [language]);

  const handleJoined = (school: School) => {
    setMySchools((prev) => {
      const nextSchools = prev.some((s) => s.id === school.id)
        ? prev
        : [...prev, school];
      if (user?.id) writeMySchoolsCache(user.id, nextSchools);
      return nextSchools;
    });
  };

  const handleLeave = async (school: School) => {
    if (!confirm(`Leave ${school.name}?`)) return;
    await supabase
      .from("user_schools")
      .delete()
      .eq("user_id", user!.id)
      .eq("school_id", school.id);
    setMySchools((prev) => {
      const nextSchools = prev.filter((s) => s.id !== school.id);
      if (user?.id) writeMySchoolsCache(user.id, nextSchools);
      return nextSchools;
    });
    if (selectedSchool?.id === school.id) setSelectedSchool(null);
    localStorage.removeItem(`findr_school_admin_${school.id}`);
  };

  // ── TOP_TABS now consumes translated state vars ──────────────────────────────
  const TOP_TABS: { id: TopTab; label: string; icon: ReactNode }[] = [
    { id: "about", label: aboutText, icon: <FaGraduationCap /> },
    { id: "enter-code", label: enterCodeText, icon: "#" },
    { id: "my-schools", label: mySchoolsText, icon: <FaSchool /> },
    { id: "register", label: registerSchoolText, icon: "+" },
  ];

  if (!mounted || !isLoaded || loadingSchools || !isReady)
    return <LoadingSpinner />;

  // Full board view
  if (selectedSchool) {
    return (
      <SchoolBoard
        school={selectedSchool}
        user={user}
        onBack={() => setSelectedSchool(null)}
      />
    );
  }

  return (
    <div className="sc-page">
      <div className="sc-layout">
        {/* Left sidebar */}
        <aside className="sc-sidebar">
          <div className="sc-sidebar__brand">
            <span className="sc-sidebar__icon">
              {" "}
              <FaGraduationCap></FaGraduationCap>
            </span>
            <div>
              <p className="sc-sidebar__title">Findr Campus</p>
              <p className="sc-sidebar__sub">{schoolBoardsText}</p>
            </div>
          </div>

          <div className="sc-sidebar__tabs">
            {TOP_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`sc-sidebar__tab${activeTab === tab.id ? " sc-sidebar__tab--active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="sc-sidebar__tab-icon">{tab.icon}</span>
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <span className="sc-sidebar__tab-pip" />
                )}
              </button>
            ))}
          </div>

          {/* Quick school switcher */}
          {mySchools.length > 0 && (
            <div className="sc-sidebar__schools">
              <p className="sc-sidebar__schools-label">{yourSchoolsText}</p>
              {mySchools.map((s) => (
                <button
                  key={s.id}
                  className="sc-sidebar__school-btn"
                  style={{ borderLeftColor: s.color }}
                  onClick={() => setSelectedSchool(s)}
                >
                  {s.logo_url ? (
                    <img
                      src={s.logo_url}
                      alt={s.name}
                      className="sc-sidebar__school-logo"
                    />
                  ) : (
                    <div
                      className="sc-sidebar__school-initial"
                      style={{ background: s.color }}
                    >
                      {s.name[0]}
                    </div>
                  )}
                  <span className="sc-sidebar__school-name">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="sc-main">
          <section
            className="sc-tab-panel"
            hidden={activeTab !== "about"}
            aria-hidden={activeTab !== "about"}
          >
            <AboutPanel
              onEnterCode={() => setActiveTab("enter-code")}
              onRegister={() => setActiveTab("register")}
            />
          </section>
          <section
            className="sc-tab-panel"
            hidden={activeTab !== "enter-code"}
            aria-hidden={activeTab !== "enter-code"}
          >
            <EnterCodePanel
              user={user}
              mySchools={mySchools}
              onJoined={handleJoined}
            />
          </section>
          <section
            className="sc-tab-panel"
            hidden={activeTab !== "my-schools"}
            aria-hidden={activeTab !== "my-schools"}
          >
            <MySchoolsPanel
              mySchools={mySchools}
              user={user}
              onSelectSchool={setSelectedSchool}
              onLeave={handleLeave}
            />
          </section>
          <section
            className="sc-tab-panel"
            hidden={activeTab !== "register"}
            aria-hidden={activeTab !== "register"}
          >
            <RegisterSchoolPanel user={user} />
          </section>
        </main>
      </div>
    </div>
  );
}