"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { MdOutlineSchool } from "react-icons/md";
import { getSchoolAdminConversationId } from "./MessagingSystem";

export interface SchoolAdminConvData {
  conversationId: string;
  schoolId: string;
  schoolName: string;
  adminUserId: string;
  adminName: string;
  adminEmail: string;
}

interface SchoolOption {
  id: string;
  name: string;
  code: string;
  rep_user_id: string | null;
  rep_name: string;
  rep_email: string;
}

interface AdminOption {
  userId: string;
  name: string;
  email: string;
  role: "Representative" | "Staff";
}

export function SchoolAdminContactModal({
  schoolId: prefilledSchoolId,
  userId,
  onConversationStart,
  onClose,
}: {
  schoolId?: string;
  userId: string;
  onConversationStart: (data: SchoolAdminConvData) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"pick-school" | "pick-admin">(
    prefilledSchoolId ? "pick-admin" : "pick-school",
  );
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (prefilledSchoolId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_schools")
        .select("schools(id, name, code, rep_user_id, rep_name, rep_email)")
        .eq("user_id", userId);
      const list: SchoolOption[] = [];
      for (const row of data ?? []) {
        const s = (row as any).schools;
        if (s) list.push(s);
      }
      setSchools(list);
      setLoading(false);
    };
    load();
  }, [userId, prefilledSchoolId]);

  useEffect(() => {
    const idToLoad = prefilledSchoolId ?? selectedSchool?.id;
    if (!idToLoad) return;
    const load = async () => {
      setLoading(true);
      const [{ data: schoolData }, { data: staffData }] = await Promise.all([
        supabase
          .from("schools")
          .select("id, name, code, rep_user_id, rep_name, rep_email")
          .eq("id", idToLoad)
          .maybeSingle(),
        supabase
          .from("school_admins")
          .select("user_id, name, user_email")
          .eq("school_id", idToLoad)
          .not("user_id", "is", null),
      ]);

      if (schoolData && !selectedSchool) {
        setSelectedSchool(schoolData as SchoolOption);
      }

      const list: AdminOption[] = [];
      if (schoolData?.rep_user_id) {
        list.push({
          userId: schoolData.rep_user_id,
          name: schoolData.rep_name || "Representative",
          email: schoolData.rep_email || "",
          role: "Representative",
        });
      }
      for (const staff of staffData ?? []) {
        if (!staff.user_id) continue;
        if (staff.user_id === schoolData?.rep_user_id) continue;
        list.push({
          userId: staff.user_id,
          name: staff.name || staff.user_email || "Staff",
          email: staff.user_email || "",
          role: "Staff",
        });
      }
      setAdmins(list);
      setLoading(false);
    };
    load();
  }, [prefilledSchoolId, selectedSchool?.id]);

  const handleSelectSchool = (school: SchoolOption) => {
    setSelectedSchool(school);
    setStep("pick-admin");
  };

  const handleSelectAdmin = (admin: AdminOption) => {
    const school = selectedSchool;
    if (!school) return;
    const convId = getSchoolAdminConversationId(school.id, userId, admin.userId);
    onConversationStart({
      conversationId: convId,
      schoolId: school.id,
      schoolName: school.name,
      adminUserId: admin.userId,
      adminName: admin.name,
      adminEmail: admin.email,
    });
  };

  return (
    <div className="report-modal-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        <p className="report-modal__title">
          <MdOutlineSchool style={{ fontSize: 18 }} />
          Contact School Admin
        </p>

        {step === "pick-school" && (
          <>
            <p className="report-modal__subtitle">Select your school.</p>
            {loading ? (
              <div className="admin-modal-loading">Loading schools…</div>
            ) : schools.length === 0 ? (
              <div className="admin-modal-loading">
                No schools found. Join a school first.
              </div>
            ) : (
              <div style={{ margin: "12px 0" }}>
                {schools.map((school) => (
                  <button
                    key={school.id}
                    className="admin-select-btn"
                    onClick={() => handleSelectSchool(school)}
                  >
                    <div className="admin-select-avatar admin-select-avatar--school">
                      {school.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="admin-select-name">{school.name}</div>
                      <div className="admin-select-email">{school.code}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === "pick-admin" && (
          <>
            <p className="report-modal__subtitle">
              {selectedSchool?.name ?? "School"} — select who to message.
            </p>
            {!prefilledSchoolId && (
              <button
                className="school-modal-back-btn"
                onClick={() => {
                  setStep("pick-school");
                  setAdmins([]);
                  setSelectedSchool(null);
                }}
              >
                ← Back to schools
              </button>
            )}
            {loading ? (
              <div className="admin-modal-loading">Loading admins…</div>
            ) : admins.length === 0 ? (
              <div className="admin-modal-loading">
                No admins available for this school yet.
              </div>
            ) : (
              <div style={{ margin: "12px 0" }}>
                {admins.map((admin) => (
                  <button
                    key={admin.userId}
                    className="admin-select-btn"
                    onClick={() => handleSelectAdmin(admin)}
                  >
                    <div className="admin-select-avatar admin-select-avatar--school">
                      {admin.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="admin-select-name">{admin.name}</div>
                      <div className="admin-select-email">{admin.email}</div>
                    </div>
                    <div className="admin-select-tag admin-select-tag--school">
                      {admin.role}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="report-modal__actions" style={{ marginTop: 4 }}>
          <button className="report-modal__cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
