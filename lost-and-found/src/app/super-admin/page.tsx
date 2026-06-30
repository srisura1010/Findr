"use client";

import "./superadmin.css";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { SUPER_ADMINS } from "@/lib/superAdmin";
import { useSettings } from "@/context/SettingsContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";

//a pending admin approval request from a staff member
interface AdminRequest {
  id: string;
  name: string;
  email: string;
  school: string;
  teacher_id: string;
  extra_info: string;
  id_image_url: string;
  status: string;
  submitted_at: string;
}

//a pending school registration request
interface SchoolRequest {
  id: string;
  name: string;
  website_url: string | null;
  logo_url: string | null;
  doc_url: string | null;
  color: string;
  secondary_color: string | null;
  bg_image_url: string | null;
  gradient_mode: number | null;
  theme: string;
  rep_name: string;
  rep_email: string;
  rep_user_id: string;
  rep_role: string | null;
  extra_info: string | null;
  status: string;
  created_at: string;
}

//generates a random 10-character alphanumeric admin password
function generatePassword(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)))
    .map((b) => chars[b % chars.length])
    .join("");
}

//generates a unique school code from the school name, current year, and a random suffix
function generateSchoolCode(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("-");
  const suffix = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${slug}-${suffix}-${rand}`;
}

//sends a transactional email via an API route; logs failures but never throws
async function sendEmail(route: string, body: Record<string, string>) {
  try {
    await fetch(`/api/emails/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`Failed to send email [${route}]:`, err);
  }
}

