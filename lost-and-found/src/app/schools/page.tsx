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
      icon: <FaShieldAlt />,
      title: "Private by design",
      body: "Campus boards stay scoped to each school and its verified members.",
    },
    {
      icon: <BsLightningFill />,
      title: "Fast item matching",
      body: "Post found items quickly and surface likely matches before they disappear.",
    },
    {
      icon: <FaSchool />,
      title: "One board per school",
      body: "Keep messages, items, and admin tools organized around the right campus.",
    },
    {
      icon: <FaLock />,
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
  secondary_color: string;
  bg_image_url: string | null;
  gradient_mode: number;
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

// ─── Cache helpers ────────────────────────────────────────────────────────────
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
  } catch {}
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
    )
      return null;
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
  } catch {}
}

// ─── Gradient helpers ─────────────────────────────────────────────────────────
function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function gradStyles(hex: string): string[] {
  return [
    `linear-gradient(to top, ${hexToRgba(hex, 0.97)} 0%, ${hexToRgba(hex, 0.72)} 40%, ${hexToRgba(hex, 0.2)} 75%, transparent 100%)`,
    `linear-gradient(to right, ${hexToRgba(hex, 0.95)} 0%, ${hexToRgba(hex, 0.65)} 50%, ${hexToRgba(hex, 0.1)} 100%)`,
    `linear-gradient(135deg, ${hexToRgba(hex, 0.92)} 0%, ${hexToRgba(hex, 0.5)} 55%, transparent 100%)`,
    `linear-gradient(to bottom, ${hexToRgba(hex, 0.85)} 0%, ${hexToRgba(hex, 0.55)} 100%)`,
  ];
}

// ─── Translation helper ───────────────────────────────────────────────────────
async function fetchTranslation(
  key: string,
  target: string,
  cacheKey: string,
  setter: (val: string) => void,
) {
  const cached = localStorage.getItem(`${cacheKey}_${target}`);
  if (cached) {
    setter(cached);
    return;
  }
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: key, target }),
    });
    if (res.ok) {
      const data = await res.json();
      const translated =
        (data.translatedText as string | undefined)?.trim() || key;
      setter(translated);
      localStorage.setItem(`${cacheKey}_${target}`, translated);
    } else {
      setter(key);
    }
  } catch {
    setter(key);
  }
}

// ─── i18n string types ────────────────────────────────────────────────────────
interface AboutStrings {
  eyebrow: string;
  title: string;
  subtitle: string;
  joinBtn: string;
  registerBtn: string;
  statPrivateLabel: string;
  statPrivateSub: string;
  statFastLabel: string;
  statFastSub: string;
  statTrustedLabel: string;
  statTrustedSub: string;
  carouselTitle: string;
  carouselHint: string;
  feature1Title: string;
  feature1Desc: string;
  feature2Title: string;
  feature2Desc: string;
  feature3Title: string;
  feature3Desc: string;
  feature4Title: string;
  feature4Desc: string;
  registerCtaTitle: string;
  registerCtaDesc: string;
  registerCtaBtn: string;
  heroCardLabel: string;
  heroCardBody: string;
  heroTag1: string;
  heroTag2: string;
  heroTag3: string;
}

interface EnterCodeStrings {
  title: string;
  hint: string;
  codeLabel: string;
  codePlaceholder: string;
  alreadyMember: string;
  notFound: string;
  joinedPrefix: string;
  searchingBtn: string;
  joinBtn: string;
  yourSchoolsTitle: string;
  signInFirst: string;
}

interface RegisterStrings {
  title: string;
  hint: string;
  nameLabel: string;
  namePlaceholder: string;
  websiteLabel: string;
  websitePlaceholder: string;
  roleLabel: string;
  rolePlaceholder: string;
  yourNameLabel: string;
  yourEmailLabel: string;
  logoLabel: string;
  logoUpload: string;
  primaryColorLabel: string;
  secondaryColorLabel: string;
  bgPhotoLabel: string;
  bgPhotoHint: string;
  bgUpload: string;
  gradientLabel: string;
  gradientHint: string;
  headerPreviewLabel: string;
  verifyDocLabel: string;
  verifyDocHint: string;
  verifyDocUpload: string;
  extraLabel: string;
  extraPlaceholder: string;
  submitBtn: string;
  submittingBtn: string;
  signInRequired: string;
  successTitle: string;
  successSub: string;
}

interface MySchoolsStrings {
  title: string;
  signInMsg: string;
  emptyMsg: string;
  viewBoardBtn: string;
  leaveBtn: string;
}

interface BoardStrings {
  backBtn: string;
  adminBadge: string;
  exitAdmin: string;
  itemsTab: string;
  addItemTab: string;
  reportLostTab: string;
  adminTab: string;
  searchPlaceholder: string;
  foundTabLabel: string;
  lostTabLabel: string;
  loadingText: string;
  foundBy: string;
  claimPending: string;
  confirmClaimed: string;
  markFound: string;
  noFoundItems: string;
  noLostItems: string;
  noImage: string;
  lostBy: string;
  reportFoundTitle: string;
  itemNameLabel: string;
  itemNamePlaceholder: string;
  descLabel: string;
  descFoundPlaceholder: string;
  photosLabel: string;
  photosSelected: string;
  uploadPhotos: string;
  cancelBtn: string;
  postItemBtn: string;
  postingBtn: string;
  itemPostedMsg: string;
  reportLostTitle: string;
  whatLostLabel: string;
  lostItemPlaceholder: string;
  descLostPlaceholder: string;
  photosOptionalLabel: string;
  postLostBtn: string;
  postingLostBtn: string;
  lostPostedMsg: string;
  adminLoginTitle: string;
  adminLoginHint: string;
  adminPasswordLabel: string;
  adminPasswordPlaceholder: string;
  unlockBtn: string;
  checkingBtn: string;
  adminUnlockedMsg: string;
  adminUnlockedSub: string;
  adminIncorrect: string;
}

