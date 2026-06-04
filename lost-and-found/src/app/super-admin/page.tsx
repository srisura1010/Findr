"use client";

import "./superadmin.css";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import emailjs from "@emailjs/browser";
import { SUPER_ADMINS } from "@/lib/superAdmin";

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

interface SchoolRequest {
  id: string;
  name: string;
  website_url: string | null;
  logo_url: string | null;
  doc_url: string | null;
  color: string;
  theme: string;
  rep_name: string;
  rep_email: string;
  rep_user_id: string;
  rep_role: string | null;
  extra_info: string | null;
  status: string;
  created_at: string;
}

function generatePassword(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)))
    .map((b) => chars[b % chars.length])
    .join("");
}

function generateSchoolCode(name: string): string {
  // e.g. "Lincoln High School" → "LINCOLN-2025"
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

export default function SuperAdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [adminRequests, setAdminRequests] = useState<AdminRequest[]>([]);
  const [schoolRequests, setSchoolRequests] = useState<SchoolRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [schoolApprovingId, setSchoolApprovingId] = useState<string | null>(null);
  const [schoolRejectingId, setSchoolRejectingId] = useState<string | null>(null);

  // which top-level section is active
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

  // ── Admin request handlers (unchanged) ────────────────────────────────────
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
      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_ADMIN_TEMPLATE_ID!,
        { name: request.name, email: request.email, password },
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
      );
      setAdminRequests((prev) => prev.filter((r) => r.id !== request.id));
      alert(`✅ Approved! Password sent to ${request.email}`);
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Check the console.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setRejectingId(id);
    try {
      const { error } = await supabase
        .from("admin_requests")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw error;
      setAdminRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r))
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
      alert(`✅ Admin access removed for ${email}`);
    } catch (err) {
      console.error(err);
      alert("Something went wrong removing admin.");
    } finally {
      setRemovingId(null);
    }
  };

  // ── School request handlers ────────────────────────────────────────────────
  const handleApproveSchool = async (request: SchoolRequest) => {
    setSchoolApprovingId(request.id);
    try {
      // Check not already approved
      const { data: existing } = await supabase
        .from("schools")
        .select("id")
        .eq("rep_email", request.rep_email)
        .maybeSingle();
      if (existing) {
        alert("A school for this rep email already exists.");
        return;
      }

      const code = generateSchoolCode(request.name);
      const password = generatePassword();

      const { error: insertError } = await supabase.from("schools").insert({
        name: request.name,
        code,
        password,
        logo_url: request.logo_url ?? null,
        color: request.color,
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

      // Update request status — fatal if this fails so UI stays consistent
      const { error: updateError } = await supabase
        .from("school_requests")
        .update({ status: "approved" })
        .eq("id", request.id);
      if (updateError) {
        console.error("Supabase update error:", JSON.stringify(updateError));
        alert(`School row created but status update failed: ${updateError.message}

Run this in Supabase SQL editor to fix RLS:
CREATE POLICY "update school_requests" ON school_requests FOR UPDATE USING (true);`);
        // Still update local state since school was created successfully
      }

      // Email the rep — only if the template env var is configured
      const schoolTemplateId = process.env.NEXT_PUBLIC_EMAILJS_SCHOOL_TEMPLATE_ID;
      if (schoolTemplateId) {
        try {
          await emailjs.send(
            process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
            schoolTemplateId,
            {
              name: request.rep_name,
              email: request.rep_email,
              school_name: request.name,
              school_code: code,
              school_password: password,
            },
            process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
          );
        } catch (emailErr) {
          console.error("EmailJS error:", emailErr);
          // School is already created — don't roll back, just warn
          alert(
            `⚠️ School approved (code: ${code}) but email failed. Share the code manually with ${request.rep_email}.`
          );
          setSchoolRequests((prev) =>
            prev.map((r) =>
              r.id === request.id ? { ...r, status: "approved" } : r
            )
          );
          return;
        }
      }

      setSchoolRequests((prev) =>
        prev.map((r) =>
          r.id === request.id ? { ...r, status: "approved" } : r
        )
      );
      const credentialsMsg = `✅ School approved!

School Code (for all members to join): ${code}
Admin Password (for rep to unlock admin panel): ${password}

${schoolTemplateId ? `Sent to ${request.rep_email} via email.` : `⚠️ Email not configured — share both manually with ${request.rep_email}`}`;
      alert(credentialsMsg);
    } catch (err: any) {
      const msg = err?.message ?? JSON.stringify(err);
      console.error("handleApproveSchool error:", msg, err);
      alert(`Something went wrong: ${msg}`);
    } finally {
      setSchoolApprovingId(null);
    }
  };

  const handleRejectSchool = async (id: string) => {
    setSchoolRejectingId(id);
    try {
      const { error } = await supabase
        .from("school_requests")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) {
        console.error("Reject error:", JSON.stringify(error));
        alert(`Update failed: ${error.message}

You may be missing an RLS UPDATE policy on school_requests.
Run in Supabase SQL editor:
CREATE POLICY "update school_requests" ON school_requests FOR UPDATE USING (true);`);
        return;
      }
      setSchoolRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r))
      );
    } catch (err: any) {
      console.error("Failed to reject:", err);
      alert("Something went wrong rejecting this request.");
    } finally {
      setSchoolRejectingId(null);
    }
  };

  if (!isLoaded || !isSuperAdmin) return null;

  const pendingAdmins = adminRequests.filter((r) => r.status === "pending");
  const reviewedAdmins = adminRequests.filter((r) => r.status !== "pending");
  const pendingSchools = schoolRequests.filter((r) => r.status === "pending");
  const reviewedSchools = schoolRequests.filter((r) => r.status !== "pending");

  return (
    <div className="sa-page">
      <div className="sa-container">
        <div className="sa-header">
          <h1 className="sa-title">Super Admin</h1>
          <p className="sa-subtitle">Manage admin requests for Findr</p>
        </div>

        {/* Section switcher — styled same as existing tab pattern */}
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
                fontFamily: "Poppins, sans-serif",
                background:
                  section === s ? "var(--accent, #f97316)" : "transparent",
                color:
                  section === s ? "#fff" : "var(--text-muted, #9ca3af)",
                transition: "all 0.15s ease",
                position: "relative",
                bottom: "-1px",
              }}
            >
              {s === "admins" ? "Admin Requests" : "School Requests"}
              {s === "admins" && pendingAdmins.length > 0 && (
                <span
                  className="sa-badge"
                  style={{ marginLeft: "6px" }}
                >
                  {pendingAdmins.length}
                </span>
              )}
              {s === "schools" && pendingSchools.length > 0 && (
                <span
                  className="sa-badge"
                  style={{ marginLeft: "6px" }}
                >
                  {pendingSchools.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── ADMIN REQUESTS SECTION (original, untouched) ── */}
        {section === "admins" && (
          <>
            <section className="sa-section">
              <h2 className="sa-section-title">
                Pending
                <span className="sa-badge">{pendingAdmins.length}</span>
              </h2>
              {loading ? (
                <p className="sa-empty">Loading...</p>
              ) : pendingAdmins.length === 0 ? (
                <p className="sa-empty">No pending requests 🎉</p>
              ) : (
                pendingAdmins.map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    onApprove={() => handleApprove(r)}
                    onReject={() => handleReject(r.id)}
                    approving={approvingId === r.id}
                    rejecting={rejectingId === r.id}
                  />
                ))
              )}
            </section>

            {reviewedAdmins.length > 0 && (
              <section className="sa-section">
                <h2 className="sa-section-title">Reviewed</h2>
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
                Pending
                <span className="sa-badge">{pendingSchools.length}</span>
              </h2>
              {loading ? (
                <p className="sa-empty">Loading...</p>
              ) : pendingSchools.length === 0 ? (
                <p className="sa-empty">No pending school requests 🎉</p>
              ) : (
                pendingSchools.map((r) => (
                  <SchoolRequestCard
                    key={r.id}
                    request={r}
                    onApprove={() => handleApproveSchool(r)}
                    onReject={() => handleRejectSchool(r.id)}
                    approving={schoolApprovingId === r.id}
                    rejecting={schoolRejectingId === r.id}
                  />
                ))
              )}
            </section>

            {reviewedSchools.length > 0 && (
              <section className="sa-section">
                <h2 className="sa-section-title">Reviewed</h2>
                {reviewedSchools.map((r) => (
                  <SchoolRequestCard key={r.id} request={r} reviewed />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Existing AdminRequestCard (unchanged) ────────────────────────────────────
function RequestCard({
  request,
  onApprove,
  onReject,
  approving,
  rejecting,
  reviewed,
  onRemove,
  removing,
}: {
  request: AdminRequest;
  onApprove?: () => void;
  onReject?: () => void;
  approving?: boolean;
  rejecting?: boolean;
  reviewed?: boolean;
  onRemove?: () => void;
  removing?: boolean;
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
        <Detail label="School" value={request.school} />
        <Detail label="Teacher ID" value={request.teacher_id} />
        {request.extra_info && (
          <Detail label="Extra Info" value={request.extra_info} />
        )}
        <Detail
          label="Submitted"
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
          View ID Photo ↗
        </a>
      )}

      {!reviewed && (
        <div className="sa-card-actions">
          <button
            className="sa-btn sa-btn--approve"
            onClick={onApprove}
            disabled={approving}
          >
            {approving ? "Approving..." : "✓ Approve"}
          </button>
          <button
            className="sa-btn sa-btn--reject"
            onClick={onReject}
            disabled={rejecting}
          >
            {rejecting ? "Rejecting..." : "✕ Reject"}
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
            {removing ? "Removing..." : "✕ Remove Admin"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── New SchoolRequestCard ─────────────────────────────────────────────────────
function SchoolRequestCard({
  request,
  onApprove,
  onReject,
  approving,
  rejecting,
  reviewed,
}: {
  request: SchoolRequest;
  onApprove?: () => void;
  onReject?: () => void;
  approving?: boolean;
  rejecting?: boolean;
  reviewed?: boolean;
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
                fontFamily: "Poppins, sans-serif",
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
        <Detail label="Rep Name" value={request.rep_name} />
        {request.rep_role && (
          <Detail label="Rep Role" value={request.rep_role} />
        )}
        {request.website_url && (
          <Detail label="Website" value={request.website_url} />
        )}
        <Detail label="Theme" value={request.theme} />
        {request.extra_info && (
          <Detail label="Extra Info" value={request.extra_info} />
        )}
        <Detail
          label="Submitted"
          value={new Date(request.created_at).toLocaleDateString()}
        />
        {/* Color swatch inline */}
        <div className="sa-detail">
          <span className="sa-detail-label">Brand Color:</span>
          <span
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
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
          View Verification Doc ↗
        </a>
      )}

      {!reviewed && (
        <div className="sa-card-actions">
          <button
            className="sa-btn sa-btn--approve"
            onClick={onApprove}
            disabled={approving}
          >
            {approving ? "Approving..." : "✓ Approve"}
          </button>
          <button
            className="sa-btn sa-btn--reject"
            onClick={onReject}
            disabled={rejecting}
          >
            {rejecting ? "Rejecting..." : "✕ Reject"}
          </button>
        </div>
      )}
    </div>
  );
}
{/** good */}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="sa-detail">
      <span className="sa-detail-label">{label}:</span>
      <span className="sa-detail-value">{value}</span>
    </div>
  );
}