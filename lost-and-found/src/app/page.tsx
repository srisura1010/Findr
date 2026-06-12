"use client";

import "./home.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaSearch,
  FaHandsHelping,
  FaShieldAlt,
  FaSlidersH,
  FaSchool,
  FaEnvelope,
  FaBell,
  FaComment,
} from "react-icons/fa";
import { IoFolder } from "react-icons/io5";
import { useSettings } from "@/context/SettingsContext";
import { useUser, SignInButton } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { TbReportSearch } from "react-icons/tb";
import { FaHandshake } from "react-icons/fa";
import Image from "next/image";

const TYPING_PHRASES = [
  "Lost Your Keys?",
  "Lost a Wallet?",
  "Found AirPods?",
  "Lost a Backpack?",
  "Found a Phone?",
  "Lost a Jacket?",
  "Found an ID Card?",
  "Lost Earbuds?",
];

const CAROUSEL_CARDS = [
  {
    icon: <IoFolder />,
    title: "One Place for Everything",
    body: "Stop checking multiple offices or bulletin boards. All lost and found items live in one clean, searchable place.",
  },
  {
    icon: <FaSchool />,
    title: "Designed for Campuses",
    body: "Built specifically for schools — from hallways to gyms to libraries — so nothing slips through the cracks.",
  },
  {
    icon: <FaSearch />,
    title: "Find Items Faster",
    body: "Quickly match lost items with found ones and get belongings back to students in days, not weeks.",
  },
  {
    icon: <FaSlidersH />,
    title: "Search What Matters",
    body: "Filter by category, location, and time to instantly narrow down results and spot your item.",
  },
  {
    icon: <FaHandsHelping />,
    title: "Students Helping Students",
    body: "Anyone can report a found item, creating a trusted, school-wide system that actually works.",
  },
  {
    icon: <FaShieldAlt />,
    title: "Secure by Design",
    body: "Only your school community sees your items, keeping reports private and protected.",
  },
  {
    icon: <FaBell />,
    title: "Real-Time Notifications",
    body: "Get alerted the moment something matching your item shows up on the board.",
  },
  {
    icon: <FaComment />,
    title: "Built-In Messaging",
    body: "Connect finders and owners directly inside the platform — no sharing personal info.",
  },
];

// Floating items — positions are % of the hero-right container
// x: left%, y: top%, size: px, delay: animation-delay in s
const FLOATING_ITEMS = [
  {
    src: "/items/airpods.png",
    label: "AirPods",
    x: 10,
    y: 8,
    size: 135,
    delay: 0,
  },
  { src: "/items/keys.png", label: "Keys", x: 62, y: 5, size: 125, delay: 0.7 },
  {
    src: "/items/phone.png",
    label: "Phone",
    x: 38,
    y: 28,
    size: 130,
    delay: 1.4,
  },
  {
    src: "/items/red_backpack_image.png",
    label: "Backpack",
    x: 5,
    y: 52,
    size: 135,
    delay: 0.4,
  },
  {
    src: "/items/wallet.png",
    label: "Wallet",
    x: 68,
    y: 48,
    size: 120,
    delay: 1.1,
  },
  {
    src: "/items/water-bottle.png",
    label: "Water Bottle",
    x: 36,
    y: 68,
    size: 130,
    delay: 1.8,
  },
];