// ─── About / Landing Panel ────────────────────────────────────────────────────
function AboutPanel({
  onEnterCode,
  onRegister,
  s,
}: {
  onEnterCode: () => void;
  onRegister?: () => void;
  s: AboutStrings;
}) {
  return (
    <div className="sc-about">
      <section className="sc-about__hero">
        <div className="sc-about__hero-copy">
          <p className="sc-about__eyebrow">{s.eyebrow}</p>
          <h1 className="sc-about__title">{s.title}</h1>
          <p className="sc-about__subtitle">{s.subtitle}</p>
          <div className="sc-about__cta-row">
            <button
              className="sc-btn sc-btn--primary sc-about__cta"
              onClick={onEnterCode}
            >
              {s.joinBtn}
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
              {s.registerBtn}
            </button>
          </div>

          <div className="sc-about__stats">
            <div className="sc-about__stat">
              <strong>{s.statPrivateLabel}</strong>
              <span>{s.statPrivateSub}</span>
            </div>
            <div className="sc-about__stat">
              <strong>{s.statFastLabel}</strong>
              <span>{s.statFastSub}</span>
            </div>
            <div className="sc-about__stat">
              <strong>{s.statTrustedLabel}</strong>
              <span>{s.statTrustedSub}</span>
            </div>
          </div>
        </div>

        <div className="sc-about__hero-visual" aria-hidden="true">
          <div className="sc-about__orb sc-about__orb--one" />
          <div className="sc-about__orb sc-about__orb--two" />
          <div className="sc-about__hero-card">
            <p className="sc-about__hero-label">{s.heroCardLabel}</p>
            <h2>Hillcrest High School</h2>
            <p>{s.heroCardBody}</p>
            <div className="sc-about__hero-tags">
              <span>{s.heroTag1}</span>
              <span>{s.heroTag2}</span>
              <span>{s.heroTag3}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="sc-about__carousel-section">
        <div className="sc-section-title">{s.carouselTitle}</div>
        <p className="sc-hint sc-about__carousel-hint">{s.carouselHint}</p>
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
            icon: <FaGraduationCap />,
            title: s.feature1Title,
            desc: s.feature1Desc,
          },
          {
            icon: <BsLightningFill />,
            title: s.feature2Title,
            desc: s.feature2Desc,
          },
          {
            icon: <FaShieldAlt />,
            title: s.feature3Title,
            desc: s.feature3Desc,
          },
          {
            icon: <FaLock />,
            title: s.feature4Title,
            desc: s.feature4Desc,
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
        <h2>{s.registerCtaTitle}</h2>
        <p>{s.registerCtaDesc}</p>
        <button
          className="sc-btn sc-btn--secondary"
          onClick={() => {
            if (onRegister) return onRegister();
            document
              .querySelector("#register-anchor")
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        >
          {s.registerCtaBtn}
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
  s,
}: {
  user: any;
  mySchools: School[];
  onJoined: (school: School) => void;
  s: EnterCodeStrings;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError(s.signInFirst);
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
      setError(s.notFound);
      setLoading(false);
      return;
    }

    if (mySchools.some((s) => s.id === school.id)) {
      setError(s.alreadyMember);
      setLoading(false);
      return;
    }

    const { error: joinErr } = await supabase
      .from("user_schools")
      .insert({ user_id: user.id, school_id: school.id });

    if (joinErr) {
      setError("Something went wrong. Try again.");
    } else {
      setSuccess(`${s.joinedPrefix} ${school.name}!`);
      onJoined(school as School);
      setCode("");
    }
    setLoading(false);
  };

  return (
    <div className="sc-panel-content">
      <div className="sc-section-title">{s.title}</div>
      <p className="sc-hint">{s.hint}</p>

      <form className="sc-form" onSubmit={handleJoin}>
        <label className="sc-form__label">{s.codeLabel}</label>
        <input
          className="sc-form__input sc-form__input--code"
          type="text"
          placeholder={s.codePlaceholder}
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
          {loading ? s.searchingBtn : s.joinBtn}
        </button>
      </form>

      {mySchools.length > 0 && (
        <>
          <div className="sc-section-title" style={{ marginTop: "2rem" }}>
            {s.yourSchoolsTitle}
          </div>
          <div className="sc-school-list">
            {mySchools.map((sc) => (
              <div
                key={sc.id}
                className="sc-school-chip"
                style={{ borderLeftColor: sc.color }}
              >
                {sc.logo_url ? (
                  <img
                    src={sc.logo_url}
                    alt={sc.name}
                    className="sc-school-chip__logo"
                  />
                ) : (
                  <div
                    className="sc-school-chip__initial"
                    style={{ background: sc.color }}
                  >
                    {sc.name[0]}
                  </div>
                )}
                <span className="sc-school-chip__name">{sc.name}</span>
                <span className="sc-school-chip__code">{sc.code}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Register School Panel ────────────────────────────────────────────────────
function RegisterSchoolPanel({
  user,
  s,
}: {
  user: any;
  s: RegisterStrings;
}) {
  const { theme } = useSettings();
  const [form, setForm] = useState({
    name: "",
    websiteUrl: "",
    repRole: "",
    extraInfo: "",
    color: "#2f80ed",
    secondaryColor: "#f5c842",
    gradientMode: 0,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    return () => {
      if (bgPreviewUrl) URL.revokeObjectURL(bgPreviewUrl);
    };
  }, [bgPreviewUrl]);

  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (bgPreviewUrl) URL.revokeObjectURL(bgPreviewUrl);
    setBgFile(file);
    setBgPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    let logoUrl = "";
    let docUrl = "";
    let bgImageUrl = "";

    if (logoFile) {
      const fn = `school_logo_${Date.now()}_${logoFile.name}`;
      await supabase.storage.from("item-images").upload(fn, logoFile);
      const { data } = supabase.storage.from("item-images").getPublicUrl(fn);
      logoUrl = data.publicUrl;
    }

    if (bgFile) {
      const fn = `school_bg_${Date.now()}_${bgFile.name}`;
      const { error: bgErr } = await supabase.storage
        .from("item-images")
        .upload(fn, bgFile);
      console.log("bg upload error:", bgErr);
      const { data } = supabase.storage.from("item-images").getPublicUrl(fn);
      console.log("bg image url:", data.publicUrl);
      bgImageUrl = data.publicUrl;
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
      secondary_color: form.secondaryColor,
      bg_image_url: bgImageUrl || null,
      gradient_mode: form.gradientMode,
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
          <span className="sc-success__icon">✓</span>
          <p>{s.successTitle}</p>
          <p className="sc-success__sub">{s.successSub}</p>
        </div>
      </div>
    );
  }

  const gradOpts = gradStyles(form.color);

  return (
    <div className="sc-panel-content" id="register-anchor">
      <div className="sc-section-title">{s.title}</div>
      <p className="sc-hint">{s.hint}</p>
      <form className="sc-form" onSubmit={handleSubmit}>
        <label className="sc-form__label">{s.nameLabel}</label>
        <input
          className="sc-form__input"
          type="text"
          placeholder={s.namePlaceholder}
          required
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />

        <label className="sc-form__label">{s.websiteLabel}</label>
        <input
          className="sc-form__input"
          type="url"
          placeholder={s.websitePlaceholder}
          value={form.websiteUrl}
          onChange={(e) =>
            setForm((p) => ({ ...p, websiteUrl: e.target.value }))
          }
        />

        <label className="sc-form__label">{s.roleLabel}</label>
        <input
          className="sc-form__input"
          type="text"
          placeholder={s.rolePlaceholder}
          required
          value={form.repRole}
          onChange={(e) => setForm((p) => ({ ...p, repRole: e.target.value }))}
        />

        <label className="sc-form__label">{s.yourNameLabel}</label>
        <input
          className="sc-form__input"
          type="text"
          value={user?.fullName || ""}
          readOnly
        />

        <label className="sc-form__label">{s.yourEmailLabel}</label>
        <input
          className="sc-form__input"
          type="email"
          value={user?.primaryEmailAddress?.emailAddress || ""}
          readOnly
        />

        <label className="sc-form__label">{s.logoLabel}</label>
        <label className="sc-form__file-label" htmlFor="school-logo-upload">
          <span className="sc-form__file-icon">+</span>
          <span>{logoFile ? logoFile.name : s.logoUpload}</span>
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

        <label className="sc-form__label">{s.primaryColorLabel}</label>
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

        <label className="sc-form__label">{s.secondaryColorLabel}</label>
        <div className="sc-color-row">
          <input
            type="color"
            className="sc-color-picker"
            value={form.secondaryColor}
            onChange={(e) =>
              setForm((p) => ({ ...p, secondaryColor: e.target.value }))
            }
          />
          <span className="sc-color-value">{form.secondaryColor}</span>
          <div
            className="sc-color-preview"
            style={{ background: form.secondaryColor }}
          />
        </div>

        <label className="sc-form__label">{s.bgPhotoLabel}</label>
        <p className="sc-form__hint">{s.bgPhotoHint}</p>
        <label className="sc-form__file-label" htmlFor="school-bg-upload">
          <span className="sc-form__file-icon">+</span>
          <span>{bgFile ? bgFile.name : s.bgUpload}</span>
        </label>
        <input
          id="school-bg-upload"
          className="sc-form__file"
          type="file"
          accept="image/*"
          onChange={handleBgChange}
        />

        <label className="sc-form__label">{s.gradientLabel}</label>
        <p className="sc-form__hint">{s.gradientHint}</p>
        <div className="sc-gradient-row">
          {gradOpts.map((grad, n) => (
            <button
              key={n}
              type="button"
              className={`sc-gradient-opt${form.gradientMode === n ? " sc-gradient-opt--active" : ""}`}
              style={{
                backgroundImage: bgPreviewUrl
                  ? `${grad}, url(${bgPreviewUrl})`
                  : grad,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: form.color,
                borderColor: form.gradientMode === n ? form.color : undefined,
              }}
              onClick={() => setForm((p) => ({ ...p, gradientMode: n }))}
              title={["Bottom-up", "Left sweep", "Diagonal", "Top-down"][n]}
            />
          ))}
        </div>

        {(bgPreviewUrl || form.name) && (
          <>
            <label className="sc-form__label">{s.headerPreviewLabel}</label>
            <div
              className="sc-register__preview"
              style={{
                backgroundImage: bgPreviewUrl
                  ? `${gradOpts[form.gradientMode]}, url(${bgPreviewUrl})`
                  : gradOpts[form.gradientMode],
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div
                className="sc-register__preview-badge"
                style={{
                  background: hexToRgba(form.secondaryColor, 0.25),
                  border: `1px solid ${hexToRgba(form.secondaryColor, 0.6)}`,
                  color: "#fff",
                }}
              >
                Findr Campus
              </div>
              <p className="sc-register__preview-name">
                {form.name || "Your School Name"}
              </p>
              <p className="sc-register__preview-code">
                {form.websiteUrl || "campus board"}
              </p>
            </div>
          </>
        )}

        <label className="sc-form__label">{s.verifyDocLabel}</label>
        <p className="sc-form__hint">{s.verifyDocHint}</p>
        <label className="sc-form__file-label" htmlFor="school-doc-upload">
          <span className="sc-form__file-icon">+</span>
          <span>{docFile ? docFile.name : s.verifyDocUpload}</span>
        </label>
        <input
          id="school-doc-upload"
          className="sc-form__file"
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => e.target.files?.[0] && setDocFile(e.target.files[0])}
        />

        <label className="sc-form__label">{s.extraLabel}</label>
        <textarea
          className="sc-form__textarea"
          placeholder={s.extraPlaceholder}
          value={form.extraInfo}
          onChange={(e) =>
            setForm((p) => ({ ...p, extraInfo: e.target.value }))
          }
        />

        <button
          type="submit"
          className="sc-btn sc-btn--primary sc-form__submit"
          disabled={submitting || !user}
          style={{ background: form.color, borderColor: form.color }}
        >
          {submitting ? s.submittingBtn : s.submitBtn}
        </button>
        {!user && <p className="sc-form__error">{s.signInRequired}</p>}
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
  s,
}: {
  mySchools: School[];
  user: any;
  onSelectSchool: (school: School) => void;
  onLeave: (school: School) => void;
  s: MySchoolsStrings;
}) {
  if (!user) {
    return (
      <div className="sc-panel-content">
        <p className="sc-empty">{s.signInMsg}</p>
      </div>
    );
  }

  if (mySchools.length === 0) {
    return (
      <div className="sc-panel-content">
        <p className="sc-empty">{s.emptyMsg}</p>
      </div>
    );
  }

  return (
    <div className="sc-panel-content">
      <div className="sc-section-title">{s.title}</div>
      <div className="sc-school-cards">
        {mySchools.map((school) => (
          <div
            key={school.id}
            className="sc-school-card"
            style={
              {
                "--sc-color": school.color,
                "--sc-color-2": school.secondary_color ?? "#f5c842",
              } as React.CSSProperties
            }
          >
            <div
              className="sc-school-card__accent"
              style={{
                background: `linear-gradient(90deg, ${school.color}, ${school.secondary_color ?? school.color})`,
              }}
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
                  {s.viewBoardBtn}
                </button>
                <button
                  className="sc-btn sc-btn--ghost"
                  onClick={() => onLeave(school)}
                >
                  {s.leaveBtn}
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
  s,
}: {
  school: School;
  user: any;
  onBack: () => void;
  s: BoardStrings;
}) {
  type BoardTab = "items" | "add-item" | "report-lost" | "admin-login";

  const router = useRouter();

  const BOARD_TABS: { id: BoardTab; label: string; icon: string }[] = [
    { id: "items", label: s.itemsTab, icon: "" },
    { id: "add-item", label: s.addItemTab, icon: "" },
    { id: "report-lost", label: s.reportLostTab, icon: "" },
    { id: "admin-login", label: s.adminTab, icon: "" },
  ];

  const [activeTab, setActiveTab] = useState<BoardTab>("items");
  const [boardTab, setBoardTab] = useState<"found" | "lost">("found");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<SchoolItem[]>([]);
  const [lostItems, setLostItems] = useState<SchoolLostItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);

  const color = school.color;
  const color2 = school.secondary_color ?? "#f5c842";
  const gradOverlay = gradStyles(color)[school.gradient_mode ?? 0];
  const hasBg = !!school.bg_image_url;

  useEffect(() => {
    setIsSchoolAdmin(
      localStorage.getItem(`findr_school_admin_${school.id}`) === "true",
    );
  }, [school.id]);

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

  // ── Add Found Item ──────────────────────────────────────────────────────────
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

  // ── Add Lost Item ───────────────────────────────────────────────────────────
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

  // ── Admin login ─────────────────────────────────────────────────────────────
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminChecking, setAdminChecking] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminChecking(true);
    setAdminError("");

    const { data: schoolRow } = await supabase
      .from("schools")
      .select("password")
      .eq("id", school.id)
      .maybeSingle();

    const repMatch =
      schoolRow?.password && schoolRow.password === adminPassword;

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
      setAdminError(s.adminIncorrect);
    } else {
      localStorage.setItem(`findr_school_admin_${school.id}`, "true");
      setIsSchoolAdmin(true);
      setAdminUnlocked(true);
    }
    setAdminChecking(false);
  };

  // ── Admin delete / status actions ───────────────────────────────────────────
  const handleDeleteFound = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this item permanently?")) return;
    await supabase.from("school_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };
  const handleDeleteLost = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this lost item?")) return;
    await supabase.from("school_lost_items").delete().eq("id", id);
    setLostItems((prev) => prev.filter((i) => i.id !== id));
  };
  const handleMarkClaimed = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await supabase.from("school_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };
  const handleMarkFound = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
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
      style={
        {
          "--sc-color": color,
          "--sc-color-2": color2,
        } as React.CSSProperties
      }
    >
      {/* ── School header banner ── */}
      <div
        className="sc-board__header"
        style={{
          borderBottomColor: color,
          ...(hasBg ? { minHeight: 120, height: 120 } : {}),
        }}
      >
        <button
          className="sc-board__back"
          onClick={onBack}
          style={
            hasBg
              ? {
                  background: "rgba(0,0,0,0.3)",
                  color: "#fff",
                  borderColor: "rgba(255,255,255,0.3)",
                }
              : {}
          }
        >
          {s.backBtn}
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
            <p
              className="sc-board__name"
              style={
                hasBg
                  ? { color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }
                  : {}
              }
            >
              {school.name}
            </p>
            <p
              className="sc-board__code"
              style={hasBg ? { color: "rgba(255,255,255,0.75)" } : {}}
            >
              {school.code}
            </p>
          </div>
        </div>
        {isSchoolAdmin && (
          <div
            className="sc-admin-badge"
            style={{
              background: hexToRgba(color2, 0.2),
              borderColor: color2,
              color: hasBg ? "#fff" : undefined,
            }}
          >
            {s.adminBadge}
            <button
              className="sc-admin-badge__exit"
              onClick={() => {
                localStorage.removeItem(`findr_school_admin_${school.id}`);
                setIsSchoolAdmin(false);
              }}
            >
              {s.exitAdmin}
            </button>
          </div>
        )}
      </div>

      {/* ── Board layout: sidebar + main ── */}
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
                  style={{ background: color2 }}
                />
              )}
            </button>
          ))}
        </aside>

        <main
          className="sc-board__main"
          style={
            hasBg
              ? {
                  backgroundImage: `${gradOverlay}, url(${school.bg_image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {}
          }
        >
          {/* ── ITEMS TAB ── */}
          {activeTab === "items" && (
            <>
              <div className="sc-search-row">
                <div className="sc-search-wrap">
                  <input
                    className="sc-search"
                    placeholder={s.searchPlaceholder}
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
                      ? `${s.foundTabLabel} (${filteredFound.filter((i) => i.status !== "claimed").length})`
                      : `${s.lostTabLabel} (${filteredLost.length})`}
                  </button>
                ))}
              </div>

              {loadingItems ? (
                <div className="sc-empty">{s.loadingText}</div>
              ) : boardTab === "found" ? (
                <div className="sc-items-grid">
                  {filteredFound
                    .filter((i) => i.status !== "claimed")
                    .map((item) => (
                      <div
                        key={item.id}
                        className="sc-item-card sc-item-card--clickable"
                        onClick={() => router.push(`/school-items/${item.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            router.push(`/school-items/${item.id}`);
                        }}
                      >
                        <div className="sc-item-card__img-wrap">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="sc-item-card__img"
                            />
                          ) : (
                            <div className="sc-item-card__no-img">
                              {s.noImage}
                            </div>
                          )}
                        </div>
                        <div className="sc-item-card__info">
                          <p className="sc-item-card__name">{item.name}</p>
                          <p className="sc-item-card__desc">
                            {item.description}
                          </p>
                          <p className="sc-item-card__by">
                            {s.foundBy} {item.author_name}
                          </p>
                          {item.status === "pending" && (
                            <span className="sc-item-card__status sc-item-card__status--pending">
                              {s.claimPending}
                            </span>
                          )}
                        </div>
                        {(isSchoolAdmin || user?.id === item.author_id) && (
                          <div className="sc-item-card__actions">
                            {user?.id === item.author_id &&
                              item.status === "pending" && (
                                <button
                                  className="sc-btn sc-btn--success sc-btn--sm"
                                  onClick={(e) =>
                                    handleMarkClaimed(e, item.id)
                                  }
                                >
                                  {s.confirmClaimed}
                                </button>
                              )}
                            <button
                              className="sc-btn sc-btn--danger sc-btn--sm sc-btn--icon"
                              onClick={(e) => handleDeleteFound(e, item.id)}
                            >
                              <FaTrash />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  {filteredFound.filter((i) => i.status !== "claimed")
                    .length === 0 && (
                    <div className="sc-empty">{s.noFoundItems}</div>
                  )}
                </div>
              ) : (
                <div className="sc-items-grid">
                  {filteredLost.map((item) => (
                    <div
                      key={item.id}
                      className="sc-item-card sc-item-card--clickable"
                      onClick={() => router.push(`/school-items/${item.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          router.push(`/school-items/${item.id}`);
                      }}
                    >
                      <div className="sc-item-card__img-wrap">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="sc-item-card__img"
                          />
                        ) : (
                          <div className="sc-item-card__no-img">
                            {s.noImage}
                          </div>
                        )}
                      </div>
                      <div className="sc-item-card__info">
                        <p className="sc-item-card__name">{item.name}</p>
                        <p className="sc-item-card__desc">{item.description}</p>
                        <p className="sc-item-card__by">
                          {s.lostBy} {item.author_name}
                        </p>
                      </div>
                      {(isSchoolAdmin || user?.id === item.author_id) && (
                        <div className="sc-item-card__actions">
                          {user?.id === item.author_id && (
                            <button
                              className="sc-btn sc-btn--success sc-btn--sm"
                              onClick={(e) => handleMarkFound(e, item.id)}
                            >
                              {s.markFound}
                            </button>
                          )}
                          <button
                            className="sc-btn sc-btn--danger sc-btn--sm sc-btn--icon"
                            onClick={(e) => handleDeleteLost(e, item.id)}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredLost.length === 0 && (
                    <div className="sc-empty">{s.noLostItems}</div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── ADD FOUND ITEM ── */}
          {activeTab === "add-item" && (
            <div className="sc-panel-content">
              <div className="sc-section-title">{s.reportFoundTitle}</div>
              {foundSuccess ? (
                <div className="sc-success">
                  <span className="sc-success__icon">✓</span>
                  <p>{s.itemPostedMsg}</p>
                </div>
              ) : (
                <form className="sc-form" onSubmit={handleAddFound}>
                  <label className="sc-form__label">{s.itemNameLabel}</label>
                  <input
                    className="sc-form__input"
                    type="text"
                    placeholder={s.itemNamePlaceholder}
                    required
                    value={foundName}
                    onChange={(e) => setFoundName(e.target.value)}
                  />
                  <label className="sc-form__label">{s.descLabel}</label>
                  <textarea
                    className="sc-form__textarea"
                    placeholder={s.descFoundPlaceholder}
                    required
                    value={foundDesc}
                    onChange={(e) => setFoundDesc(e.target.value)}
                  />
                  <label className="sc-form__label">{s.photosLabel}</label>
                  <label
                    className="sc-form__file-label"
                    htmlFor="sc-found-upload"
                  >
                    <span className="sc-form__file-icon">+</span>
                    <span>
                      {foundFiles.length > 0
                        ? `${foundFiles.length} ${s.photosSelected}`
                        : s.uploadPhotos}
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
                      {s.cancelBtn}
                    </button>
                    <button
                      type="submit"
                      className="sc-btn sc-btn--primary"
                      style={{ background: color, borderColor: color }}
                      disabled={foundUploading}
                    >
                      {foundUploading ? s.postingBtn : s.postItemBtn}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ── REPORT LOST ── */}
          {activeTab === "report-lost" && (
            <div className="sc-panel-content">
              <div className="sc-section-title">{s.reportLostTitle}</div>
              {lostSuccess ? (
                <div className="sc-success">
                  <span className="sc-success__icon">✓</span>
                  <p>{s.lostPostedMsg}</p>
                </div>
              ) : (
                <form className="sc-form" onSubmit={handleAddLost}>
                  <label className="sc-form__label">{s.whatLostLabel}</label>
                  <input
                    className="sc-form__input"
                    type="text"
                    placeholder={s.lostItemPlaceholder}
                    required
                    value={lostName}
                    onChange={(e) => setLostName(e.target.value)}
                  />
                  <label className="sc-form__label">{s.descLabel}</label>
                  <textarea
                    className="sc-form__textarea"
                    placeholder={s.descLostPlaceholder}
                    required
                    value={lostDesc}
                    onChange={(e) => setLostDesc(e.target.value)}
                  />
                  <label className="sc-form__label">
                    {s.photosOptionalLabel}
                  </label>
                  <label
                    className="sc-form__file-label"
                    htmlFor="sc-lost-upload"
                  >
                    <span className="sc-form__file-icon">+</span>
                    <span>
                      {lostFiles.length > 0
                        ? `${lostFiles.length} ${s.photosSelected}`
                        : s.uploadPhotos}
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
                      {s.cancelBtn}
                    </button>
                    <button
                      type="submit"
                      className="sc-btn sc-btn--primary"
                      style={{ background: color, borderColor: color }}
                      disabled={lostUploading}
                    >
                      {lostUploading ? s.postingLostBtn : s.postLostBtn}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ── ADMIN LOGIN ── */}
          {activeTab === "admin-login" && (
            <div className="sc-panel-content">
              <div className="sc-section-title">{s.adminLoginTitle}</div>
              {adminUnlocked ? (
                <div className="sc-success">
                  <span className="sc-success__icon">✓</span>
                  <p>{s.adminUnlockedMsg}</p>
                  <p className="sc-success__sub">{s.adminUnlockedSub}</p>
                </div>
              ) : (
                <form className="sc-form" onSubmit={handleAdminLogin}>
                  <p className="sc-hint">{s.adminLoginHint}</p>
                  <label className="sc-form__label">
                    {s.adminPasswordLabel}
                  </label>
                  <input
                    className="sc-form__input"
                    type="password"
                    placeholder={s.adminPasswordPlaceholder}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                  />
                  {adminError && (
                    <p className="sc-form__error">{adminError}</p>
                  )}
                  <button
                    type="submit"
                    className="sc-btn sc-btn--primary"
                    style={{ background: color, borderColor: color }}
                    disabled={adminChecking}
                  >
                    {adminChecking ? s.checkingBtn : s.unlockBtn}
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

// ─── Default English string objects ──────────────────────────────────────────
const DEFAULT_ABOUT: AboutStrings = {
  eyebrow: "Campus lost & found",
  title: "Findr for Schools",
  subtitle:
    "A private school board for lost items, announcements, and matching. Students and staff only see what belongs to their campus.",
  joinBtn: "Join Your School",
  registerBtn: "Register a School",
  statPrivateLabel: "Private",
  statPrivateSub: "school-code access",
  statFastLabel: "Fast",
  statFastSub: "item matching flow",
  statTrustedLabel: "Trusted",
  statTrustedSub: "admin-scoped controls",
  carouselTitle: "Built to feel alive",
  carouselHint:
    "Smooth motion, bold cards, and a campus-first layout that helps you reconnect with your lost items and your community.",
  feature1Title: "Branded campus space",
  feature1Desc: "Each school can feel unique with its own color, logo, and tone.",
  feature2Title: "Real-time momentum",
  feature2Desc:
    "Fast posting and scanning keep the board moving instead of stale.",
  feature3Title: "School-scoped privacy",
  feature3Desc: "Members only see the board that belongs to their campus.",
  feature4Title: "Admin controls",
  feature4Desc: "Trusted staff manage their own board without affecting others.",
  registerCtaTitle: "Is your school not on Findr yet?",
  registerCtaDesc:
    "Submit a registration request and a Findr super-admin will review it within 48 hours.",
  registerCtaBtn: "Register Your School",
  heroCardLabel: "Featured campus board",
  heroCardBody:
    "Live updates, polished branding, and one place for everything that gets lost between classes.",
  heroTag1: "Found items",
  heroTag2: "Admin tools",
  heroTag3: "Campus chat",
};

const DEFAULT_ENTER_CODE: EnterCodeStrings = {
  title: "Enter School Code",
  hint: "Your school administrator will give you a unique code. Codes are case-insensitive.",
  codeLabel: "School Code",
  codePlaceholder: "e.g. LINCOLN-2025",
  alreadyMember: "You're already a member of this school.",
  notFound:
    "No approved school found with that code. Double-check and try again.",
  joinedPrefix: "You've joined",
  searchingBtn: "Searching...",
  joinBtn: "Join School",
  yourSchoolsTitle: "Your Schools",
  signInFirst: "Sign in first.",
};

const DEFAULT_REGISTER: RegisterStrings = {
  title: "Register Your School",
  hint: "Fill in your institution's details. A super-admin will review and approve your school, then send you a unique access code.",
  nameLabel: "School / Institution Name *",
  namePlaceholder: "Lincoln High School",
  websiteLabel: "Website URL",
  websitePlaceholder: "https://lincolnhs.edu",
  roleLabel: "Your Role at the Institution *",
  rolePlaceholder: "e.g. Principal, IT Coordinator, Dean",
  yourNameLabel: "Your Name",
  yourEmailLabel: "Your Email",
  logoLabel: "School Logo",
  logoUpload: "Upload school logo",
  primaryColorLabel: "School Primary Brand Color",
  secondaryColorLabel: "Secondary / Accent Color",
  bgPhotoLabel: "Campus Background Photo",
  bgPhotoHint:
    "Upload a campus photo — your primary color gradient will be overlaid on the board header automatically.",
  bgUpload: "Upload campus photo",
  gradientLabel: "Gradient Style",
  gradientHint:
    "Pick how your primary color fades over the campus photo.",
  headerPreviewLabel: "Header Preview",
  verifyDocLabel: "Verification Document (optional)",
  verifyDocHint:
    "Official letterhead, employee ID scan, or any document showing your affiliation.",
  verifyDocUpload: "Upload verification doc",
  extraLabel: "Anything else?",
  extraPlaceholder: "e.g. We have 2000 students across 3 campuses...",
  submitBtn: "Submit Registration",
  submittingBtn: "Submitting...",
  signInRequired: "Sign in to submit a registration.",
  successTitle: "Registration submitted!",
  successSub:
    "A Findr super-admin will review within 48 hours and email you the school code.",
};

const DEFAULT_MY_SCHOOLS: MySchoolsStrings = {
  title: "My Schools",
  signInMsg: "Sign in to see your schools.",
  emptyMsg:
    "You haven't joined any schools yet. Enter your school code to get started.",
  viewBoardBtn: "View Board →",
  leaveBtn: "Leave",
};

const DEFAULT_BOARD: BoardStrings = {
  backBtn: "← Back",
  adminBadge: "School Admin",
  exitAdmin: "Exit",
  itemsTab: "Items",
  addItemTab: "Report Found",
  reportLostTab: "Report Lost",
  adminTab: "Admin",
  searchPlaceholder: "Search items...",
  foundTabLabel: "Found Items",
  lostTabLabel: "Lost Items",
  loadingText: "Loading...",
  foundBy: "Found by",
  claimPending: "Claim Pending",
  confirmClaimed: "Confirm Claimed",
  markFound: "Mark Found",
  noFoundItems: "No found items yet.",
  noLostItems: "No lost item reports yet.",
  noImage: "No image",
  lostBy: "Lost by",
  reportFoundTitle: "Report Found Item",
  itemNameLabel: "Item Name",
  itemNamePlaceholder: "e.g. Blue water bottle",
  descLabel: "Description",
  descFoundPlaceholder: "Where did you find it? Any identifying features?",
  photosLabel: "Photos (up to 3)",
  photosSelected: "photo(s) selected",
  uploadPhotos: "Upload photos",
  cancelBtn: "Cancel",
  postItemBtn: "Post Item",
  postingBtn: "Posting...",
  itemPostedMsg: "Item posted!",
  reportLostTitle: "Report Lost Item",
  whatLostLabel: "What did you lose?",
  lostItemPlaceholder: "Item name",
  descLostPlaceholder: "When/where did you lose it? Any details?",
  photosOptionalLabel: "Photos (optional, up to 3)",
  postLostBtn: "Post Lost Item",
  postingLostBtn: "Posting...",
  lostPostedMsg: "Lost item reported!",
  adminLoginTitle: "School Admin Access",
  adminLoginHint: "Enter the password from your Findr approval email.",
  adminPasswordLabel: "Admin Password",
  adminPasswordPlaceholder: "e.g. FINDR-JANE-X4K2",
  unlockBtn: "Unlock Admin View",
  checkingBtn: "Checking...",
  adminUnlockedMsg: "Admin view unlocked!",
  adminUnlockedSub:
    "You can now delete items and manage this school's board.",
  adminIncorrect: "Incorrect password or not approved yet.",
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SchoolsPage() {
  const { user, isLoaded } = useUser();
  const { language } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [aboutTabText, setAboutTabText] = useState("About");
  const [enterCodeTabText, setEnterCodeTabText] = useState("Enter Code");
  const [mySchoolsTabText, setMySchoolsTabText] = useState("My Schools");
  const [registerTabText, setRegisterTabText] = useState("Register School");
  const [yourSchoolsText, setYourSchoolsText] = useState("Your Schools");
  const [schoolBoardsText, setSchoolBoardsText] = useState("Your School boards");

  const [aboutStrings, setAboutStrings] =
    useState<AboutStrings>(DEFAULT_ABOUT);
  const [enterCodeStrings, setEnterCodeStrings] =
    useState<EnterCodeStrings>(DEFAULT_ENTER_CODE);
  const [registerStrings, setRegisterStrings] =
    useState<RegisterStrings>(DEFAULT_REGISTER);
  const [mySchoolsStrings, setMySchoolsStrings] =
    useState<MySchoolsStrings>(DEFAULT_MY_SCHOOLS);
  const [boardStrings, setBoardStrings] =
    useState<BoardStrings>(DEFAULT_BOARD);

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

  // ── Translation effect ────────────────────────────────────────────────────
  useEffect(() => {
    if (language === "en") {
      setAboutTabText("About");
      setEnterCodeTabText("Enter Code");
      setMySchoolsTabText("My Schools");
      setRegisterTabText("Register School");
      setYourSchoolsText("Your Schools");
      setSchoolBoardsText("Your School boards");
      setAboutStrings(DEFAULT_ABOUT);
      setEnterCodeStrings(DEFAULT_ENTER_CODE);
      setRegisterStrings(DEFAULT_REGISTER);
      setMySchoolsStrings(DEFAULT_MY_SCHOOLS);
      setBoardStrings(DEFAULT_BOARD);
      setIsReady(true);
      return;
    }

    const translateAll = async () => {
      const t = (
        key: string,
        cacheKey: string,
        setter: (val: string) => void,
      ) => fetchTranslation(key, language, cacheKey, setter);

      const navPromises = [
        t("About", "sc_tab_about", setAboutTabText),
        t("Enter Code", "sc_tab_enterCode", setEnterCodeTabText),
        t("My Schools", "sc_tab_mySchools", setMySchoolsTabText),
        t("Register School", "sc_tab_registerSchool", setRegisterTabText),
        t("Your Schools", "sc_sidebar_yourSchools", setYourSchoolsText),
        t("Your School Boards", "sc_sidebar_schoolBoards", setSchoolBoardsText),
      ];

      const aboutSetters: [keyof AboutStrings, string, string][] = [
        ["eyebrow", "Campus lost & found", "sc_about_eyebrow"],
        ["title", "Findr for Schools", "sc_about_title"],
        ["subtitle", DEFAULT_ABOUT.subtitle, "sc_about_subtitle"],
        ["joinBtn", "Join Your School", "sc_about_joinBtn"],
        ["registerBtn", "Register a School", "sc_about_registerBtn"],
        ["statPrivateLabel", "Private", "sc_about_statPrivateLabel"],
        ["statPrivateSub", "school-code access", "sc_about_statPrivateSub"],
        ["statFastLabel", "Fast", "sc_about_statFastLabel"],
        ["statFastSub", "item matching flow", "sc_about_statFastSub"],
        ["statTrustedLabel", "Trusted", "sc_about_statTrustedLabel"],
        ["statTrustedSub", "admin-scoped controls", "sc_about_statTrustedSub"],
        ["carouselTitle", "Built to feel alive", "sc_about_carouselTitle"],
        ["carouselHint", DEFAULT_ABOUT.carouselHint, "sc_about_carouselHint"],
        ["feature1Title", "Branded campus space", "sc_about_feature1Title"],
        ["feature1Desc", DEFAULT_ABOUT.feature1Desc, "sc_about_feature1Desc"],
        ["feature2Title", "Real-time momentum", "sc_about_feature2Title"],
        ["feature2Desc", DEFAULT_ABOUT.feature2Desc, "sc_about_feature2Desc"],
        ["feature3Title", "School-scoped privacy", "sc_about_feature3Title"],
        ["feature3Desc", DEFAULT_ABOUT.feature3Desc, "sc_about_feature3Desc"],
        ["feature4Title", "Admin controls", "sc_about_feature4Title"],
        ["feature4Desc", DEFAULT_ABOUT.feature4Desc, "sc_about_feature4Desc"],
        [
          "registerCtaTitle",
          DEFAULT_ABOUT.registerCtaTitle,
          "sc_about_registerCtaTitle",
        ],
        [
          "registerCtaDesc",
          DEFAULT_ABOUT.registerCtaDesc,
          "sc_about_registerCtaDesc",
        ],
        ["registerCtaBtn", "Register Your School", "sc_about_registerCtaBtn"],
        ["heroCardLabel", "Featured campus board", "sc_about_heroCardLabel"],
        ["heroCardBody", DEFAULT_ABOUT.heroCardBody, "sc_about_heroCardBody"],
        ["heroTag1", "Found items", "sc_about_heroTag1"],
        ["heroTag2", "Admin tools", "sc_about_heroTag2"],
        ["heroTag3", "Campus chat", "sc_about_heroTag3"],
      ];
      const aboutPromises = aboutSetters.map(([field, key, cacheKey]) =>
        fetchTranslation(key, language, cacheKey, (val) =>
          setAboutStrings((prev) => ({ ...prev, [field]: val })),
        ),
      );

      const enterCodeSetters: [keyof EnterCodeStrings, string, string][] = [
        ["title", "Enter School Code", "sc_ec_title"],
        ["hint", DEFAULT_ENTER_CODE.hint, "sc_ec_hint"],
        ["codeLabel", "School Code", "sc_ec_codeLabel"],
        ["codePlaceholder", "e.g. LINCOLN-2025", "sc_ec_codePlaceholder"],
        [
          "alreadyMember",
          DEFAULT_ENTER_CODE.alreadyMember,
          "sc_ec_alreadyMember",
        ],
        ["notFound", DEFAULT_ENTER_CODE.notFound, "sc_ec_notFound"],
        ["joinedPrefix", "You've joined", "sc_ec_joinedPrefix"],
        ["searchingBtn", "Searching...", "sc_ec_searchingBtn"],
        ["joinBtn", "Join School", "sc_ec_joinBtn"],
        ["yourSchoolsTitle", "Your Schools", "sc_ec_yourSchoolsTitle"],
        ["signInFirst", "Sign in first.", "sc_ec_signInFirst"],
      ];
      const enterCodePromises = enterCodeSetters.map(([field, key, cacheKey]) =>
        fetchTranslation(key, language, cacheKey, (val) =>
          setEnterCodeStrings((prev) => ({ ...prev, [field]: val })),
        ),
      );

      const registerSetters: [keyof RegisterStrings, string, string][] = [
        ["title", "Register Your School", "sc_reg_title"],
        ["hint", DEFAULT_REGISTER.hint, "sc_reg_hint"],
        ["nameLabel", "School / Institution Name *", "sc_reg_nameLabel"],
        ["namePlaceholder", "Lincoln High School", "sc_reg_namePlaceholder"],
        ["websiteLabel", "Website URL", "sc_reg_websiteLabel"],
        [
          "websitePlaceholder",
          "https://lincolnhs.edu",
          "sc_reg_websitePlaceholder",
        ],
        [
          "roleLabel",
          "Your Role at the Institution *",
          "sc_reg_roleLabel",
        ],
        [
          "rolePlaceholder",
          "e.g. Principal, IT Coordinator, Dean",
          "sc_reg_rolePlaceholder",
        ],
        ["yourNameLabel", "Your Name", "sc_reg_yourNameLabel"],
        ["yourEmailLabel", "Your Email", "sc_reg_yourEmailLabel"],
        ["logoLabel", "School Logo", "sc_reg_logoLabel"],
        ["logoUpload", "Upload school logo", "sc_reg_logoUpload"],
        [
          "primaryColorLabel",
          "School Primary Brand Color",
          "sc_reg_primaryColorLabel",
        ],
        [
          "secondaryColorLabel",
          "Secondary / Accent Color",
          "sc_reg_secondaryColorLabel",
        ],
        ["bgPhotoLabel", "Campus Background Photo", "sc_reg_bgPhotoLabel"],
        ["bgPhotoHint", DEFAULT_REGISTER.bgPhotoHint, "sc_reg_bgPhotoHint"],
        ["bgUpload", "Upload campus photo", "sc_reg_bgUpload"],
        ["gradientLabel", "Gradient Style", "sc_reg_gradientLabel"],
        ["gradientHint", DEFAULT_REGISTER.gradientHint, "sc_reg_gradientHint"],
        ["headerPreviewLabel", "Header Preview", "sc_reg_headerPreviewLabel"],
        [
          "verifyDocLabel",
          "Verification Document (optional)",
          "sc_reg_verifyDocLabel",
        ],
        [
          "verifyDocHint",
          DEFAULT_REGISTER.verifyDocHint,
          "sc_reg_verifyDocHint",
        ],
        ["verifyDocUpload", "Upload verification doc", "sc_reg_verifyDocUpload"],
        ["extraLabel", "Anything else?", "sc_reg_extraLabel"],
        [
          "extraPlaceholder",
          DEFAULT_REGISTER.extraPlaceholder,
          "sc_reg_extraPlaceholder",
        ],
        ["submitBtn", "Submit Registration", "sc_reg_submitBtn"],
        ["submittingBtn", "Submitting...", "sc_reg_submittingBtn"],
        [
          "signInRequired",
          "Sign in to submit a registration.",
          "sc_reg_signInRequired",
        ],
        ["successTitle", "Registration submitted!", "sc_reg_successTitle"],
        ["successSub", DEFAULT_REGISTER.successSub, "sc_reg_successSub"],
      ];
      const registerPromises = registerSetters.map(([field, key, cacheKey]) =>
        fetchTranslation(key, language, cacheKey, (val) =>
          setRegisterStrings((prev) => ({ ...prev, [field]: val })),
        ),
      );

      const mySchoolsSetters: [keyof MySchoolsStrings, string, string][] = [
        ["title", "My Schools", "sc_ms_title"],
        ["signInMsg", "Sign in to see your schools.", "sc_ms_signInMsg"],
        ["emptyMsg", DEFAULT_MY_SCHOOLS.emptyMsg, "sc_ms_emptyMsg"],
        ["viewBoardBtn", "View Board →", "sc_ms_viewBoardBtn"],
        ["leaveBtn", "Leave", "sc_ms_leaveBtn"],
      ];
      const mySchoolsPromises = mySchoolsSetters.map(([field, key, cacheKey]) =>
        fetchTranslation(key, language, cacheKey, (val) =>
          setMySchoolsStrings((prev) => ({ ...prev, [field]: val })),
        ),
      );

      const boardSetters: [keyof BoardStrings, string, string][] = [
        ["backBtn", "← Back", "sc_board_backBtn"],
        ["adminBadge", "School Admin", "sc_board_adminBadge"],
        ["exitAdmin", "Exit", "sc_board_exitAdmin"],
        ["itemsTab", "Items", "sc_board_itemsTab"],
        ["addItemTab", "Report Found", "sc_board_addItemTab"],
        ["reportLostTab", "Report Lost", "sc_board_reportLostTab"],
        ["adminTab", "Admin", "sc_board_adminTab"],
        ["searchPlaceholder", "Search items...", "sc_board_searchPlaceholder"],
        ["foundTabLabel", "Found Items", "sc_board_foundTabLabel"],
        ["lostTabLabel", "Lost Items", "sc_board_lostTabLabel"],
        ["loadingText", "Loading...", "sc_board_loadingText"],
        ["foundBy", "Found by", "sc_board_foundBy"],
        ["claimPending", "Claim Pending", "sc_board_claimPending"],
        ["confirmClaimed", "Confirm Claimed", "sc_board_confirmClaimed"],
        ["markFound", "Mark Found", "sc_board_markFound"],
        ["noFoundItems", "No found items yet.", "sc_board_noFoundItems"],
        ["noLostItems", "No lost item reports yet.", "sc_board_noLostItems"],
        ["noImage", "No image", "sc_board_noImage"],
        ["lostBy", "Lost by", "sc_board_lostBy"],
        ["reportFoundTitle", "Report Found Item", "sc_board_reportFoundTitle"],
        ["itemNameLabel", "Item Name", "sc_board_itemNameLabel"],
        [
          "itemNamePlaceholder",
          "e.g. Blue water bottle",
          "sc_board_itemNamePlaceholder",
        ],
        ["descLabel", "Description", "sc_board_descLabel"],
        [
          "descFoundPlaceholder",
          DEFAULT_BOARD.descFoundPlaceholder,
          "sc_board_descFoundPlaceholder",
        ],
        ["photosLabel", "Photos (up to 3)", "sc_board_photosLabel"],
        ["photosSelected", "photo(s) selected", "sc_board_photosSelected"],
        ["uploadPhotos", "Upload photos", "sc_board_uploadPhotos"],
        ["cancelBtn", "Cancel", "sc_board_cancelBtn"],
        ["postItemBtn", "Post Item", "sc_board_postItemBtn"],
        ["postingBtn", "Posting...", "sc_board_postingBtn"],
        ["itemPostedMsg", "Item posted!", "sc_board_itemPostedMsg"],
        ["reportLostTitle", "Report Lost Item", "sc_board_reportLostTitle"],
        ["whatLostLabel", "What did you lose?", "sc_board_whatLostLabel"],
        ["lostItemPlaceholder", "Item name", "sc_board_lostItemPlaceholder"],
        [
          "descLostPlaceholder",
          DEFAULT_BOARD.descLostPlaceholder,
          "sc_board_descLostPlaceholder",
        ],
        [
          "photosOptionalLabel",
          "Photos (optional, up to 3)",
          "sc_board_photosOptionalLabel",
        ],
        ["postLostBtn", "Post Lost Item", "sc_board_postLostBtn"],
        ["postingLostBtn", "Posting...", "sc_board_postingLostBtn"],
        ["lostPostedMsg", "Lost item reported!", "sc_board_lostPostedMsg"],
        [
          "adminLoginTitle",
          "School Admin Access",
          "sc_board_adminLoginTitle",
        ],
        [
          "adminLoginHint",
          DEFAULT_BOARD.adminLoginHint,
          "sc_board_adminLoginHint",
        ],
        ["adminPasswordLabel", "Admin Password", "sc_board_adminPasswordLabel"],
        [
          "adminPasswordPlaceholder",
          "e.g. FINDR-JANE-X4K2",
          "sc_board_adminPasswordPlaceholder",
        ],
        ["unlockBtn", "Unlock Admin View", "sc_board_unlockBtn"],
        ["checkingBtn", "Checking...", "sc_board_checkingBtn"],
        ["adminUnlockedMsg", "Admin view unlocked!", "sc_board_adminUnlockedMsg"],
        [
          "adminUnlockedSub",
          DEFAULT_BOARD.adminUnlockedSub,
          "sc_board_adminUnlockedSub",
        ],
        ["adminIncorrect", DEFAULT_BOARD.adminIncorrect, "sc_board_adminIncorrect"],
      ];
      const boardPromises = boardSetters.map(([field, key, cacheKey]) =>
        fetchTranslation(key, language, cacheKey, (val) =>
          setBoardStrings((prev) => ({ ...prev, [field]: val })),
        ),
      );

      await Promise.all([
        ...navPromises,
        ...aboutPromises,
        ...enterCodePromises,
        ...registerPromises,
        ...mySchoolsPromises,
        ...boardPromises,
      ]);

      setIsReady(true);
    };

    translateAll();
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

  const TOP_TABS: { id: TopTab; label: string; icon: ReactNode }[] = [
    { id: "about", label: aboutTabText, icon: <FaGraduationCap /> },
    { id: "enter-code", label: enterCodeTabText, icon: "#" },
    { id: "my-schools", label: mySchoolsTabText, icon: <FaSchool /> },
    { id: "register", label: registerTabText, icon: "+" },
  ];

  if (!mounted || !isLoaded || loadingSchools || !isReady)
    return <LoadingSpinner />;

  if (selectedSchool) {
    return (
      <SchoolBoard
        school={selectedSchool}
        user={user}
        onBack={() => setSelectedSchool(null)}
        s={boardStrings}
      />
    );
  }

  return (
    <div className="sc-page">
      <div className="sc-layout">
        <aside className="sc-sidebar">
          <div className="sc-sidebar__brand">
            <span className="sc-sidebar__icon">
              <FaGraduationCap />
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

        <main className="sc-main">
          <section
            className="sc-tab-panel"
            hidden={activeTab !== "about"}
            aria-hidden={activeTab !== "about"}
          >
            <AboutPanel
              onEnterCode={() => setActiveTab("enter-code")}
              onRegister={() => setActiveTab("register")}
              s={aboutStrings}
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
              s={enterCodeStrings}
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
              s={mySchoolsStrings}
            />
          </section>
          <section
            className="sc-tab-panel"
            hidden={activeTab !== "register"}
            aria-hidden={activeTab !== "register"}
          >
            <RegisterSchoolPanel user={user} s={registerStrings} />
          </section>
        </main>
      </div>
    </div>
  );
}