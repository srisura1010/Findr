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
import {
  PiNumberCircleTwoFill,
  PiNumberCircleOneFill,
  PiNumberCircleThreeFill,
} from "react-icons/pi";

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
    body: "Stop checking multiple offices or cardboard boxes throughout your school. All lost and found items live in one clean, searchable place.",
  },
  {
    icon: <FaSchool />,
    title: "Designed for Campuses",
    body: "Built specifically for schools, from hallways to gyms to libraries. Nothing slips through our system.",
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
    body: "Anyone can report an item they found, creating a trusted, school-wide system that actually works.",
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
    body: "Connect finders and owners directly inside the platform, with no sharing of personal info.",
  },
];

// Floating items — positions are % of the hero-right container
// x: left%, y: top%, size: px, delay: animation-delay in s
const FLOATING_ITEMS = [
  {
    src: "/items/airpods.png",
    label: "AirPods",
    x: -81,
    y: -5,
    size: 135,
    delay: 0,
  },
  { src: "/items/keys.png", label: "Keys", x: 50, y: 5, size: 125, delay: 0.7 },
  {
    src: "/items/phone.png",
    label: "Phone",
    x: -15,
    y: 38,
    size: 130,
    delay: 1.4,
  },
  {
    src: "/items/red_backpack_image.png",
    label: "Backpack",
    x: -70,
    y: 80,
    size: 135,
    delay: 0.4,
  },
  {
    src: "/items/wallet.png",
    label: "Wallet",
    x: 78,
    y: 52,
    size: 120,
    delay: 1.1,
  },
  {
    src: "/items/water-bottle.png",
    label: "Water Bottle",
    x: 34,
    y: 82,
    size: 130,
    delay: 1.8,
  },
];

// ── COUNT-UP HOOK ──
function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) setStarted(true);
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);

  return { count, ref };
}

// ── STAT NUMBER COMPONENT ──
function StatNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const { count, ref } = useCountUp(value);
  return (
    <span className="stat-number" ref={ref}>
      {count}{suffix}
    </span>
  );
}

