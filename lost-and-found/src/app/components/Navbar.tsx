"use client";

import "./Navbar.css";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/dist/client/link";
import { CiSettings } from "react-icons/ci";
import { useSettings } from "@/context/SettingsContext";
import { SUPER_ADMINS } from "@/lib/superAdmin";

export default function Navbar() {
  // Auth state from Clerk.
  const { isSignedIn, user, isLoaded } = useUser();

  // Language preference is used to translate a few UI labels.
  const { language } = useSettings();
  const router = useRouter();

  // `mounted` is used to avoid SSR/client hydration mismatches when reading
  // values that only exist on the client (like `user` and localStorage translations).
  const [mounted, setMounted] = useState(false);

  // Number of unread messages for the current user.
  const [unreadCount, setUnreadCount] = useState(0);

  // Mobile sidebar open/closed state.
  const [mobileOpen, setMobileOpen] = useState(false);

  // Super-admins are determined by email allowlist.
  // We gate it behind `mounted` + `isLoaded` so SSR doesn't guess incorrectly.
  const isSuperAdmin =
    mounted &&
    isLoaded &&
    SUPER_ADMINS.includes(user?.primaryEmailAddress?.emailAddress ?? "");

  // Convenience flag for showing signed-in UI only when the client has mounted.
  const showSignedIn = mounted && isSignedIn;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper used by the mobile sidebar.
  // Always closes the sidebar before navigating.
  const navigate = (path: string) => {
    setMobileOpen(false);
    router.push(path);
  };

  useEffect(() => {
    // Prevent background scroll when the mobile sidebar is open.
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!user) return;

    // Initial unread count fetch.
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("read", false);
      setUnreadCount(count ?? 0);
    };
    fetchUnread();

    // Realtime listener for new incoming messages.
    // This only listens for INSERTs addressed to the current user.
    const channel = supabase
      .channel("navbar-unread")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => setUnreadCount((prev) => prev + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Translated UI labels (small subset used in the navbar).
  // Values are cached in localStorage with a language-specific key.
  const [dashboardText, setDashboardText] = useState("Dashboard");
  const [signUpText, setSignUpText] = useState("Sign Up");
  const [helpText, setHelpText] = useState("Help");
  const [schoolsText, setSchoolsText] = useState("For Schools");

  useEffect(() => {
    // On mount, try to read cached translations for the active language.
    // This keeps the navbar snappy without waiting for the translate API.
    if (language === "en") return;
    setDashboardText(
      localStorage.getItem(`nav_dashboard_${language}`) || "Dashboard",
    );
    setSignUpText(localStorage.getItem(`nav_signUp_${language}`) || "Sign Up");
    setHelpText(localStorage.getItem(`nav_help_${language}`) || "Help");
    setSchoolsText(
      localStorage.getItem("nav_schools_${language}") || "For Schools",
    );
  }, []);

  useEffect(() => {
    // When the user changes language:
    // - reset to English immediately
    // - otherwise translate the fixed labels and cache them
    if (language === "en") {
      setDashboardText("Dashboard");
      setSignUpText("Sign Up");
      setHelpText("Help");
      setSchoolsText("For Schools");
      return;
    }
    const translateAndCache = async () => {
      const translations = [
        {
          key: "Dashboard",
          setter: setDashboardText,
          cacheKey: "nav_dashboard",
        },
        { key: "Sign Up", setter: setSignUpText, cacheKey: "nav_signUp" },
        { key: "Help", setter: setHelpText, cacheKey: "nav_help" },
        { key: "For Schools", setter: setSchoolsText, cacheKey: "nav_schools" },
      ];

      for (const { key, setter, cacheKey } of translations) {
        try {
          // Delegate translation to the server route.
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
        } catch {}
      }
    };
    translateAndCache();
  }, [language]);

  return (
    <>
      <nav className="navbar">
        <Link href="/" className="logo">
          Findr
        </Link>

        {}
        <ul className="nav-links">
          <li>
            <Link href="/settings" className="settings-icon-btn">
              <CiSettings size={23} />
            </Link>
          </li>

          <li>
            {showSignedIn ? (
              <button
                className="dashboard-link"
                onClick={() => router.push("/dashboard")}
              >
                {dashboardText}
              </button>
            ) : (
              <SignInButton mode="modal">
                <button className="dashboard-link">{dashboardText}</button>
              </SignInButton>
            )}
          </li>
          {showSignedIn && (
            <li className="messages-nav-item">
              <button
                className="dashboard-link"
                onClick={() => {
                  setUnreadCount(0);
                  router.push("/messages");
                }}
              >
                Messages
                {unreadCount > 0 && (
                  <span className="unread-badge">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </li>
          )}
          <li>
            <button
              className="dashboard-link"
              onClick={() => router.push("/help")}
            >
              {helpText}
            </button>
          </li>

          {isSuperAdmin && (
            <li>
              <button
                className="dashboard-link"
                onClick={() => router.push("/super-admin")}
              >
                Super Admin
              </button>
            </li>
          )}

          <li>
            <button
              className="dashboard-link"
              onClick={() => router.push("/schools")}
            >
              {schoolsText}
            </button>
          </li>

          {showSignedIn ? (
            <li>
              <UserButton />
            </li>
          ) : (
            <li>
              <SignUpButton>
                <button className="sign-up">{signUpText}</button>
              </SignUpButton>
            </li>
          )}
        </ul>

        {}
        <div className="navbar-mobile-right">
          {showSignedIn && <UserButton />}
          <button
            className="navbar-hamburger"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <span
              className={`navbar-hamburger__bar${mobileOpen ? " open" : ""}`}
            />
            <span
              className={`navbar-hamburger__bar${mobileOpen ? " open" : ""}`}
            />
            <span
              className={`navbar-hamburger__bar${mobileOpen ? " open" : ""}`}
            />
          </button>
        </div>
      </nav>

      {}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {}
      <div
        className={`mobile-sidebar${mobileOpen ? " mobile-sidebar--open" : ""}`}
      >
        <div className="mobile-sidebar__header">
          <span className="mobile-sidebar__logo">Findr</span>
          <button
            className="mobile-sidebar__close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="mobile-sidebar__nav">
          {showSignedIn ? (
            <button
              className="mobile-sidebar__item"
              onClick={() => navigate("/dashboard")}
            >
              {dashboardText}
            </button>
          ) : (
            <SignInButton mode="modal">
              <button
                className="mobile-sidebar__item"
                onClick={() => setMobileOpen(false)}
              >
                {dashboardText}
              </button>
            </SignInButton>
          )}

          {showSignedIn && (
            <button
              className="mobile-sidebar__item messages-nav-item"
              onClick={() => {
                setUnreadCount(0);
                navigate("/messages");
              }}
            >
              Messages
              {unreadCount > 0 && (
                <span className="unread-badge">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}

          <button
            className="mobile-sidebar__item"
            onClick={() => navigate("/help")}
          >
            {helpText}
          </button>

          {isSuperAdmin && (
            <button
              className="mobile-sidebar__item"
              onClick={() => navigate("/super-admin")}
            >
              Super Admin
            </button>
          )}

          <button
            className="mobile-sidebar__item"
            onClick={() => navigate("/schools")}
          >
            {schoolsText}
          </button>

          <button
            className="mobile-sidebar__item mobile-sidebar__item--icon"
            onClick={() => navigate("/settings")}
          >
            <CiSettings size={18} />
            Settings
          </button>

          {!showSignedIn && (
            <SignUpButton>
              <button
                className="mobile-sidebar__signup"
                onClick={() => setMobileOpen(false)}
              >
                {signUpText}
              </button>
            </SignUpButton>
          )}
        </nav>
      </div>
      {/*The mobile sidebar is rendered in the DOM at all times but hidden when closed*/}
    </>
  );
}
