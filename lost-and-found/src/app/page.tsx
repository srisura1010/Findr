"use client";

import "./home.css";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FaSearch,
  FaHandsHelping,
  FaShieldAlt,
  FaSlidersH,
  FaSchool,
  FaEnvelope,
} from "react-icons/fa";
import { IoFolder } from "react-icons/io5";
import { useSettings } from "@/context/SettingsContext";
import { useUser, SignInButton } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { TbReportSearch } from "react-icons/tb";
import { FaHandshake } from "react-icons/fa";

function FloatingItem({
  src,
  label,
  x,
  y,
  animDelay,
}: {
  src: string;
  label: string;
  x: number;
  y: number;
  animDelay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef({ x, y });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [, forceUpdate] = useState(0);

  const getHeroBounds = () => {
    const zone = document.getElementById("floating-zone");
    if (!zone) return null;
    const zoneRect = zone.getBoundingClientRect();
    return {
      minX: 0,
      maxX: zoneRect.width - 90,
      minY: 0,
      maxY: zoneRect.height - 90,
    };
  };

  const clamp = (val: number, min: number, max: number) =>
    Math.min(Math.max(val, min), max);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    offset.current = {
      x: e.clientX - pos.current.x,
      y: e.clientY - pos.current.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const b = getHeroBounds();
      if (!b) return;
      let nx = e.clientX - offset.current.x;
      let ny = e.clientY - offset.current.y;
      nx = clamp(nx, b.minX, b.maxX);
      ny = clamp(ny, b.minY, b.maxY);
      pos.current = { x: nx, y: ny };
      forceUpdate((n) => n + 1);
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`floating-item${hovered ? " hovered" : ""}`}
      style={{
        left: pos.current.x,
        top: pos.current.y,
        animationDelay: `${animDelay}s`,
        animationPlayState: dragging.current ? "paused" : "running",
        cursor: dragging.current ? "grabbing" : "grab",
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={src} alt={label} draggable={false} />
      {hovered && <span className="floating-label">{label}</span>}
    </div>
  );
}

const TYPING_PHRASES = [
  "Lost Your Keys?",
  "Lost a Wallet?",
  "Found AirPods?",
  "Lost a Backpack?",
  "Found a Phone?",
  "Lost a Jacket?",
  "Found an ID?",
  "Lost Earbuds?",
];

export default function Home() {
  const { language } = useSettings();
  const router = useRouter();
  const { isSignedIn, user, isLoaded } = useUser();
  const [isReady, setIsReady] = useState(false);
  const [banChecked, setBanChecked] = useState(false);

  // Typing effect state
  const [displayText, setDisplayText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const [dontPanicText, setDontPanicText] = useState("Don't Panic.");
  const [connectingText, setConnectingText] = useState(
    "Connecting student, staff, and schools and reuniting them with their lost items",
  );
  const [browseText, setBrowseText] = useState("Browse Lost Items");
  const [reportText, setReportText] = useState("Report a Lost Item");
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

  // Typing effect
  useEffect(() => {
    const current = TYPING_PHRASES[phraseIndex];
    const timeout = setTimeout(() => {
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
    }, isDeleting ? 45 : 85);

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, phraseIndex]);

  // Ban check
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

  // Translations
  useEffect(() => {
    if (language === "en") {
      setDontPanicText("Don't Panic.");
      setConnectingText(
        "Connecting student, staff, and schools and reuniting them with their lost items",
      );
      setBrowseText("Browse Lost Items");
      setReportText("Report a Lost Item");
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
        { key: "Don't Panic.", setter: setDontPanicText, cacheKey: "home_panic" },
        {
          key: "Connecting student, staff, and schools and reuniting them with their lost items",
          setter: setConnectingText,
          cacheKey: "home_connecting",
        },
        { key: "Browse Lost Items", setter: setBrowseText, cacheKey: "home_browse" },
        { key: "Report a Lost Item", setter: setReportText, cacheKey: "home_report" },
        { key: "One Place for Everything", setter: setCard1Title, cacheKey: "home_card1Title" },
        { key: "Designed for Campuses", setter: setCard2Title, cacheKey: "home_card2Title" },
        { key: "Find Items Faster", setter: setCard3Title, cacheKey: "home_card3Title" },
        { key: "Search What Matters", setter: setCard4Title, cacheKey: "home_card4Title" },
        { key: "Students Helping Students", setter: setCard5Title, cacheKey: "home_card5Title" },
        { key: "Secure by Design", setter: setCard6Title, cacheKey: "home_card6Title" },
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
          /* keep cached */
        }
      }
      setIsReady(true);
    };
    translateAndCache();
  }, [language]);

  if (!isLoaded || !banChecked || !isReady) return <LoadingSpinner />;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grid-background dark:block light:hidden" />
      <div className="grid-background-light dark:hidden light:block" />

      <div className="floating-items" id="floating-zone" aria-hidden="true">
        {[
          { src: "/items/airpods.png", label: "AirPods", x: 60, y: 120 },
          { src: "/items/keys.png", label: "Keys", x: 1320, y: 120 },
          { src: "/items/wallet.png", label: "Wallet", x: 140, y: 500 },
          { src: "/items/water-bottle.png", label: "Water Bottle", x: 1400, y: 380 },
          { src: "/items/red_backpack_image.png", label: "Backpack", x: 250, y: 350 },
          { src: "/items/phone.png", label: "Phone", x: 1250, y: 510 },
        ].map((item, i) => (
          <FloatingItem key={i} {...item} animDelay={i * 0.6} />
        ))}
      </div>

      <div className="hero-card relative z-[15]">
        <h1>
          <span className="lostHero">
            {displayText}
            <span className="typing-cursor">|</span>
          </span> <br />
          <span className="panicHero">{dontPanicText}</span>
        </h1>
        <p>{connectingText}</p>
        {isSignedIn ? (
          <button className="browse" onClick={() => router.push("/dashboard")}>
            {browseText}
          </button>
        ) : (
          <SignInButton mode="modal">
            <button className="browse">{browseText}</button>
          </SignInButton>
        )}
        {isSignedIn ? (
          <button className="report" onClick={() => router.push("/dashboard")}>
            {reportText}
          </button>
        ) : (
          <SignInButton mode="modal">
            <button className="report">{reportText}</button>
          </SignInButton>
        )}
      </div>

      <div className="carousel relative z-10">
        <div className="track">
          <div className="card">
            <span className="card-icon"><IoFolder className="text-blue-500" /></span>
            <h3 className="card-title">{card1Title}</h3>
            <p className="card-body">{card1Body}</p>
          </div>
          <div className="card">
            <span className="card-icon"><FaSchool className="text-blue-500" /></span>
            <h3 className="card-title">{card2Title}</h3>
            <p className="card-body">{card2Body}</p>
          </div>
          <div className="card">
            <span className="card-icon"><FaSearch className="text-blue-500" /></span>
            <h3 className="card-title">{card3Title}</h3>
            <p className="card-body">{card3Body}</p>
          </div>
          <div className="card">
            <span className="card-icon"><FaSlidersH className="text-blue-500" /></span>
            <h3 className="card-title">{card4Title}</h3>
            <p className="card-body">{card4Body}</p>
          </div>
          <div className="card">
            <span className="card-icon"><FaHandsHelping className="text-blue-500" /></span>
            <h3 className="card-title">{card5Title}</h3>
            <p className="card-body">{card5Body}</p>
          </div>
          <div className="card">
            <span className="card-icon"><FaShieldAlt className="text-blue-500" /></span>
            <h3 className="card-title">{card6Title}</h3>
            <p className="card-body">{card6Body}</p>
          </div>
          <div className="card">
            <span className="card-icon"><IoFolder className="text-blue-500" /></span>
            <h3 className="card-title">{card1Title}</h3>
            <p className="card-body">{card1Body}</p>
          </div>
          <div className="card">
            <span className="card-icon"><FaSchool className="text-blue-500" /></span>
            <h3 className="card-title">{card2Title}</h3>
            <p className="card-body">{card2Body}</p>
          </div>
          <div className="card">
            <span className="card-icon"><FaSearch className="text-blue-500" /></span>
            <h3 className="card-title">{card3Title}</h3>
            <p className="card-body">{card3Body}</p>
          </div>
          <div className="card">
            <span className="card-icon"><FaSlidersH className="text-blue-500" /></span>
            <h3 className="card-title">{card4Title}</h3>
            <p className="card-body">{card4Body}</p>
          </div>
          <div className="card">
            <span className="card-icon"><FaHandsHelping className="text-blue-500" /></span>
            <h3 className="card-title">{card5Title}</h3>
            <p className="card-body">{card5Body}</p>
          </div>
          <div className="card">
            <span className="card-icon"><FaShieldAlt className="text-blue-500" /></span>
            <h3 className="card-title">{card6Title}</h3>
            <p className="card-body">{card6Body}</p>
          </div>
        </div>
      </div>

      <section className="how-it-works relative z-10">
        <h2 className="section-title">How Findr Works</h2>
        <p className="section-subtitle">
          Three simple steps to reunite students with their belongings.
        </p>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">01</div>
            <div className="step-icon"><TbReportSearch /></div>
            <h3 className="step-title">Report It</h3>
            <p className="step-body">
              Found something? Submit it in seconds — snap a photo, pick a
              category, and drop the location. It goes live instantly.
            </p>
          </div>
          <div className="step-connector" aria-hidden="true">→</div>
          <div className="step-card">
            <div className="step-number">02</div>
            <div className="step-icon"><FaSearch /></div>
            <h3 className="step-title">Search & Match</h3>
            <p className="step-body">
              Lost something? Browse the board, filter by type and location, or
              get notified when something matching your item shows up.
            </p>
          </div>
          <div className="step-connector" aria-hidden="true">→</div>
          <div className="step-card">
            <div className="step-number">03</div>
            <div className="step-icon"><FaHandshake /></div>
            <h3 className="step-title">Get It Back</h3>
            <p className="step-body">
              Message the finder directly through Findr, confirm it's yours, and
              arrange a pickup — all within the platform.
            </p>
          </div>
        </div>
      </section>

      <section className="stats-banner relative z-10">
        <div className="stats-grid">
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
            <span className="stat-label">Bulletin Boards Needed</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-number">∞</span>
            <span className="stat-label">Items Supported</span>
          </div>
        </div>
      </section>

      <section className="cta-strip relative z-10">
        <h2 className="cta-title">Ready to find what you lost?</h2>
        <p className="cta-sub">
          Join your school community on Findr today — it only takes a moment to sign up.
        </p>
        {isSignedIn ? (
          <button className="cta-btn" onClick={() => router.push("/dashboard")}>
            Go to Dashboard →
          </button>
        ) : (
          <SignInButton mode="modal">
            <button className="cta-btn">Get Started →</button>
          </SignInButton>
        )}
      </section>

      <footer className="site-footer relative z-10">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-logo">Findr</span>
            <p className="footer-tagline">Lost & found, built for schools.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <span className="footer-col-heading">Navigate</span>
              {isSignedIn ? (
                <button className="footer-link" onClick={() => router.push("/dashboard")}>Dashboard</button>
              ) : (
                <SignInButton mode="modal">
                  <button className="footer-link">Sign In</button>
                </SignInButton>
              )}
              {isSignedIn && (
                <button className="footer-link" onClick={() => router.push("/messages")}>Messages</button>
              )}
              {isSignedIn && (
                <button className="footer-link" onClick={() => router.push("/help")}>Help</button>
              )}
              {isSignedIn && (
                <button className="footer-link" onClick={() => router.push("/settings")}>Settings</button>
              )}
            </div>
            <div className="footer-col">
              <span className="footer-col-heading">Contact</span>
              <a className="footer-link" href="mailto:srivatsav4ever@gmail.com">
                <FaEnvelope style={{ display: "inline", marginRight: 6, fontSize: 12 }} />
                srivatsav4ever@gmail.com
              </a>
              <a className="footer-link" href="mailto:bavu.ramki@gmail.com">
                <FaEnvelope style={{ display: "inline", marginRight: 6, fontSize: 12 }} />
                bavu.ramki@gmail.com
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Findr. Built for students, by students.</span>
        </div>
      </footer>
    </div>
  );
}