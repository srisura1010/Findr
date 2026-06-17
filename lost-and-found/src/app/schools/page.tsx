"use client";

import "./schools.css";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { BsLightningFill } from "react-icons/bs";
import { FaGraduationCap, FaShieldAlt } from "react-icons/fa";
import { FaLock } from "react-icons/fa6";
import { FaSchool } from "react-icons/fa";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSettings } from "@/context/SettingsContext";
import Cropper from "react-easy-crop";

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

// ─── Cache helpers ────────────────────────────────────────────────────────────
const SCHOOLS_CACHE_TTL_MS = 5 * 60 * 1000;

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

// ─── Crop helper ──────────────────────────────────────────────────────────────
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));
  canvas.width = safeArea;
  canvas.height = safeArea;
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);
  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5,
  );
  const data = ctx.getImageData(0, 0, safeArea, safeArea);
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y),
  );
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(new File([blob!], "cropped.jpg", { type: "image/jpeg" })),
      "image/jpeg",
      0.92,
    );
  });
}

// ─── CropModal ────────────────────────────────────────────────────────────────
function CropModal({
  src,
  aspect,
  onConfirm,
  onSkip,
}: {
  src: string;
  /** aspect ratio for the crop — 1 for square logos */
  aspect: number;
  onConfirm: (pixels: { x: number; y: number; width: number; height: number }, rotation: number) => void;
  onSkip: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number; y: number; width: number; height: number;
  } | null>(null);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        gap: "14px",
      }}
    >
      <p
        style={{
          color: "#fff",
          fontFamily: "var(--font-body)",
          fontWeight: 700,
          fontSize: "15px",
          margin: 0,
          letterSpacing: "-0.1px",
        }}
      >
        Crop Photo
      </p>

      <div
        style={{
          position: "relative",
          width: "min(90vw, 600px)",
          aspectRatio: "4 / 3",
          borderRadius: "12px",
          overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.12)",
        }}
      >
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "min(90vw, 600px)",
          background: "rgba(255,255,255,0.06)",
          borderRadius: "10px",
          padding: "14px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              color: "rgba(255,255,255,0.55)",
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.6px",
              minWidth: 44,
            }}
          >
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: "var(--accent)" }}
          />
          <span
            style={{
              color: "rgba(255,255,255,0.4)",
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              minWidth: 32,
              textAlign: "right",
            }}
          >
            {zoom.toFixed(1)}×
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              color: "rgba(255,255,255,0.55)",
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.6px",
              minWidth: 44,
            }}
          >
            Rotate
          </span>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            style={{ flex: 1, accentColor: "var(--accent)" }}
          />
          <span
            style={{
              color: "rgba(255,255,255,0.4)",
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              minWidth: 32,
              textAlign: "right",
            }}
          >
            {rotation}°
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", width: "min(90vw, 600px)" }}>
        <button
          onClick={onSkip}
          style={{
            flex: 1,
            padding: "13px 0",
            borderRadius: "9px",
            border: "1.5px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "rgba(255,255,255,0.7)",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "border-color 0.15s ease, color 0.15s ease",
          }}
        >
          Skip crop
        </button>
        <button
          onClick={() => croppedAreaPixels && onConfirm(croppedAreaPixels, rotation)}
          style={{
            flex: 2,
            padding: "13px 0",
            borderRadius: "9px",
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "background 0.15s ease, transform 0.12s ease",
          }}
        >
          Apply Crop
        </button>
      </div>
    </div>
  );
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
          { icon: <FaGraduationCap />, title: s.feature1Title, desc: s.feature1Desc },
          { icon: <BsLightningFill />, title: s.feature2Title, desc: s.feature2Desc },
          { icon: <FaShieldAlt />, title: s.feature3Title, desc: s.feature3Desc },
          { icon: <FaLock />, title: s.feature4Title, desc: s.feature4Desc },
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
  const router = useRouter();
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
      setTimeout(() => router.push(`/schools/${school.id}/board`), 800);
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
  onRequestLogoCrop,
  logoFile,
  logoPreviewUrl,
}: {
  user: any;
  s: RegisterStrings;
  /** Called when user picks a logo file — parent opens the crop modal */
  onRequestLogoCrop: (file: File) => void;
  logoFile: File | null;
  logoPreviewUrl: string | null;
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

  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    return () => {
      if (bgPreviewUrl) URL.revokeObjectURL(bgPreviewUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (bgPreviewUrl) URL.revokeObjectURL(bgPreviewUrl);
    setBgFile(file);
    setBgPreviewUrl(URL.createObjectURL(file));
  };

  // Hand off to the parent to open the crop modal
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onRequestLogoCrop(file);
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
      await supabase.storage.from("item-images").upload(fn, bgFile);
      const { data } = supabase.storage.from("item-images").getPublicUrl(fn);
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
          onChange={(e) => setForm((p) => ({ ...p, websiteUrl: e.target.value }))}
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

        {/* ── Logo upload + crop preview ── */}
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
          onChange={handleLogoChange}
        />
        {/* Logo preview with re-crop option */}
        {logoPreviewUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <img
              src={logoPreviewUrl}
              alt="Logo preview"
              style={{
                width: 72,
                height: 72,
                borderRadius: 10,
                objectFit: "cover",
                border: "2px solid var(--border-default)",
              }}
            />
            <button
              type="button"
              className="sc-btn sc-btn--ghost sc-btn--sm"
              onClick={() => {
                document.getElementById("school-logo-upload")?.click();
              }}
            >
              Change / Re-crop
            </button>
          </div>
        )}

        <label className="sc-form__label">{s.primaryColorLabel}</label>
        <div className="sc-color-row">
          <input
            type="color"
            className="sc-color-picker"
            value={form.color}
            onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
          />
          <span className="sc-color-value">{form.color}</span>
          <div className="sc-color-preview" style={{ background: form.color }} />
        </div>

        <label className="sc-form__label">{s.secondaryColorLabel}</label>
        <div className="sc-color-row">
          <input
            type="color"
            className="sc-color-picker"
            value={form.secondaryColor}
            onChange={(e) => setForm((p) => ({ ...p, secondaryColor: e.target.value }))}
          />
          <span className="sc-color-value">{form.secondaryColor}</span>
          <div className="sc-color-preview" style={{ background: form.secondaryColor }} />
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
          onChange={(e) => setForm((p) => ({ ...p, extraInfo: e.target.value }))}
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
  onLeave,
  s,
}: {
  mySchools: School[];
  user: any;
  onLeave: (school: School) => void;
  s: MySchoolsStrings;
}) {
  const router = useRouter();

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
    <div className="sc-panel-content" style={{ maxWidth: "none", margin: 0, padding: "32px 0 0" }}>
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
                  onClick={() => router.push(`/schools/${school.id}/board`)}
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
  gradientHint: "Pick how your primary color fades over the campus photo.",
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SchoolsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { language } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [aboutTabText, setAboutTabText] = useState("About");
  const [enterCodeTabText, setEnterCodeTabText] = useState("Enter Code");
  const [mySchoolsTabText, setMySchoolsTabText] = useState("My Schools");
  const [registerTabText, setRegisterTabText] = useState("Register School");
  const [yourSchoolsText, setYourSchoolsText] = useState("Your Schools");
  const [schoolBoardsText, setSchoolBoardsText] = useState("School boards");

  const [aboutStrings, setAboutStrings] = useState<AboutStrings>(DEFAULT_ABOUT);
  const [enterCodeStrings, setEnterCodeStrings] = useState<EnterCodeStrings>(DEFAULT_ENTER_CODE);
  const [registerStrings, setRegisterStrings] = useState<RegisterStrings>(DEFAULT_REGISTER);
  const [mySchoolsStrings, setMySchoolsStrings] = useState<MySchoolsStrings>(DEFAULT_MY_SCHOOLS);

  type TopTab = "about" | "enter-code" | "my-schools" | "register";

  const [activeTab, setActiveTab] = useState<TopTab>("about");
  const [mySchools, setMySchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  // ── Logo crop state (lifted here so modal renders at page root) ──────────
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);
  const [logoCropRawFile, setLogoCropRawFile] = useState<File | null>(null);

  const handleRequestLogoCrop = (file: File) => {
    if (logoCropSrc) URL.revokeObjectURL(logoCropSrc);
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(null);
    setLogoCropRawFile(file);
    setLogoCropSrc(URL.createObjectURL(file));
  };

  const handleLogoCropConfirm = async (
    pixels: { x: number; y: number; width: number; height: number },
    rotation: number,
  ) => {
    if (!logoCropSrc) return;
    const cropped = await getCroppedImg(logoCropSrc, pixels, rotation);
    URL.revokeObjectURL(logoCropSrc);
    setLogoCropSrc(null);
    setLogoCropRawFile(null);
    setLogoFile(cropped);
    setLogoPreviewUrl(URL.createObjectURL(cropped));
  };

  const handleLogoCropSkip = () => {
    if (!logoCropSrc || !logoCropRawFile) return;
    URL.revokeObjectURL(logoCropSrc);
    setLogoCropSrc(null);
    setLogoFile(logoCropRawFile);
    setLogoPreviewUrl(URL.createObjectURL(logoCropRawFile));
    setLogoCropRawFile(null);
  };

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

  // ── Translation ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (language === "en") {
      setAboutTabText("About");
      setEnterCodeTabText("Enter Code");
      setMySchoolsTabText("My Schools");
      setRegisterTabText("Register School");
      setYourSchoolsText("Your Schools");
      setSchoolBoardsText("School boards");
      setAboutStrings(DEFAULT_ABOUT);
      setEnterCodeStrings(DEFAULT_ENTER_CODE);
      setRegisterStrings(DEFAULT_REGISTER);
      setMySchoolsStrings(DEFAULT_MY_SCHOOLS);
      setIsReady(true);
      return;
    }

    const translateAll = async () => {
      const t = (key: string, cacheKey: string, setter: (val: string) => void) =>
        fetchTranslation(key, language, cacheKey, setter);

      const navPromises = [
        t("About", "sc_tab_about", setAboutTabText),
        t("Enter Code", "sc_tab_enterCode", setEnterCodeTabText),
        t("My Schools", "sc_tab_mySchools", setMySchoolsTabText),
        t("Register School", "sc_tab_registerSchool", setRegisterTabText),
        t("Your Schools", "sc_sidebar_yourSchools", setYourSchoolsText),
        t("School boards", "sc_sidebar_schoolBoards", setSchoolBoardsText),
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
        ["registerCtaTitle", DEFAULT_ABOUT.registerCtaTitle, "sc_about_registerCtaTitle"],
        ["registerCtaDesc", DEFAULT_ABOUT.registerCtaDesc, "sc_about_registerCtaDesc"],
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
        ["alreadyMember", DEFAULT_ENTER_CODE.alreadyMember, "sc_ec_alreadyMember"],
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
        ["websitePlaceholder", "https://lincolnhs.edu", "sc_reg_websitePlaceholder"],
        ["roleLabel", "Your Role at the Institution *", "sc_reg_roleLabel"],
        ["rolePlaceholder", "e.g. Principal, IT Coordinator, Dean", "sc_reg_rolePlaceholder"],
        ["yourNameLabel", "Your Name", "sc_reg_yourNameLabel"],
        ["yourEmailLabel", "Your Email", "sc_reg_yourEmailLabel"],
        ["logoLabel", "School Logo", "sc_reg_logoLabel"],
        ["logoUpload", "Upload school logo", "sc_reg_logoUpload"],
        ["primaryColorLabel", "School Primary Brand Color", "sc_reg_primaryColorLabel"],
        ["secondaryColorLabel", "Secondary / Accent Color", "sc_reg_secondaryColorLabel"],
        ["bgPhotoLabel", "Campus Background Photo", "sc_reg_bgPhotoLabel"],
        ["bgPhotoHint", DEFAULT_REGISTER.bgPhotoHint, "sc_reg_bgPhotoHint"],
        ["bgUpload", "Upload campus photo", "sc_reg_bgUpload"],
        ["gradientLabel", "Gradient Style", "sc_reg_gradientLabel"],
        ["gradientHint", DEFAULT_REGISTER.gradientHint, "sc_reg_gradientHint"],
        ["headerPreviewLabel", "Header Preview", "sc_reg_headerPreviewLabel"],
        ["verifyDocLabel", "Verification Document (optional)", "sc_reg_verifyDocLabel"],
        ["verifyDocHint", DEFAULT_REGISTER.verifyDocHint, "sc_reg_verifyDocHint"],
        ["verifyDocUpload", "Upload verification doc", "sc_reg_verifyDocUpload"],
        ["extraLabel", "Anything else?", "sc_reg_extraLabel"],
        ["extraPlaceholder", DEFAULT_REGISTER.extraPlaceholder, "sc_reg_extraPlaceholder"],
        ["submitBtn", "Submit Registration", "sc_reg_submitBtn"],
        ["submittingBtn", "Submitting...", "sc_reg_submittingBtn"],
        ["signInRequired", "Sign in to submit a registration.", "sc_reg_signInRequired"],
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

      await Promise.all([
        ...navPromises,
        ...aboutPromises,
        ...enterCodePromises,
        ...registerPromises,
        ...mySchoolsPromises,
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

  return (
    <>
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
                    onClick={() => router.push(`/schools/${s.id}/board`)}
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
                onLeave={handleLeave}
                s={mySchoolsStrings}
              />
            </section>
            <section
              className="sc-tab-panel"
              hidden={activeTab !== "register"}
              aria-hidden={activeTab !== "register"}
            >
              <RegisterSchoolPanel
                user={user}
                s={registerStrings}
                onRequestLogoCrop={handleRequestLogoCrop}
                logoFile={logoFile}
                logoPreviewUrl={logoPreviewUrl}
              />
            </section>
          </main>
        </div>
      </div>

      {/* ── Logo Crop Modal — rendered at page root to escape any stacking context ── */}
      {logoCropSrc && (
        <CropModal
          src={logoCropSrc}
          aspect={1}
          onConfirm={handleLogoCropConfirm}
          onSkip={handleLogoCropSkip}
        />
      )}
    </>
  );
}