export default function Home() {
  const { language } = useSettings();
  const router = useRouter();
  const { isSignedIn, user, isLoaded } = useUser();
  const [isReady, setIsReady] = useState(false);
  const [banChecked, setBanChecked] = useState(false);

  // typing effect
  const [displayText, setDisplayText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // translatable strings
  const [dontPanicText, setDontPanicText] = useState("Don't Panic.");
  const [connectingText, setConnectingText] = useState(
    "Connecting students, staff, and schools — reuniting everyone with what they've lost.",
  );
  const [browseText, setBrowseText] = useState("Browse Lost Items");
  const [reportText, setReportText] = useState("Report a Found Item");
  const [card1Title, setCard1Title] = useState("One Place for Everything");
  const [card2Title, setCard2Title] = useState("Designed for Campuses");
  const [card3Title, setCard3Title] = useState("Find Items Faster");
  const [card4Title, setCard4Title] = useState("Search What Matters");
  const [card5Title, setCard5Title] = useState("Students Helping Students");
  const [card6Title, setCard6Title] = useState("Secure by Design");
  const [card1Body, setCard1Body] = useState(
    "Stop checking multiple offices or bulletin boards. All lost and found items live in one clean, searchable place.",
  );
  const [card2Body, setCard2Body] = useState(
    "Findr is made specifically for schools — from hallways to gyms to libraries — so nothing slips through the cracks.",
  );
  const [card3Body, setCard3Body] = useState(
    "Quickly match lost items with found ones and get belongings back to students in days, not weeks.",
  );
  const [card4Body, setCard4Body] = useState(
    "Filter by category, location, and time to instantly narrow down results and spot your item.",
  );
  const [card5Body, setCard5Body] = useState(
    "Anyone can report a found item, creating a trusted, school-wide system that actually works.",
  );
  const [card6Body, setCard6Body] = useState(
    "Only your school community sees your items, keeping reports private and protected.",
  );

  // typing animation
  useEffect(() => {
    const current = TYPING_PHRASES[phraseIndex];
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setDisplayText(current.slice(0, charIndex + 1));
          setCharIndex((c) => c + 1);
          if (charIndex + 1 === current.length) {
            setTimeout(() => setIsDeleting(true), 1400);
          }
        } else {
          setDisplayText(current.slice(0, charIndex - 1));
          setCharIndex((c) => c - 1);
          if (charIndex - 1 === 0) {
            setIsDeleting(false);
            setPhraseIndex((p) => (p + 1) % TYPING_PHRASES.length);
          }
        }
      },
      isDeleting ? 42 : 82,
    );
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, phraseIndex]);

  // ban check
  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setBanChecked(true);
      return;
    }
    const checkBan = async () => {
      const { data } = await supabase
        .from("banned_users")
        .select("email, suspended_until")
        .eq("email", user.primaryEmailAddress?.emailAddress)
        .single();
      if (data) {
        const isPermanent = !data.suspended_until;
        const isSuspended =
          data.suspended_until && new Date(data.suspended_until) > new Date();
        if (isPermanent || isSuspended) {
          router.push("/banned");
          return;
        }
      }
      setBanChecked(true);
    };
    checkBan();
  }, [user, isLoaded]);

  // translations
  useEffect(() => {
    if (language === "en") {
      setDontPanicText("Don't Panic.");
      setConnectingText(
        "Connecting students, staff, and schools — reuniting everyone with what they've lost.",
      );
      setBrowseText("Browse Lost Items");
      setReportText("Report a Found Item");
      setCard1Title("One Place for Everything");
      setCard2Title("Designed for Campuses");
      setCard3Title("Find Items Faster");
      setCard4Title("Search What Matters");
      setCard5Title("Students Helping Students");
      setCard6Title("Secure by Design");
      setCard1Body(
        "Stop checking multiple offices or bulletin boards. All lost and found items live in one clean, searchable place.",
      );
      setCard2Body(
        "Findr is made specifically for schools — from hallways to gyms to libraries — so nothing slips through the cracks.",
      );
      setCard3Body(
        "Quickly match lost items with found ones and get belongings back to students in days, not weeks.",
      );
      setCard4Body(
        "Filter by category, location, and time to instantly narrow down results and spot your item.",
      );
      setCard5Body(
        "Anyone can report a found item, creating a trusted, school-wide system that actually works.",
      );
      setCard6Body(
        "Only your school community sees your items, keeping reports private and protected.",
      );
      setIsReady(true);
      return;
    }
    const translateAndCache = async () => {
      const translations = [
        {
          key: "Don't Panic.",
          setter: setDontPanicText,
          cacheKey: "home_panic",
        },
        {
          key: "Connecting students, staff, and schools — reuniting everyone with what they've lost.",
          setter: setConnectingText,
          cacheKey: "home_connecting",
        },
        {
          key: "Browse Lost Items",
          setter: setBrowseText,
          cacheKey: "home_browse",
        },
        {
          key: "Report a Found Item",
          setter: setReportText,
          cacheKey: "home_report",
        },
        {
          key: "One Place for Everything",
          setter: setCard1Title,
          cacheKey: "home_card1Title",
        },
        {
          key: "Designed for Campuses",
          setter: setCard2Title,
          cacheKey: "home_card2Title",
        },
        {
          key: "Find Items Faster",
          setter: setCard3Title,
          cacheKey: "home_card3Title",
        },
        {
          key: "Search What Matters",
          setter: setCard4Title,
          cacheKey: "home_card4Title",
        },
        {
          key: "Students Helping Students",
          setter: setCard5Title,
          cacheKey: "home_card5Title",
        },
        {
          key: "Secure by Design",
          setter: setCard6Title,
          cacheKey: "home_card6Title",
        },
        {
          key: "Stop checking multiple offices or bulletin boards. All lost and found items live in one clean, searchable place.",
          setter: setCard1Body,
          cacheKey: "home_card1Body",
        },
        {
          key: "Findr is made specifically for schools — from hallways to gyms to libraries — so nothing slips through the cracks.",
          setter: setCard2Body,
          cacheKey: "home_card2Body",
        },
        {
          key: "Quickly match lost items with found ones and get belongings back to students in days, not weeks.",
          setter: setCard3Body,
          cacheKey: "home_card3Body",
        },
        {
          key: "Filter by category, location, and time to instantly narrow down results and spot your item.",
          setter: setCard4Body,
          cacheKey: "home_card4Body",
        },
        {
          key: "Anyone can report a found item, creating a trusted, school-wide system that actually works.",
          setter: setCard5Body,
          cacheKey: "home_card5Body",
        },
        {
          key: "Only your school community sees your items, keeping reports private and protected.",
          setter: setCard6Body,
          cacheKey: "home_card6Body",
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
            const translated = data.translatedText || key;
            setter(translated);
            localStorage.setItem(`${cacheKey}_${language}`, translated);
          }
        } catch {
          /* keep defaults */
        }
      }
      setIsReady(true);
    };
    translateAndCache();
  }, [language]);

  const [positions, setPositions] = useState<
    Record<number, { x: number; y: number }>
  >({});
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragState = useRef<{
    index: number;
    startPX: number;
    startPY: number;
    startIX: number;
    startIY: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent, i: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const cur = positions[i] ?? { x: 0, y: 0 };
    dragState.current = {
      index: i,
      startPX: e.clientX,
      startPY: e.clientY,
      startIX: cur.x,
      startIY: cur.y,
    };
    setDraggingIndex(i);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const { index, startPX, startPY, startIX, startIY } = dragState.current;
    setPositions((p) => ({
      ...p,
      [index]: {
        x: startIX + e.clientX - startPX,
        y: startIY + e.clientY - startPY,
      },
    }));
  };
  const onPointerUp = () => {
    dragState.current = null;
    setDraggingIndex(null);
  };

  if (!isLoaded || !banChecked || !isReady) return <LoadingSpinner />;

  const featureCards = [
    {
      icon: <IoFolder className="feat-icon-svg" />,
      title: card1Title,
      body: card1Body,
    },
    {
      icon: <FaSchool className="feat-icon-svg" />,
      title: card2Title,
      body: card2Body,
    },
    {
      icon: <FaSearch className="feat-icon-svg" />,
      title: card3Title,
      body: card3Body,
    },
    {
      icon: <FaSlidersH className="feat-icon-svg" />,
      title: card4Title,
      body: card4Body,
    },
    {
      icon: <FaHandsHelping className="feat-icon-svg" />,
      title: card5Title,
      body: card5Body,
    },
    {
      icon: <FaShieldAlt className="feat-icon-svg" />,
      title: card6Title,
      body: card6Body,
    },
  ];

  return (
    <div className="home-root">
      <div className="grid-background dark:block light:hidden" />
      <div className="grid-background-light dark:hidden light:block" />

      {/* ── HERO ── */}
      <section className="hero-section">
        <div className="hero-left">
          <div className="hero-eyebrow">
            <span className="eyebrow-dot" />
            Built for students, by students
          </div>
          <h1>
            <span className="hero-typing">
              {displayText}
              <span className="typing-cursor">|</span>
            </span>
            <span className="hero-static">{dontPanicText}</span>
          </h1>
          <p className="hero-sub">{connectingText}</p>
          <div className="hero-btns">
            {isSignedIn ? (
              <button
                className="btn-primary"
                onClick={() => router.push("/dashboard")}
              >
                {browseText}
              </button>
            ) : (
              <SignInButton mode="modal">
                <button className="btn-primary">{browseText}</button>
              </SignInButton>
            )}
            {isSignedIn ? (
              <button
                className="btn-outline"
                onClick={() => router.push("/dashboard")}
              >
                {reportText}
              </button>
            ) : (
              <SignInButton mode="modal">
                <button className="btn-outline">{reportText}</button>
              </SignInButton>
            )}
          </div>
        </div>

        {/* ── FLOATING ITEMS ── */}
        <div className="hero-right">
          <div
            className="floating-items-stage"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {FLOATING_ITEMS.map((item, i) => (
              <div
                key={i}
                className="floating-item"
                onPointerDown={(e) => onPointerDown(e, i)}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.size}px`,
                  height: `${item.size}px`,
                  animationDelay: `${item.delay}s`,
                  transform: `translate(${(positions[i] ?? { x: 0 }).x}px, ${(positions[i] ?? { x: 0, y: 0 }).y}px)`,
                  cursor: draggingIndex === i ? "grabbing" : "grab",
                  touchAction: "none",
                }}
              >
                <Image
                  src={item.src}
                  alt={item.label}
                  width={item.size}
                  height={item.size}
                  className="floating-item-img"
                  draggable={false}
                />
                <span className="floating-item-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* wave: hero → features */}
      <svg
        className="wave-divider"
        viewBox="0 0 1440 56"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,0 C380,56 1060,0 1440,46 L1440,56 L0,56 Z"
          className="wave-fill-feat"
        />
      </svg>

      {/* ── FEATURES ── */}
      <section className="features-section">
        <p className="section-label">Why Findr</p>
        <h2 className="section-title">Everything you need to find it</h2>
        <p className="section-sub">
          One platform for your entire campus — no bulletin boards, no missed
          pickups.
        </p>
        <div className="features-grid">
          {featureCards.map(({ icon, title, body }, i) => (
            <div className="feat-card" key={i}>
              <div className="feat-icon-wrap">{icon}</div>
              <div className="feat-title">{title}</div>
              <p className="feat-body">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* diagonal: features → how it works */}
      <div className="diagonal-feat-hiw" aria-hidden="true" />

      {/* ── HOW IT WORKS ── */}
      <section className="hiw-section">
        <p className="section-label">How it works</p>
        <h2 className="section-title">Three steps to reunited</h2>
        <p className="section-sub">
          Simple enough for anyone on campus, powerful enough for every item.
        </p>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">01</div>
            <div className="step-icon">
              <TbReportSearch />
            </div>
            <h3 className="step-title">Report It</h3>
            <p className="step-body">
              Found something? Snap a photo, pick a category, drop the location.
              It goes live instantly.
            </p>
          </div>
          <div className="step-connector" aria-hidden="true">
            · · ·
          </div>
          <div className="step-card">
            <div className="step-number">02</div>
            <div className="step-icon">
              <FaSearch />
            </div>
            <h3 className="step-title">Search &amp; Match</h3>
            <p className="step-body">
              Browse the board, filter by type and location, or get notified
              when a match appears.
            </p>
          </div>
          <div className="step-connector" aria-hidden="true">
            · · ·
          </div>
          <div className="step-card">
            <div className="step-number">03</div>
            <div className="step-icon">
              <FaHandshake />
            </div>
            <h3 className="step-title">Get It Back</h3>
            <p className="step-body">
              Message the finder directly through Findr, confirm it's yours, and
              arrange a pickup.
            </p>
          </div>
        </div>
      </section>

      {/* wave: hiw → carousel */}
      <svg
        className="wave-divider"
        viewBox="0 0 1440 52"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,52 C480,0 960,52 1440,16 L1440,52 Z"
          className="wave-fill-car"
        />
      </svg>

      {/* ── CAROUSEL ── */}
      <section className="carousel-section">
        <p className="section-label" style={{ marginBottom: "28px" }}>
          Features at a glance
        </p>
        <div className="carousel-wrap">
          <div className="carousel-track">
            {[...CAROUSEL_CARDS, ...CAROUSEL_CARDS].map(
              ({ icon, title, body }, i) => (
                <div className="carousel-card" key={i}>
                  <span className="carousel-icon">{icon}</span>
                  <h3 className="carousel-title">{title}</h3>
                  <p className="carousel-body">{body}</p>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* diagonal: carousel → stats */}
      <div className="diagonal-car-stats" aria-hidden="true" />

      {/* ── STATS ── */}
      <section className="stats-section">
        <div className="stats-inner">
          <div className="stat-item">
            <span className="stat-number">3</span>
            <span className="stat-label">Steps to Recovery</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-number">100%</span>
            <span className="stat-label">School-Private</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-number">0</span>
            <span className="stat-label">Bulletin Boards</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-number">∞</span>
            <span className="stat-label">Items Supported</span>
          </div>
        </div>
      </section>

      {/* wave: stats → cta */}
      <svg
        className="wave-divider"
        viewBox="0 0 1440 56"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,28 C500,56 940,0 1440,38 L1440,56 L0,56 Z"
          className="wave-fill-cta"
        />
      </svg>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="cta-inner">
          <h2 className="cta-title">Ready to find what you lost?</h2>
          <p className="cta-sub">
            Join your school community on Findr today — it only takes a moment
            to sign up.
          </p>
          {isSignedIn ? (
            <button
              className="cta-btn"
              onClick={() => router.push("/dashboard")}
            >
              Go to Dashboard →
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="cta-btn">Get Started →</button>
            </SignInButton>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-logo">Findr</span>
            <p className="footer-tagline">
              Lost &amp; found, built for schools.
            </p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <span className="footer-col-heading">Navigate</span>
              {isSignedIn ? (
                <button
                  className="footer-link"
                  onClick={() => router.push("/dashboard")}
                >
                  Dashboard
                </button>
              ) : (
                <SignInButton mode="modal">
                  <button className="footer-link">Sign In</button>
                </SignInButton>
              )}
              {isSignedIn && (
                <button
                  className="footer-link"
                  onClick={() => router.push("/messages")}
                >
                  Messages
                </button>
              )}
              {isSignedIn && (
                <button
                  className="footer-link"
                  onClick={() => router.push("../schools")}
                >
                  For Schools
                </button>
              )}
              {isSignedIn && (
                <button
                  className="footer-link"
                  onClick={() => router.push("/help")}
                >
                  Help
                </button>
              )}
              {isSignedIn && (
                <button
                  className="footer-link"
                  onClick={() => router.push("/settings")}
                >
                  Settings
                </button>
              )}
            </div>
            <div className="footer-col">
              <span className="footer-col-heading">Contact</span>
              <a className="footer-link" href="mailto:findr.support@gmail.com">
                <FaEnvelope
                  style={{ display: "inline", marginRight: 6, fontSize: 12 }}
                />
                findr.support@gmail.com
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Findr. Built for students, by students.
          </span>
        </div>
      </footer>
    </div>
  );
}
