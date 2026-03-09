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

function generatePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10))).
  map((b) => chars[b % chars.length]).
  join("");
}

export default function SuperAdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const isSuperAdmin = SUPER_ADMINS.includes(userEmail);

  useEffect(() => {
    if (isLoaded && !isSuperAdmin) router.push("/");
  }, [isLoaded, isSuperAdmin, router]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchRequests();
  }, [isSuperAdmin]);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase.
    from("admin_requests").
    select("*").
    order("submitted_at", { ascending: false });
    if (!error && data) setRequests(data);
    setLoading(false);
  };

  const handleApprove = async (request: AdminRequest) => {
    setApprovingId(request.id);
    try {
      const { data: existing } = await supabase.
      from("admins").
      select("id").
      eq("email", request.email).
      maybeSingle();

      if (existing) {
        alert("This person is already an admin.");
        return;
      }

      const password = generatePassword();

      const { error: insertError } = await supabase.from("admins").insert({
        name: request.name,
        email: request.email,
        password
      });
      if (insertError) throw insertError;

      await supabase.from("admin_requests").delete().eq("id", request.id);

      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_ADMIN_TEMPLATE_ID!,
        { name: request.name, email: request.email, password },
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
      );

      setRequests((prev) => prev.filter((r) => r.id !== request.id));
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
      const { error } = await supabase.
      from("admin_requests").
      update({ status: "rejected" }).
      eq("id", id);
      if (error) throw error;
      setRequests((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: "rejected" } : r)
      );
    } catch (err) {
      console.error("Failed to reject:", err);
      alert("Something went wrong rejecting this request.");
    } finally {
      setRejectingId(null);
    }
  };

  const handleRemoveAdmin = async (email: string, requestId: string) => {
    if (!confirm(`Remove admin access for ${email}? Their password will stop working immediately.`))
    return;
    setRemovingId(requestId);
    try {
      const { error } = await supabase.from("admins").delete().eq("email", email);
      if (error) throw error;
      await supabase.
      from("admin_requests").
      update({ status: "removed" }).
      eq("id", requestId);
      setRequests((prev) =>
      prev.map((r) => r.id === requestId ? { ...r, status: "removed" } : r)
      );
      alert(`✅ Admin access removed for ${email}`);
    } catch (err) {
      console.error(err);
      alert("Something went wrong removing admin.");
    } finally {
      setRemovingId(null);
    }
  };

  if (!isLoaded || !isSuperAdmin) return null;

  const pending = requests.filter((r) => r.status === "pending");
  const reviewed = requests.filter((r) => r.status !== "pending");

  return (
    <div className="sa-page">
      <div className="sa-container">

        <div className="sa-header">
          <h1 className="sa-title">Super Admin</h1>
          <p className="sa-subtitle">Manage admin requests for Findr</p>
        </div>

        <section className="sa-section">
          <h2 className="sa-section-title">
            Pending
            <span className="sa-badge">{pending.length}</span>
          </h2>
          {loading ?
          <p className="sa-empty">Loading...</p> :
          pending.length === 0 ?
          <p className="sa-empty">No pending requests 🎉</p> :

          pending.map((r) =>
          <RequestCard
            key={r.id}
            request={r}
            onApprove={() => handleApprove(r)}
            onReject={() => handleReject(r.id)}
            approving={approvingId === r.id}
            rejecting={rejectingId === r.id} />

          )
          }
        </section>

        {reviewed.length > 0 &&
        <section className="sa-section">
            <h2 className="sa-section-title">Reviewed</h2>
            {reviewed.map((r) =>
          <RequestCard
            key={r.id}
            request={r}
            reviewed
            onRemove={
            r.status === "approved" ?
            () => handleRemoveAdmin(r.email, r.id) :
            undefined
            }
            removing={removingId === r.id} />

          )}
          </section>
        }

      </div>
    </div>);

}

function RequestCard({
  request,
  onApprove,
  onReject,
  approving,
  rejecting,
  reviewed,
  onRemove,
  removing









}: {request: AdminRequest;onApprove?: () => void;onReject?: () => void;approving?: boolean;rejecting?: boolean;reviewed?: boolean;onRemove?: () => void;removing?: boolean;}) {
  const statusClass =
  request.status === "approved" ? "sa-status--approved" :
  request.status === "rejected" ? "sa-status--rejected" :
  request.status === "removed" ? "sa-status--removed" :
  "sa-status--pending";

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
        {request.extra_info &&
        <Detail label="Extra Info" value={request.extra_info} />
        }
        <Detail
          label="Submitted"
          value={new Date(request.submitted_at).toLocaleDateString()} />
        
      </div>

      {request.id_image_url &&
      <a
        href={request.id_image_url}
        target="_blank"
        rel="noreferrer"
        className="sa-image-link">
        
          View ID Photo ↗
        </a>
      }

      {!reviewed &&
      <div className="sa-card-actions">
          <button
          className="sa-btn sa-btn--approve"
          onClick={onApprove}
          disabled={approving}>
          
            {approving ? "Approving..." : "✓ Approve"}
          </button>
          <button
          className="sa-btn sa-btn--reject"
          onClick={onReject}
          disabled={rejecting}>
          
            {rejecting ? "Rejecting..." : "✕ Reject"}
          </button>
        </div>
      }

      {reviewed && onRemove &&
      <div className="sa-card-actions">
          <button
          className="sa-btn sa-btn--remove"
          onClick={onRemove}
          disabled={removing}>
          
            {removing ? "Removing..." : "✕ Remove Admin"}
          </button>
        </div>
      }
    </div>);

}

function Detail({ label, value }: {label: string;value: string;}) {
  return (
    <div className="sa-detail">
      <span className="sa-detail-label">{label}:</span>
      <span className="sa-detail-value">{value}</span>
    </div>);

}
