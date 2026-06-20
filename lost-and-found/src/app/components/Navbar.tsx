"use client";

import "./Navbar.css";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/dist/client/link";
import { CiSettings } from "react-icons/ci";
import {
  MdOutlineDashboard,
  MdOutlineMessage,
  MdOutlineSchool,
  MdOutlineHelp,
  MdOutlineAdminPanelSettings,
} from "react-icons/md";
import { HiSparkles } from "react-icons/hi2";
import { useSettings } from "@/context/SettingsContext";
import { SUPER_ADMINS } from "@/lib/superAdmin";
import AISearchButton from "./AISearchButton";

export default function Navbar() {
  const { isSignedIn, user, isLoaded } = useUser();
  const { language } = useSettings();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathname = usePathname();

  const isSuperAdmin =
    mounted &&
    isLoaded &&
    SUPER_ADMINS.includes(user?.primaryEmailAddress?.emailAddress ?? "");

  const showSignedIn = mounted && isSignedIn;

  useEffect(() => {
    setMounted(true);
  }, []);

  const navigate = (path: string) => {
    setMobileOpen(false);
    router.push(path);
  };

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("read", false);
      setUnreadCount(count ?? 0);
    };
    fetchUnread();

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

  const [dashboardText, setDashboardText] = useState("Dashboard");
  const [messagesText, setMessagesText] = useState("Messages");
  const [signInText, setSignInText] = useState("Sign In");
  const [signUpText, setSignUpText] = useState("Sign Up");
  const [helpText, setHelpText] = useState("Help");
  const [schoolsText, setSchoolsText] = useState("For Schools");
  const [superAdminText, setSuperAdminText] = useState("Super Admin");

  useEffect(() => {
    if (language === "en") return;
    setDashboardText(localStorage.getItem(`nav_dashboard_${language}`) || "Dashboard");
    setMessagesText(localStorage.getItem(`nav_messages_${language}`) || "Messages");
    setSignInText(localStorage.getItem(`nav_signIn_${language}`) || "Sign In");
    setSignUpText(localStorage.getItem(`nav_signUp_${language}`) || "Sign Up");
    setHelpText(localStorage.getItem(`nav_help_${language}`) || "Help");
    setSchoolsText(localStorage.getItem(`nav_schools_${language}`) || "For Schools");
    setSuperAdminText(localStorage.getItem(`nav_superAdmin_${language}`) || "Super Admin");
  }, []);

  useEffect(() => {
    if (language === "en") {
      setDashboardText("Dashboard");
      setMessagesText("Messages");
      setSignInText("Sign In");
      setSignUpText("Sign Up");
      setHelpText("Help");
      setSchoolsText("For Schools");
      setSuperAdminText("Super Admin");
      return;
    }
    const translateAndCache = async () => {
      const translations = [
        { key: "Dashboard", setter: setDashboardText, cacheKey: "nav_dashboard" },
        { key: "Messages", setter: setMessagesText, cacheKey: "nav_messages" },
        { key: "Sign In", setter: setSignInText, cacheKey: "nav_signIn" },
        { key: "Sign Up", setter: setSignUpText, cacheKey: "nav_signUp" },
        { key: "Help", setter: setHelpText, cacheKey: "nav_help" },
        { key: "For Schools", setter: setSchoolsText, cacheKey: "nav_schools" },
        { key: "Super Admin", setter: setSuperAdminText, cacheKey: "nav_superAdmin" },
      ];
      for (const { key, setter, cacheKey } of translations) {
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
        } catch {}
      }
    };
    translateAndCache();
  }, [language]);

  // ─── sidebar nav items ──────────────────────────────────────────────
  const navItems = [
    {
      label: dashboardText,
      icon: <MdOutlineDashboard size={22} />,
      path: "/dashboard",
      requiresAuth: true,
    },
    {
      label: messagesText,
      icon: <MdOutlineMessage size={22} />,
      path: "/messages",
      requiresAuth: true,
      badge: unreadCount,
    },
    {
      label: schoolsText,
      icon: <MdOutlineSchool size={22} />,
      path: "/schools",
      requiresAuth: true,
    },
    ...(isSuperAdmin
      ? [
          {
            label: superAdminText,
            icon: <MdOutlineAdminPanelSettings size={22} />,
            path: "/super-admin",
            requiresAuth: true,
          },
        ]
      : []),
  ];

  return (
    <>
      {/* ── TOP BAR ────────────────────────────────────────────────────── */}
      <header className="topbar">
        {/* Logo */}
        <Link href="/" className="topbar__logo">
          Findr
        </Link>

        {/* Right cluster */}
        <div className="topbar__right">
          {showSignedIn ? (
            <AISearchButton />
          ) : (
            <SignInButton mode="modal">
              <button
                title="AI Search"
                aria-label="AI Search"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 13px",
                  borderRadius: 10,
                  border: "1.5px solid var(--border-input)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s",
                }}
              >
                <HiSparkles size={16} />
                <span>AI Search</span>
              </button>
            </SignInButton>
          )}

          <button
            className="topbar__icon-btn topbar__icon-btn--settings"
            onClick={() => router.push("/settings")}
            aria-label="Settings"
            title="Settings"
          >
            <CiSettings size={30} />
          </button>

          {showSignedIn ? (
            <button
              className="topbar__icon-btn"
              onClick={() => router.push("/help")}
              aria-label={helpText}
              title={helpText}
              style={{ marginRight: "8px", marginLeft: "2px" }}
            >
              <MdOutlineHelp size={30} />
            </button>
          ) : (
            <SignInButton mode="modal">
              <button
                className="topbar__icon-btn"
                aria-label={helpText}
                title={helpText}
                style={{ marginRight: "8px", marginLeft: "2px" }}
              >
                <MdOutlineHelp size={30} />
              </button>
            </SignInButton>
          )}

          <div className="topbar__divider" />

          {showSignedIn ? (
            <UserButton />
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="topbar__signin-btn">{signInText}</button>
              </SignInButton>
              <SignUpButton>
                <button className="topbar__signup-btn">{signUpText}</button>
              </SignUpButton>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            className="topbar__hamburger"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <span
              className={`topbar__hamburger-bar${mobileOpen ? " open" : ""}`}
            />
            <span
              className={`topbar__hamburger-bar${mobileOpen ? " open" : ""}`}
            />
            <span
              className={`topbar__hamburger-bar${mobileOpen ? " open" : ""}`}
            />
          </button>
        </div>
      </header>

      {/* ── LEFT SIDEBAR ───────────────────────────────────────────────── */}
      <aside className="left-sidebar" aria-label="Main navigation">
        <nav className="left-sidebar__nav">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const btn = (
              <button
                key={item.path}
                className={`left-sidebar__item${isActive ? " left-sidebar__item--active" : ""}`}
                onClick={() => {
                  if (item.badge !== undefined) setUnreadCount(0);
                  navigate(item.path);
                }}
                title={item.label}
              >
                <span className="left-sidebar__icon">{item.icon}</span>
                <span className="left-sidebar__label">{item.label}</span>
                {!!item.badge && item.badge > 0 && (
                  <span className="left-sidebar__badge">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </button>
            );

            if (item.requiresAuth && !showSignedIn) {
              return (
                <SignInButton key={item.path} mode="modal">
                  <button
                    className={`left-sidebar__item${isActive ? " left-sidebar__item--active" : ""}`}
                    title={item.label}
                  >
                    <span className="left-sidebar__icon">{item.icon}</span>
                    <span className="left-sidebar__label">{item.label}</span>
                  </button>
                </SignInButton>
              );
            }
            return btn;
          })}
        </nav>
      </aside>

      {/* ── MOBILE OVERLAY + SIDEBAR ───────────────────────────────────── */}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}

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
          {navItems.map((item) => {
            const btn = (
              <button
                key={item.path}
                className="mobile-sidebar__item"
                onClick={() => {
                  if (item.badge !== undefined) setUnreadCount(0);
                  navigate(item.path);
                }}
              >
                {item.icon}
                {item.label}
                {!!item.badge && item.badge > 0 && (
                  <span className="unread-badge">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </button>
            );

            if (item.requiresAuth && !showSignedIn) {
              return (
                <SignInButton key={item.path} mode="modal">
                  <button
                    className="mobile-sidebar__item"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                </SignInButton>
              );
            }
            return btn;
          })}

          {/* AI Search — mirrors AISearchButton's icon/label, gated like topbar */}
          {showSignedIn ? (
            <button
              className="mobile-sidebar__item mobile-sidebar__item--icon"
              onClick={() => navigate("/ai-search")}
            >
              <HiSparkles size={18} />
              AI Search
            </button>
          ) : (
            <SignInButton mode="modal">
              <button
                className="mobile-sidebar__item mobile-sidebar__item--icon"
                onClick={() => setMobileOpen(false)}
              >
                <HiSparkles size={18} />
                AI Search
              </button>
            </SignInButton>
          )}

          {/* Help — gated like topbar */}
          {showSignedIn ? (
            <button
              className="mobile-sidebar__item mobile-sidebar__item--icon"
              onClick={() => navigate("/help")}
            >
              <MdOutlineHelp size={18} />
              {helpText}
            </button>
          ) : (
            <SignInButton mode="modal">
              <button
                className="mobile-sidebar__item mobile-sidebar__item--icon"
                onClick={() => setMobileOpen(false)}
              >
                <MdOutlineHelp size={18} />
                {helpText}
              </button>
            </SignInButton>
          )}

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
    </>
  );
}