//super-admin panel for approving admin requests, managing schools, and reviewing all items
export default function SuperAdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { language, hydrated } = useSettings();

  const [adminRequests, setAdminRequests] = useState<AdminRequest[]>([]);
  const [schoolRequests, setSchoolRequests] = useState<SchoolRequest[]>([]);

  const [isReady, setIsReady] = useState(false);
  const [pageTitleText, setPageTitleText] = useState("Super Admin");
  const [pageSubtitleText, setPageSubtitleText] = useState("Manage admin requests for Finder");
  const [adminRequestsTabText, setAdminRequestsTabText] = useState("Admin Requests");
  const [schoolRequestsTabText, setSchoolRequestsTabText] = useState("School Requests");
  const [pendingText, setPendingText] = useState("Pending");
  const [reviewedText, setReviewedText] = useState("Reviewed");
  const [loadingText, setLoadingText] = useState("Loading...");
  const [noPendingAdminsText, setNoPendingAdminsText] = useState("No pending requests 🎉");
  const [noPendingSchoolsText, setNoPendingSchoolsText] = useState("No pending school requests 🎉");
  const [approveText, setApproveText] = useState("✓ Approve");
  const [approvingText, setApprovingText] = useState("Approving...");
  const [rejectText, setRejectText] = useState("✕ Reject");
  const [rejectingText, setRejectingText] = useState("Rejecting...");
  const [removeAdminText, setRemoveAdminText] = useState("✕ Remove Admin");
  const [removingText, setRemovingText] = useState("Removing...");
  const [schoolLabelText, setSchoolLabelText] = useState("School");
  const [teacherIdLabelText, setTeacherIdLabelText] = useState("Teacher ID");
  const [extraInfoLabelText, setExtraInfoLabelText] = useState("Extra Info");
  const [submittedLabelText, setSubmittedLabelText] = useState("Submitted");
  const [viewIdPhotoText, setViewIdPhotoText] = useState("View ID Photo ↗");
  const [repNameLabelText, setRepNameLabelText] = useState("Rep Name");
  const [repRoleLabelText, setRepRoleLabelText] = useState("Rep Role");
  const [websiteLabelText, setWebsiteLabelText] = useState("Website");
  const [themeLabelText, setThemeLabelText] = useState("Theme");
  const [brandColorLabelText, setBrandColorLabelText] = useState("Brand Color:");
  const [viewVerificationDocText, setViewVerificationDocText] = useState("View Verification Doc ↗");

  useEffect(() => {
    if (!hydrated) return;
    if (language === "en") {
      setPageTitleText("Super Admin");
      setPageSubtitleText("Manage admin requests for Finder");
      setAdminRequestsTabText("Admin Requests");
      setSchoolRequestsTabText("School Requests");
      setPendingText("Pending");
      setReviewedText("Reviewed");
      setLoadingText("Loading...");
      setNoPendingAdminsText("No pending requests 🎉");
      setNoPendingSchoolsText("No pending school requests 🎉");
      setApproveText("✓ Approve");
      setApprovingText("Approving...");
      setRejectText("✕ Reject");
      setRejectingText("Rejecting...");
      setRemoveAdminText("✕ Remove Admin");
      setRemovingText("Removing...");
      setSchoolLabelText("School");
      setTeacherIdLabelText("Teacher ID");
      setExtraInfoLabelText("Extra Info");
      setSubmittedLabelText("Submitted");
      setViewIdPhotoText("View ID Photo ↗");
      setRepNameLabelText("Rep Name");
      setRepRoleLabelText("Rep Role");
      setWebsiteLabelText("Website");
      setThemeLabelText("Theme");
      setBrandColorLabelText("Brand Color:");
      setViewVerificationDocText("View Verification Doc ↗");
      setIsReady(true);
      return;
    }
    const translateAndCache = async () => {
      const translations = [
        { key: "Super Admin", setter: setPageTitleText, cacheKey: "sa_title" },
        { key: "Manage admin requests for Finder", setter: setPageSubtitleText, cacheKey: "sa_subtitle" },
        { key: "Admin Requests", setter: setAdminRequestsTabText, cacheKey: "sa_adminTab" },
        { key: "School Requests", setter: setSchoolRequestsTabText, cacheKey: "sa_schoolTab" },
        { key: "Pending", setter: setPendingText, cacheKey: "sa_pending" },
        { key: "Reviewed", setter: setReviewedText, cacheKey: "sa_reviewed" },
        { key: "Loading...", setter: setLoadingText, cacheKey: "sa_loading" },
        { key: "No pending requests", setter: setNoPendingAdminsText, cacheKey: "sa_noPendingAdmins" },
        { key: "No pending school requests", setter: setNoPendingSchoolsText, cacheKey: "sa_noPendingSchools" },
        { key: "Approve", setter: setApproveText, cacheKey: "sa_approve" },
        { key: "Approving...", setter: setApprovingText, cacheKey: "sa_approving" },
        { key: "Reject", setter: setRejectText, cacheKey: "sa_reject" },
        { key: "Rejecting...", setter: setRejectingText, cacheKey: "sa_rejecting" },
        { key: "Remove Admin", setter: setRemoveAdminText, cacheKey: "sa_removeAdmin" },
        { key: "Removing...", setter: setRemovingText, cacheKey: "sa_removing" },
        { key: "School", setter: setSchoolLabelText, cacheKey: "sa_school" },
        { key: "Teacher ID", setter: setTeacherIdLabelText, cacheKey: "sa_teacherId" },
        { key: "Extra Info", setter: setExtraInfoLabelText, cacheKey: "sa_extraInfo" },
        { key: "Submitted", setter: setSubmittedLabelText, cacheKey: "sa_submitted" },
        { key: "View ID Photo", setter: setViewIdPhotoText, cacheKey: "sa_viewId" },
        { key: "Rep Name", setter: setRepNameLabelText, cacheKey: "sa_repName" },
        { key: "Rep Role", setter: setRepRoleLabelText, cacheKey: "sa_repRole" },
        { key: "Website", setter: setWebsiteLabelText, cacheKey: "sa_website" },
        { key: "Theme", setter: setThemeLabelText, cacheKey: "sa_theme" },
        { key: "Brand Color", setter: setBrandColorLabelText, cacheKey: "sa_brandColor" },
        { key: "View Verification Doc", setter: setViewVerificationDocText, cacheKey: "sa_viewDoc" },
      ];
      for (const { key, setter, cacheKey } of translations) {
        const cached = localStorage.getItem(`${cacheKey}_${language}`);
        if (cached) { setter(cached); continue; }
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
        } catch { /* keep defaults */ }
      }
      setIsReady(true);
    };
    translateAndCache();
  }, [language, hydrated]);
  const [loading, setLoading] = useState(true);

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [schoolApprovingId, setSchoolApprovingId] = useState<string | null>(null);
  const [schoolRejectingId, setSchoolRejectingId] = useState<string | null>(null);

  const [section, setSection] = useState<"admins" | "schools">("admins");

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const isSuperAdmin = SUPER_ADMINS.includes(userEmail);

  useEffect(() => {
    if (isLoaded && !isSuperAdmin) router.push("/");
  }, [isLoaded, isSuperAdmin, router]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchAll();
  }, [isSuperAdmin]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: ar }, { data: sr }] = await Promise.all([
      supabase
        .from("admin_requests")
        .select("*")
        .order("submitted_at", { ascending: false }),
      supabase
        .from("school_requests")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    if (ar) setAdminRequests(ar);
    if (sr) setSchoolRequests(sr as SchoolRequest[]);
    setLoading(false);
  };

  // ── Admin request handlers ────────────────────────────────────────────────
  const handleApprove = async (request: AdminRequest) => {
    setApprovingId(request.id);
    try {
      const { data: existing } = await supabase
        .from("admins")
        .select("id")
        .eq("email", request.email)
        .maybeSingle();
      if (existing) {
        alert("This person is already an admin.");
        return;
      }
      const password = generatePassword();
      const { error: insertError } = await supabase.from("admins").insert({
        name: request.name,
        email: request.email,
        password,
      });
      if (insertError) throw insertError;

      await supabase.from("admin_requests").delete().eq("id", request.id);

      await sendEmail("admin-approved", {
        name: request.name,
        email: request.email,
        password,
      });

      setAdminRequests((prev) => prev.filter((r) => r.id !== request.id));
      alert(`Approved! Password sent to ${request.email}`);
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Check the console.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (request: AdminRequest) => {
    setRejectingId(request.id);
    try {
      const { error } = await supabase
        .from("admin_requests")
        .update({ status: "rejected" })
        .eq("id", request.id);
      if (error) throw error;

      await sendEmail("admin-rejected", {
        name: request.name,
        email: request.email,
      });

      setAdminRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status: "rejected" } : r))
      );
    } catch (err) {
      console.error("Failed to reject:", err);
      alert("Something went wrong rejecting this request.");
    } finally {
      setRejectingId(null);
    }
  };

  const handleRemoveAdmin = async (email: string, requestId: string) => {
    if (
      !confirm(
        `Remove admin access for ${email}? Their password will stop working immediately.`
      )
    )
      return;
    setRemovingId(requestId);
    try {
      const { error } = await supabase
        .from("admins")
        .delete()
        .eq("email", email);
      if (error) throw error;
      await supabase
        .from("admin_requests")
        .update({ status: "removed" })
        .eq("id", requestId);
      setAdminRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: "removed" } : r
        )
      );
      alert(`Admin access removed for ${email}`);
    } catch (err) {
      console.error(err);
      alert("Something went wrong removing admin.");
    } finally {
      setRemovingId(null);
    }
  };

  // ── School request handlers ───────────────────────────────────────────────
  const handleApproveSchool = async (request: SchoolRequest) => {
    setSchoolApprovingId(request.id);
    try {
      const code = generateSchoolCode(request.name);
      const password = generatePassword();

      const { error: insertError } = await supabase.from("schools").insert({
        name: request.name,
        code,
        password,
        logo_url: request.logo_url ?? null,
        color: request.color,
        secondary_color: request.secondary_color ?? "#f5c842",
        bg_image_url: request.bg_image_url ?? null,
        gradient_mode: request.gradient_mode ?? 0,
        theme: request.theme,
        website_url: request.website_url ?? null,
        rep_name: request.rep_name,
        rep_email: request.rep_email,
        rep_user_id: request.rep_user_id,
        rep_role: request.rep_role ?? null,
        extra_info: request.extra_info ?? null,
        doc_url: request.doc_url ?? null,
        status: "approved",
      });
      if (insertError) {
        console.error("Supabase insert error:", JSON.stringify(insertError));
        alert(`DB error: ${insertError.message} (${insertError.code})`);
        return;
      }

      const { error: updateError } = await supabase
        .from("school_requests")
        .update({ status: "approved" })
        .eq("id", request.id);
      if (updateError) {
        console.error("Supabase update error:", JSON.stringify(updateError));
        alert(`School row created but status update failed: ${updateError.message}

Run this in Supabase SQL editor to fix RLS:
CREATE POLICY "update school_requests" ON school_requests FOR UPDATE USING (true);`);
      }

      await sendEmail("school-approved", {
        name: request.rep_name,
        email: request.rep_email,
        school_name: request.name,
        school_code: code,
        school_password: password,
      });

      setSchoolRequests((prev) =>
        prev.map((r) =>
          r.id === request.id ? { ...r, status: "approved" } : r
        )
      );
      alert(`School approved!

School Code (for all members to join): ${code}
Admin Password (for rep to unlock admin panel): ${password}

Sent to ${request.rep_email} via email.`);
    } catch (err: any) {
      const msg = err?.message ?? JSON.stringify(err);
      console.error("handleApproveSchool error:", msg, err);
      alert(`Something went wrong: ${msg}`);
    } finally {
      setSchoolApprovingId(null);
    }
  };

  const handleRejectSchool = async (request: SchoolRequest) => {
    setSchoolRejectingId(request.id);
    try {
      const { error } = await supabase
        .from("school_requests")
        .update({ status: "rejected" })
        .eq("id", request.id);
      if (error) {
        console.error("Reject error:", JSON.stringify(error));
        alert(`Update failed: ${error.message}

You may be missing an RLS UPDATE policy on school_requests.
Run in Supabase SQL editor:
CREATE POLICY "update school_requests" ON school_requests FOR UPDATE USING (true);`);
        return;
      }

      await sendEmail("school-rejected", {
        name: request.rep_name,
        email: request.rep_email,
        school_name: request.name,
      });

      setSchoolRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status: "rejected" } : r))
      );
    } catch (err: any) {
      console.error("Failed to reject:", err);
      alert("Something went wrong rejecting this request.");
    } finally {
      setSchoolRejectingId(null);
    }
  };

  if (!isLoaded || !isSuperAdmin) return null;
  if (!isReady) return <LoadingSpinner />;

  const pendingAdmins = adminRequests.filter((r) => r.status === "pending");
  const reviewedAdmins = adminRequests.filter((r) => r.status !== "pending");
  const pendingSchools = schoolRequests.filter((r) => r.status === "pending");
  const reviewedSchools = schoolRequests.filter((r) => r.status !== "pending");

  return (
    <div className="sa-page">
      <div className="sa-container">
        <div className="sa-header">
          <h1 className="sa-title">{pageTitleText}</h1>
          <p className="sa-subtitle">{pageSubtitleText}</p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "24px",
            borderBottom: "1px solid var(--border-default, #e5e7eb)",
            paddingBottom: "0",
          }}
        >
          {(["admins", "schools"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              style={{
                padding: "8px 20px",
                borderRadius: "8px 8px 0 0",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.9rem",
                fontFamily: "var(--font-body)",
                background:
                  section === s ? "var(--accent, #f97316)" : "transparent",
                color:
                  section === s ? "#fff" : "var(--text-muted, #9ca3af)",
                transition: "all 0.15s ease",
                position: "relative",
                bottom: "-1px",
              }}
            >
              {s === "admins" ? adminRequestsTabText : schoolRequestsTabText}
              {s === "admins" && pendingAdmins.length > 0 && (
                <span className="sa-badge" style={{ marginLeft: "6px" }}>
                  {pendingAdmins.length}
                </span>
              )}
              {s === "schools" && pendingSchools.length > 0 && (
                <span className="sa-badge" style={{ marginLeft: "6px" }}>
                  {pendingSchools.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── ADMIN REQUESTS SECTION ── */}
        {section === "admins" && (
          <>
            <section className="sa-section">
              <h2 className="sa-section-title">
                {pendingText}
                <span className="sa-badge">{pendingAdmins.length}</span>
              </h2>
              {loading ? (
                <p className="sa-empty">{loadingText}</p>
              ) : pendingAdmins.length === 0 ? (
                <p className="sa-empty">{noPendingAdminsText}</p>
              ) : (
                pendingAdmins.map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    onApprove={() => handleApprove(r)}
                    onReject={() => handleReject(r)}
                    approving={approvingId === r.id}
                    rejecting={rejectingId === r.id}
                    approveText={approveText}
                    approvingText={approvingText}
                    rejectText={rejectText}
                    rejectingText={rejectingText}
                    schoolLabel={schoolLabelText}
                    teacherIdLabel={teacherIdLabelText}
                    extraInfoLabel={extraInfoLabelText}
                    submittedLabel={submittedLabelText}
                    viewIdPhotoText={viewIdPhotoText}
                  />
                ))
              )}
            </section>

            {reviewedAdmins.length > 0 && (
              <section className="sa-section">
                <h2 className="sa-section-title">{reviewedText}</h2>
                {reviewedAdmins.map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    reviewed
                    onRemove={
                      r.status === "approved"
                        ? () => handleRemoveAdmin(r.email, r.id)
                        : undefined
                    }
                    removing={removingId === r.id}
                    removeAdminText={removeAdminText}
                    removingText={removingText}
                    schoolLabel={schoolLabelText}
                    teacherIdLabel={teacherIdLabelText}
                    extraInfoLabel={extraInfoLabelText}
                    submittedLabel={submittedLabelText}
                    viewIdPhotoText={viewIdPhotoText}
                  />
                ))}
              </section>
            )}
          </>
        )}

        {/* ── SCHOOL REQUESTS SECTION ── */}
        {section === "schools" && (
          <>
            <section className="sa-section">
              <h2 className="sa-section-title">
                {pendingText}
                <span className="sa-badge">{pendingSchools.length}</span>
              </h2>
              {loading ? (
                <p className="sa-empty">{loadingText}</p>
              ) : pendingSchools.length === 0 ? (
                <p className="sa-empty">{noPendingSchoolsText}</p>
              ) : (
                pendingSchools.map((r) => (
                  <SchoolRequestCard
                    key={r.id}
                    request={r}
                    onApprove={() => handleApproveSchool(r)}
                    onReject={() => handleRejectSchool(r)}
                    approving={schoolApprovingId === r.id}
                    rejecting={schoolRejectingId === r.id}
                    approveText={approveText}
                    approvingText={approvingText}
                    rejectText={rejectText}
                    rejectingText={rejectingText}
                    repNameLabel={repNameLabelText}
                    repRoleLabel={repRoleLabelText}
                    websiteLabel={websiteLabelText}
                    themeLabel={themeLabelText}
                    extraInfoLabel={extraInfoLabelText}
                    submittedLabel={submittedLabelText}
                    brandColorLabel={brandColorLabelText}
                    viewVerificationDocText={viewVerificationDocText}
                  />
                ))
              )}
            </section>

            {reviewedSchools.length > 0 && (
              <section className="sa-section">
                <h2 className="sa-section-title">{reviewedText}</h2>
                {reviewedSchools.map((r) => (
                  <SchoolRequestCard
                    key={r.id}
                    request={r}
                    reviewed
                    repNameLabel={repNameLabelText}
                    repRoleLabel={repRoleLabelText}
                    websiteLabel={websiteLabelText}
                    themeLabel={themeLabelText}
                    extraInfoLabel={extraInfoLabelText}
                    submittedLabel={submittedLabelText}
                    brandColorLabel={brandColorLabelText}
                    viewVerificationDocText={viewVerificationDocText}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Admin Request Card ────────────────────────────────────────────────────────
function RequestCard({
  request,
  onApprove,
  onReject,
  approving,
  rejecting,
  reviewed,
  onRemove,
  removing,
  approveText = "✓ Approve",
  approvingText = "Approving...",
  rejectText = "✕ Reject",
  rejectingText = "Rejecting...",
  removeAdminText = "✕ Remove Admin",
  removingText = "Removing...",
  schoolLabel = "School",
  teacherIdLabel = "Teacher ID",
  extraInfoLabel = "Extra Info",
  submittedLabel = "Submitted",
  viewIdPhotoText = "View ID Photo ↗",
}: {
  request: AdminRequest;
  onApprove?: () => void;
  onReject?: () => void;
  approving?: boolean;
  rejecting?: boolean;
  reviewed?: boolean;
  onRemove?: () => void;
  removing?: boolean;
  approveText?: string;
  approvingText?: string;
  rejectText?: string;
  rejectingText?: string;
  removeAdminText?: string;
  removingText?: string;
  schoolLabel?: string;
  teacherIdLabel?: string;
  extraInfoLabel?: string;
  submittedLabel?: string;
  viewIdPhotoText?: string;
}) {
  const statusClass =
    request.status === "approved"
      ? "sa-status--approved"
      : request.status === "rejected"
      ? "sa-status--rejected"
      : request.status === "removed"
      ? "sa-status--removed"
      : "sa-status--pending";

  return (
    <div className="sa-card">
      <div className="sa-card-top">
        <div>
          <p className="sa-card-name">{request.name}</p>
          <p className="sa-card-email">{request.email}</p>
        </div>
        <span className={`sa-status ${statusClass}`}>
          {request.status.toUpperCase()}
        </span>
      </div>

      <div className="sa-card-details">
        <Detail label={schoolLabel} value={request.school} />
        <Detail label={teacherIdLabel} value={request.teacher_id} />
        {request.extra_info && (
          <Detail label={extraInfoLabel} value={request.extra_info} />
        )}
        <Detail
          label={submittedLabel}
          value={new Date(request.submitted_at).toLocaleDateString()}
        />
      </div>

      {request.id_image_url && (
        <a
          href={request.id_image_url}
          target="_blank"
          rel="noreferrer"
          className="sa-image-link"
        >
          {viewIdPhotoText}
        </a>
      )}

      {!reviewed && (
        <div className="sa-card-actions">
          <button
            className="sa-btn sa-btn--approve"
            onClick={onApprove}
            disabled={approving}
          >
            {approving ? approvingText : approveText}
          </button>
          <button
            className="sa-btn sa-btn--reject"
            onClick={onReject}
            disabled={rejecting}
          >
            {rejecting ? rejectingText : rejectText}
          </button>
        </div>
      )}

      {reviewed && onRemove && (
        <div className="sa-card-actions">
          <button
            className="sa-btn sa-btn--remove"
            onClick={onRemove}
            disabled={removing}
          >
            {removing ? removingText : removeAdminText}
          </button>
        </div>
      )}
    </div>
  );
}

// ── School Request Card ───────────────────────────────────────────────────────
function SchoolRequestCard({
  request,
  onApprove,
  onReject,
  approving,
  rejecting,
  reviewed,
  approveText = "✓ Approve",
  approvingText = "Approving...",
  rejectText = "✕ Reject",
  rejectingText = "Rejecting...",
  repNameLabel = "Rep Name",
  repRoleLabel = "Rep Role",
  websiteLabel = "Website",
  themeLabel = "Theme",
  extraInfoLabel = "Extra Info",
  submittedLabel = "Submitted",
  brandColorLabel = "Brand Color:",
  viewVerificationDocText = "View Verification Doc ↗",
}: {
  request: SchoolRequest;
  onApprove?: () => void;
  onReject?: () => void;
  approving?: boolean;
  rejecting?: boolean;
  reviewed?: boolean;
  approveText?: string;
  approvingText?: string;
  rejectText?: string;
  rejectingText?: string;
  repNameLabel?: string;
  repRoleLabel?: string;
  websiteLabel?: string;
  themeLabel?: string;
  extraInfoLabel?: string;
  submittedLabel?: string;
  brandColorLabel?: string;
  viewVerificationDocText?: string;
}) {
  const statusClass =
    request.status === "approved"
      ? "sa-status--approved"
      : request.status === "rejected"
      ? "sa-status--rejected"
      : "sa-status--pending";

  return (
    <div className="sa-card">
      <div className="sa-card-top">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {request.logo_url ? (
            <img
              src={request.logo_url}
              alt={request.name}
              style={{
                width: 36,
                height: 36,
                borderRadius: "6px",
                objectFit: "cover",
                flexShrink: 0,
                border: `2px solid ${request.color}`,
              }}
            />
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "6px",
                background: request.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0,
                fontFamily: "var(--font-body)",
              }}
            >
              {request.name[0]}
            </div>
          )}
          <div>
            <p className="sa-card-name">{request.name}</p>
            <p className="sa-card-email">{request.rep_email}</p>
          </div>
        </div>
        <span className={`sa-status ${statusClass}`}>
          {request.status.toUpperCase()}
        </span>
      </div>

      <div className="sa-card-details">
        <Detail label={repNameLabel} value={request.rep_name} />
        {request.rep_role && (
          <Detail label={repRoleLabel} value={request.rep_role} />
        )}
        {request.website_url && (
          <Detail label={websiteLabel} value={request.website_url} />
        )}
        <Detail label={themeLabel} value={request.theme} />
        {request.extra_info && (
          <Detail label={extraInfoLabel} value={request.extra_info} />
        )}
        <Detail
          label={submittedLabel}
          value={new Date(request.created_at).toLocaleDateString()}
        />
        <div className="sa-detail">
          <span className="sa-detail-label">{brandColorLabel}</span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                display: "inline-block",
                width: 16,
                height: 16,
                borderRadius: "4px",
                background: request.color,
                border: "1px solid var(--border-default, #e5e7eb)",
                flexShrink: 0,
              }}
            />
            <span className="sa-detail-value">{request.color}</span>
          </span>
        </div>
      </div>

      {request.doc_url && (
        <a
          href={request.doc_url}
          target="_blank"
          rel="noreferrer"
          className="sa-image-link"
        >
          {viewVerificationDocText}
        </a>
      )}

      {!reviewed && (
        <div className="sa-card-actions">
          <button
            className="sa-btn sa-btn--approve"
            onClick={onApprove}
            disabled={approving}
          >
            {approving ? approvingText : approveText}
          </button>
          <button
            className="sa-btn sa-btn--reject"
            onClick={onReject}
            disabled={rejecting}
          >
            {rejecting ? rejectingText : rejectText}
          </button>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="sa-detail">
      <span className="sa-detail-label">{label}:</span>
      <span className="sa-detail-value">{value}</span>
    </div>
  );
}