export default function Home() {
  const { language, hydrated } = useSettings();
  const router = useRouter();
  const { isSignedIn, user, isLoaded } = useUser();
  const [isReady, setIsReady] = useState(false);
  const [banChecked, setBanChecked] = useState(false);

  // typing effect
  const [displayText, setDisplayText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [translatedPhrases, setTranslatedPhrases] = useState<string[]>(TYPING_PHRASES);
  const [floatingLabels, setFloatingLabels] = useState<string[]>(FLOATING_ITEMS.map((item) => item.label));

  // translatable strings
  const [dontPanicText, setDontPanicText] = useState("Don't Panic.");
  const [connectingText, setConnectingText] = useState(
    "Connecting students, staff, and schools and reuniting everyone with what they've lost.",
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
    "Stop checking multiple offices or cardboard boxes throughout your school. All lost and found items live in one clean, searchable place.",
  );
  const [card2Body, setCard2Body] = useState(
    "Finder is made specifically for schools, from hallways to gyms to libraries. Nothing slips through our system.",
  );
  const [card3Body, setCard3Body] = useState(
    "Quickly match lost items with found ones and get belongings back to students in days, not weeks.",
  );
  const [card4Body, setCard4Body] = useState(
    "Filter by category, location, and time to instantly narrow down results and spot your item.",
  );
  const [card5Body, setCard5Body] = useState(
    "Anyone can report an item they found, creating a trusted, school-wide system that actually works.",
  );
  const [card6Body, setCard6Body] = useState(
    "Only your school community sees your items, keeping reports private and protected.",
  );
  const [eyebrowText, setEyebrowText] = useState("Built for students, by students");
  const [featLabelText, setFeatLabelText] = useState("Why Finder");
  const [featTitleText, setFeatTitleText] = useState("Everything you need to find it");
  const [featSubText, setFeatSubText] = useState("One platform for your entire campus: no bulletin boards, no missed pickups.");
  const [hiwLabelText, setHiwLabelText] = useState("How it works");
  const [hiwTitleText, setHiwTitleText] = useState("Just 3 Steps to Finding Your Items");
  const [hiwSubText, setHiwSubText] = useState("Simple enough for anyone on campus, powerful enough for every item.");
  const [step1TitleText, setStep1TitleText] = useState("Report It");
  const [step1BodyText, setStep1BodyText] = useState("Found something? Snap a photo, pick a category, drop the location. It goes live instantly.");
  const [step2TitleText, setStep2TitleText] = useState("Search & Match");
  const [step2BodyText, setStep2BodyText] = useState("Browse the dashboard with item listings, filter by type and location, or get notified when a match appears.");
  const [step3TitleText, setStep3TitleText] = useState("Get It Back");
  const [step3BodyText, setStep3BodyText] = useState("Message the finder directly through Finder, confirm it's yours, and arrange a pickup.");
  const [carouselLabelText, setCarouselLabelText] = useState("Features at a glance");
  const [card7TitleText, setCard7TitleText] = useState("Real-Time Notifications");
  const [card7BodyText, setCard7BodyText] = useState("Get alerted the moment something matching your item shows up on the board.");
  const [card8TitleText, setCard8TitleText] = useState("Built-In Messaging");
  const [card8BodyText, setCard8BodyText] = useState("Connect finders and owners directly inside the platform, with no sharing of personal info.");
  const [stat1LabelText, setStat1LabelText] = useState("Recoveries Made");
  const [stat2LabelText, setStat2LabelText] = useState("School-Private");
  const [stat3LabelText, setStat3LabelText] = useState("Schools Connected");
  const [stat4LabelText, setStat4LabelText] = useState("Items Supported");
  const [ctaTitleText, setCtaTitleText] = useState("Ready to find what you lost?");
  const [ctaSubText, setCtaSubText] = useState("Join your school community on Finder today or browse the general dashboard. It only takes a moment to sign up.");
  const [goDashboardText, setGoDashboardText] = useState("Go to Dashboard →");
  const [getStartedText, setGetStartedText] = useState("Get Started →");
  const [footerTaglineText, setFooterTaglineText] = useState("Lost & found, built for schools.");
  const [footerNavigateText, setFooterNavigateText] = useState("Navigate");
  const [footerDashText, setFooterDashText] = useState("Dashboard");
  const [footerSignInText, setFooterSignInText] = useState("Sign In");
  const [footerMessagesText, setFooterMessagesText] = useState("Messages");
  const [footerSchoolsText, setFooterSchoolsText] = useState("For Schools");
  const [footerHelpText, setFooterHelpText] = useState("Help");
  const [footerSettingsText, setFooterSettingsText] = useState("Settings");
  const [footerContactText, setFooterContactText] = useState("Contact");
  const [footerCopyText, setFooterCopyText] = useState("Built for students, by students.");

  // typing animation
  useEffect(() => {
    const current = translatedPhrases[phraseIndex] ?? TYPING_PHRASES[phraseIndex];
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
            setPhraseIndex((p) => (p + 1) % translatedPhrases.length);
          }
        }
      },
      isDeleting ? 42 : 82,
    );
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, phraseIndex, translatedPhrases]);

  // Reset animation state when translated phrases change (language switch)
  useEffect(() => {
    setPhraseIndex(0);
    setCharIndex(0);
    setIsDeleting(false);
    setDisplayText("");
  }, [translatedPhrases]);

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
    if (!hydrated) return;
    if (language === "en") {
      setDontPanicText("Don't Panic.");
      setConnectingText(
        "Connecting students, staff, and schools and reuniting everyone with what they've lost.",
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
        "Stop checking multiple offices or cardboard boxes throughout your school. All lost and found items live in one clean, searchable place.",
      );
      setCard2Body(
        "Finder is made specifically for schools, from hallways to gyms to libraries. Nothing slips through our system.",
      );
      setCard3Body(
        "Quickly match lost items with found ones and get belongings back to students in days, not weeks.",
      );
      setCard4Body(
        "Filter by category, location, and time to instantly narrow down results and spot your item.",
      );
      setCard5Body(
        "Anyone can report an item they found, creating a trusted, school-wide system that actually works.",
      );
      setCard6Body(
        "Only your school community sees your items, keeping reports private and protected.",
      );
      setEyebrowText("Built for students, by students");
      setFeatLabelText("Why Finder");
      setFeatTitleText("Everything you need to find it");
      setFeatSubText("One platform for your entire campus: no bulletin boards, no missed pickups.");
      setHiwLabelText("How it works");
      setHiwTitleText("Just 3 Steps to Finding Your Items");
      setHiwSubText("Simple enough for anyone on campus, powerful enough for every item.");
      setStep1TitleText("Report It");
      setStep1BodyText("Found something? Snap a photo, pick a category, drop the location. It goes live instantly.");
      setStep2TitleText("Search & Match");
      setStep2BodyText("Browse the dashboard with item listings, filter by type and location, or get notified when a match appears.");
      setStep3TitleText("Get It Back");
      setStep3BodyText("Message the finder directly through Finder, confirm it's yours, and arrange a pickup.");
      setCarouselLabelText("Features at a glance");
      setCard7TitleText("Real-Time Notifications");
      setCard7BodyText("Get alerted the moment something matching your item shows up on the board.");
      setCard8TitleText("Built-In Messaging");
      setCard8BodyText("Connect finders and owners directly inside the platform, with no sharing of personal info.");
      setStat1LabelText("Recoveries Made");
      setStat2LabelText("School-Private");
      setStat3LabelText("Schools Connected");
      setStat4LabelText("Items Supported");
      setCtaTitleText("Ready to find what you lost?");
      setCtaSubText("Join your school community on Finder today or browse the general dashboard. It only takes a moment to sign up.");
      setGoDashboardText("Go to Dashboard →");
      setGetStartedText("Get Started →");
      setFooterTaglineText("Lost & found, built for schools.");
      setFooterNavigateText("Navigate");
      setFooterDashText("Dashboard");
      setFooterSignInText("Sign In");
      setFooterMessagesText("Messages");
      setFooterSchoolsText("For Schools");
      setFooterHelpText("Help");
      setFooterSettingsText("Settings");
      setFooterContactText("Contact");
      setFooterCopyText("Built for students, by students.");
      setTranslatedPhrases(TYPING_PHRASES);
      setFloatingLabels(FLOATING_ITEMS.map((item) => item.label));
      setIsReady(true);
      return;
    }
    const translateAndCache = async () => {
      // Clear confirmed-stale entries: English values stored under non-English keys.
      const eyebrowKey = `home_eyebrow_${language}`;
      if (localStorage.getItem(eyebrowKey) === "Built for students, by students") {
        localStorage.removeItem(eyebrowKey);
      }
      TYPING_PHRASES.forEach((phrase, i) => {
        const phraseKey = `home_phrase${i}_${language}`;
        if (localStorage.getItem(phraseKey) === phrase) localStorage.removeItem(phraseKey);
      });

      const translations = [
        {
          key: "Don't Panic.",
          setter: setDontPanicText,
          cacheKey: "home_panic",
        },
        {
          key: "Connecting students, staff, and schools and reuniting everyone with what they've lost.",
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
          key: "Stop checking multiple offices or cardboard boxes throughout your school. All lost and found items live in one clean, searchable place.",
          setter: setCard1Body,
          cacheKey: "home_card1Body",
        },
        {
          key: "Finder is made specifically for schools, from hallways to gyms to libraries. Nothing slips through our system.",
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
          key: "Anyone can report an item they found, creating a trusted, school-wide system that actually works.",
          setter: setCard5Body,
          cacheKey: "home_card5Body",
        },
        {
          key: "Only your school community sees your items, keeping reports private and protected.",
          setter: setCard6Body,
          cacheKey: "home_card6Body",
        },
        { key: "Built for students, by students", setter: setEyebrowText, cacheKey: "home_eyebrow" },
        { key: "Why Finder", setter: setFeatLabelText, cacheKey: "home_featLabel" },
        { key: "Everything you need to find it", setter: setFeatTitleText, cacheKey: "home_featTitle" },
        { key: "One platform for your entire campus: no bulletin boards, no missed pickups.", setter: setFeatSubText, cacheKey: "home_featSub" },
        { key: "How it works", setter: setHiwLabelText, cacheKey: "home_hiwLabel" },
        { key: "Just 3 Steps to Finding Your Items", setter: setHiwTitleText, cacheKey: "home_hiwTitle" },
        { key: "Simple enough for anyone on campus, powerful enough for every item.", setter: setHiwSubText, cacheKey: "home_hiwSub" },
        { key: "Report It", setter: setStep1TitleText, cacheKey: "home_step1Title" },
        { key: "Found something? Snap a photo, pick a category, drop the location. It goes live instantly.", setter: setStep1BodyText, cacheKey: "home_step1Body" },
        { key: "Search & Match", setter: setStep2TitleText, cacheKey: "home_step2Title" },
        { key: "Browse the dashboard with item listings, filter by type and location, or get notified when a match appears.", setter: setStep2BodyText, cacheKey: "home_step2Body" },
        { key: "Get It Back", setter: setStep3TitleText, cacheKey: "home_step3Title" },
        { key: "Message the finder directly through Finder, confirm it's yours, and arrange a pickup.", setter: setStep3BodyText, cacheKey: "home_step3Body" },
        { key: "Features at a glance", setter: setCarouselLabelText, cacheKey: "home_carouselLabel" },
        { key: "Real-Time Notifications", setter: setCard7TitleText, cacheKey: "home_card7Title" },
        { key: "Get alerted the moment something matching your item shows up on the board.", setter: setCard7BodyText, cacheKey: "home_card7Body" },
        { key: "Built-In Messaging", setter: setCard8TitleText, cacheKey: "home_card8Title" },
        { key: "Connect finders and owners directly inside the platform, with no sharing of personal info.", setter: setCard8BodyText, cacheKey: "home_card8Body" },
        { key: "Recoveries Made", setter: setStat1LabelText, cacheKey: "home_stat1" },
        { key: "School-Private", setter: setStat2LabelText, cacheKey: "home_stat2" },
        { key: "Schools Connected", setter: setStat3LabelText, cacheKey: "home_stat3" },
        { key: "Items Supported", setter: setStat4LabelText, cacheKey: "home_stat4" },
        { key: "Ready to find what you lost?", setter: setCtaTitleText, cacheKey: "home_ctaTitle" },
        { key: "Join your school community on Finder today or browse the general dashboard. It only takes a moment to sign up.", setter: setCtaSubText, cacheKey: "home_ctaSub" },
        { key: "Go to Dashboard →", setter: setGoDashboardText, cacheKey: "home_goDash" },
        { key: "Get Started →", setter: setGetStartedText, cacheKey: "home_getStarted" },
        { key: "Lost & found, built for schools.", setter: setFooterTaglineText, cacheKey: "home_footerTagline" },
        { key: "Navigate", setter: setFooterNavigateText, cacheKey: "home_footerNavigate" },
        { key: "Dashboard", setter: setFooterDashText, cacheKey: "home_footerDash" },
        { key: "Sign In", setter: setFooterSignInText, cacheKey: "home_footerSignIn" },
        { key: "Messages", setter: setFooterMessagesText, cacheKey: "home_footerMessages" },
        { key: "For Schools", setter: setFooterSchoolsText, cacheKey: "home_footerSchools" },
        { key: "Help", setter: setFooterHelpText, cacheKey: "home_footerHelp" },
        { key: "Settings", setter: setFooterSettingsText, cacheKey: "home_footerSettings" },
        { key: "Contact", setter: setFooterContactText, cacheKey: "home_footerContact" },
        { key: "Built for students, by students.", setter: setFooterCopyText, cacheKey: "home_footerCopy" },
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
            if (data.translatedText) {
              setter(data.translatedText);
              localStorage.setItem(`${cacheKey}_${language}`, data.translatedText);
            }
          }
        } catch {
          /* keep defaults */
        }
      }

      // translate typing phrases
      const phraseCacheKeys = TYPING_PHRASES.map((_, i) => `home_phrase${i}`);
      const translated: string[] = [];
      for (let i = 0; i < TYPING_PHRASES.length; i++) {
        const cacheKey = phraseCacheKeys[i];
        const cached = localStorage.getItem(`${cacheKey}_${language}`);
        if (cached) {
          translated.push(cached);
          continue;
        }
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: TYPING_PHRASES[i], target: language }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.translatedText) {
              translated.push(data.translatedText);
              localStorage.setItem(`${cacheKey}_${language}`, data.translatedText);
            } else {
              translated.push(TYPING_PHRASES[i]);
            }
          } else {
            translated.push(TYPING_PHRASES[i]);
          }
        } catch {
          translated.push(TYPING_PHRASES[i]);
        }
      }
      setTranslatedPhrases(translated);

      // translate floating item labels
      const floatingCacheKeys = FLOATING_ITEMS.map((_, i) => `home_float${i}`);
      const translatedLabels: string[] = [];
      for (let i = 0; i < FLOATING_ITEMS.length; i++) {
        const cacheKey = floatingCacheKeys[i];
        const cached = localStorage.getItem(`${cacheKey}_${language}`);
        if (cached) {
          translatedLabels.push(cached);
          continue;
        }
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: FLOATING_ITEMS[i].label, target: language }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.translatedText) {
              translatedLabels.push(data.translatedText);
              localStorage.setItem(`${cacheKey}_${language}`, data.translatedText);
            } else {
              translatedLabels.push(FLOATING_ITEMS[i].label);
            }
          } else {
            translatedLabels.push(FLOATING_ITEMS[i].label);
          }
        } catch {
          translatedLabels.push(FLOATING_ITEMS[i].label);
        }
      }
      setFloatingLabels(translatedLabels);

      setIsReady(true);
    };
    translateAndCache();
  }, [language, hydrated]);

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

  const translatedCarouselCards = [
    { icon: <IoFolder />, title: card1Title, body: card1Body },
    { icon: <FaSchool />, title: card2Title, body: card2Body },
    { icon: <FaSearch />, title: card3Title, body: card3Body },
    { icon: <FaSlidersH />, title: card4Title, body: card4Body },
    { icon: <FaHandsHelping />, title: card5Title, body: card5Body },
    { icon: <FaShieldAlt />, title: card6Title, body: card6Body },
    { icon: <FaBell />, title: card7TitleText, body: card7BodyText },
    { icon: <FaComment />, title: card8TitleText, body: card8BodyText },
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
            {eyebrowText}
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
                className={`floating-item${draggingIndex === i ? " is-dragging" : ""}`}
                onPointerDown={(e) => onPointerDown(e, i)}
                style={
                  {
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    width: `${item.size}px`,
                    height: `${item.size}px`,
                    transform: `translate(${(positions[i] ?? { x: 0 }).x}px, ${(positions[i] ?? { x: 0, y: 0 }).y}px)`,
                    cursor: draggingIndex === i ? "grabbing" : "grab",
                    touchAction: "none",
                    "--bob-delay": `${item.delay}s`,
                  } as React.CSSProperties
                }
              >
                <div className="floating-item-bob">
                  <Image
                    src={item.src}
                    alt={floatingLabels[i] ?? item.label}
                    width={item.size}
                    height={item.size}
                    className="floating-item-img"
                    draggable={false}
                  />
                  <span className="floating-item-label">{floatingLabels[i] ?? item.label}</span>
                </div>
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
        <p className="section-label">{featLabelText}</p>
        <h2 className="section-title">{featTitleText}</h2>
        <p className="section-sub">{featSubText}</p>
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
        <p className="section-label">{hiwLabelText}</p>
        <h2 className="section-title">{hiwTitleText}</h2>
        <p className="section-sub">{hiwSubText}</p>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-icon">
              <PiNumberCircleOneFill />
            </div>
            <h3 className="step-title">{step1TitleText}</h3>
            <p className="step-body">{step1BodyText}</p>
          </div>
          <div className="step-connector" aria-hidden="true">
            · · ·
          </div>
          <div className="step-card">
            <div className="step-icon">
              <PiNumberCircleTwoFill />
            </div>
            <h3 className="step-title">{step2TitleText}</h3>
            <p className="step-body">{step2BodyText}</p>
          </div>
          <div className="step-connector" aria-hidden="true">
            · · ·
          </div>
          <div className="step-card">
            <div className="step-icon">
              <PiNumberCircleThreeFill />
            </div>
            <h3 className="step-title">{step3TitleText}</h3>
            <p className="step-body">{step3BodyText}</p>
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
          {carouselLabelText}
        </p>
        <div className="carousel-wrap">
          <div className="carousel-track">
            {[...translatedCarouselCards, ...translatedCarouselCards].map(
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
            <StatNumber value={40} suffix="+" />
            <span className="stat-label">{stat1LabelText}</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-number">100%</span>
            <span className="stat-label">{stat2LabelText}</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <StatNumber value={10} />
            <span className="stat-label">{stat3LabelText}</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <StatNumber value={250} suffix="+" />
            <span className="stat-label">{stat4LabelText}</span>
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
          <h2 className="cta-title">{ctaTitleText}</h2>
          <p className="cta-sub">{ctaSubText}</p>
          {isSignedIn ? (
            <button
              className="cta-btn"
              onClick={() => router.push("/dashboard")}
            >
              {goDashboardText}
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="cta-btn">{getStartedText}</button>
            </SignInButton>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-logo">Finder</span>
            <p className="footer-tagline">{footerTaglineText}</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <span className="footer-col-heading">{footerNavigateText}</span>
              {isSignedIn ? (
                <button
                  className="footer-link"
                  onClick={() => router.push("/dashboard")}
                >
                  {footerDashText}
                </button>
              ) : (
                <SignInButton mode="modal">
                  <button className="footer-link">{footerSignInText}</button>
                </SignInButton>
              )}
              {isSignedIn && (
                <button
                  className="footer-link"
                  onClick={() => router.push("/messages")}
                >
                  {footerMessagesText}
                </button>
              )}
              {isSignedIn && (
                <button
                  className="footer-link"
                  onClick={() => router.push("../schools")}
                >
                  {footerSchoolsText}
                </button>
              )}
              {isSignedIn && (
                <button
                  className="footer-link"
                  onClick={() => router.push("/help")}
                >
                  {footerHelpText}
                </button>
              )}
              {isSignedIn && (
                <button
                  className="footer-link"
                  onClick={() => router.push("/settings")}
                >
                  {footerSettingsText}
                </button>
              )}
            </div>
            <div className="footer-col">
              <span className="footer-col-heading">{footerContactText}</span>
              <a className="footer-link" href="mailto:finder.support@gmail.com">
                <FaEnvelope
                  style={{ display: "inline", marginRight: 6, fontSize: 12 }}
                />
                finder.support@gmail.com
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Finder. {footerCopyText}
          </span>
        </div>
      </footer>
    </div>
  );
}