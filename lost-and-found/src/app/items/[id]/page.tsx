"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { useItems } from "@/context/ItemsContext";
import {
  FaFlag,
  FaMessage,
  FaTrash,
  FaArrowLeft,
  FaCalendar,
  FaMapPin,
  FaTag,
} from "react-icons/fa6";
import ImageGallery from "@/app/components/ImageGallery";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import LocationMap from "@/app/components/LocationMap";
import { getConversationId } from "@/app/components/MessagingSystem";
import "./item-detail.css";

const REPORT_REASONS = [
  "Inappropriate content",
  "Spam or duplicate",
  "Misleading information",
  "Already claimed / resolved",
  "Other",
];

function normalizeImages(imageData: any): string[] {
  if (Array.isArray(imageData))
    return imageData.filter((url) => url && typeof url === "string");
  if (typeof imageData === "string" && imageData) return [imageData];
  return [];
}

interface Message {
  id: number;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  item_id: string;
  item_title: string;
  text: string;
  created_at: string;
}

function sendEmail(route: string, body: Record<string, string>) {
  fetch(`/api/emails/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(console.error);
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { items, lostItems, updateItemStatus, removeLostItem, removeItem } = useItems();

  const [item, setItem] = useState<any>(null);
  const [isLost, setIsLost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("findr_is_admin") === "true"
      : false,
  );

  // Report modal
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Related items
  const [relatedItems, setRelatedItems] = useState<any[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // ── CLAIM FLOW STATE ────────────────────────────────────────────────────────
  const [claimCheckDone, setClaimCheckDone] = useState(false);
  const [userExistingClaim, setUserExistingClaim] = useState<any>(null);
  const [rateLimitCount, setRateLimitCount] = useState(0);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);

  // Claim submission modal
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimProofText, setClaimProofText] = useState("");
  const [claimProofFile, setClaimProofFile] = useState<File | null>(null);
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  // Finder's claims review modal
  const [showClaimsReviewModal, setShowClaimsReviewModal] = useState(false);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [claimActionLoading, setClaimActionLoading] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Dispute modal
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeText, setDisputeText] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  // Finder messaging claimant from claims review modal
  const [messagingClaimId, setMessagingClaimId] = useState<string | null>(null);
  const [claimMsgText, setClaimMsgText] = useState("");
  const [claimMsgSending, setClaimMsgSending] = useState(false);

  // Resolve item from context or fetch from DB
  useEffect(() => {
    if (!isLoaded) return;

    const idNum = parseInt(id, 10);

    const found = items?.find((i) => i.id === idNum);
    if (found) {
      setItem({ ...found });
      setIsLost(false);
      setLoading(false);
      return;
    }

    const lost = lostItems?.find((i) => i.id === idNum);
    if (lost) {
      setItem({ ...lost });
      setIsLost(true);
      setLoading(false);
      return;
    }

    const fetchItem = async () => {
      const { data: foundData } = await supabase
        .from("items")
        .select("*")
        .eq("id", idNum)
        .maybeSingle();

      if (foundData) {
        const imageArray = normalizeImages(
          foundData.image_urls || foundData.image_url,
        );
        setItem({
          id: foundData.id,
          name: foundData.name,
          description: foundData.description,
          image: imageArray[0] || "",
          images: imageArray,
          authorName: foundData.author_name,
          authorAvatar: foundData.author_avatar,
          authorId: foundData.author_id,
          authorEmail: foundData.author_email,
          status: foundData.status,
          aiKeywords: foundData.ai_keywords,
          category: foundData.category ?? null,
          date_found: foundData.date_found,
          location: foundData.location ?? null,
          latitude: foundData.latitude ?? null,
          longitude: foundData.longitude ?? null,
          accepted_claimant_id: foundData.accepted_claimant_id ?? null,
          accepted_claimant_email: foundData.accepted_claimant_email ?? null,
          accepted_claimant_name: foundData.accepted_claimant_name ?? null,
          handoff_confirmed_by_poster: foundData.handoff_confirmed_by_poster ?? false,
          handoff_confirmed_by_claimant: foundData.handoff_confirmed_by_claimant ?? false,
          rejection_count: foundData.rejection_count ?? 0,
        });
        setIsLost(false);
        setLoading(false);
        return;
      }

      const { data: lostData } = await supabase
        .from("lost_items")
        .select("*")
        .eq("id", idNum)
        .maybeSingle();

      if (lostData) {
        const imageArray = normalizeImages(
          lostData.image_urls || lostData.image_url,
        );
        setItem({
          id: lostData.id,
          name: lostData.name,
          description: lostData.description,
          image: imageArray[0] || "",
          images: imageArray,
          authorName: lostData.author_name,
          authorAvatar: lostData.author_avatar,
          authorId: lostData.author_id,
          authorEmail: lostData.author_email,
          status: lostData.status,
          date_found: lostData.created_at,
          location: lostData.location ?? null,
          latitude: lostData.latitude ?? null,
          longitude: lostData.longitude ?? null,
        });
        setIsLost(true);
      }

      setLoading(false);
    };

    fetchItem();
  }, [id, items, lostItems, isLoaded]);

  // Refresh item's claim-related fields from DB (runs once after item.id is set)
  useEffect(() => {
    if (!item?.id || isLost) return;
    supabase
      .from("items")
      .select(
        "status, accepted_claimant_id, accepted_claimant_email, accepted_claimant_name, handoff_confirmed_by_poster, handoff_confirmed_by_claimant, claim_accepted_at, handed_off_at, rejection_count",
      )
      .eq("id", item.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setItem((prev: any) => (prev ? { ...prev, ...data } : prev));
      });
  }, [item?.id, isLost]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch claim state for current user on this item
  useEffect(() => {
    if (!item?.id || !user?.id || !isLoaded || isLost) return;

    (async () => {
      // Existing claim by this user on this item
      const { data: myClaimsOnItem } = await supabase
        .from("claim_requests")
        .select("*")
        .eq("item_id", item.id)
        .eq("claimant_id", user.id);

      if (myClaimsOnItem && myClaimsOnItem.length > 0) {
        setUserExistingClaim(myClaimsOnItem[0]);
      }

      // Rate limit: count pending/accepted + cancelled within 24h
      // Join items to skip claims for returned/deleted items
      const { data: allMyClaims } = await supabase
        .from("claim_requests")
        .select("id, status, created_at, items(status)")
        .eq("claimant_id", user.id)
        .in("status", ["pending", "accepted", "cancelled"]);

      let rateCount = 0;
      const now = Date.now();
      const doneStatuses = ["returned", "claimed"];
      for (const c of allMyClaims || []) {
        const itemStatus = (c.items as any)?.status;
        if (itemStatus && doneStatuses.includes(itemStatus)) continue;
        if (c.status === "pending" || c.status === "accepted") {
          rateCount++;
        } else if (c.status === "cancelled") {
          if (now - new Date(c.created_at).getTime() < 86400000) rateCount++;
        }
      }
      setRateLimitCount(rateCount);

      // Count pending claims for this item (for finder's button)
      if (user.id === item.authorId) {
        const { count } = await supabase
          .from("claim_requests")
          .select("id", { count: "exact", head: true })
          .eq("item_id", item.id)
          .eq("status", "pending");
        setPendingClaimsCount(count ?? 0);
      }

      setClaimCheckDone(true);
    })();
  }, [item?.id, user?.id, isLoaded, isLost]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chat subscription
  useEffect(() => {
    if (!showChat || !item || !user) return;
    const convId = getConversationId(
      { id: String(item.id) + (isLost ? "_lost" : ""), title: item.name },
      { uid: user.id, displayName: user.fullName || "Me" },
      { uid: item.authorId, displayName: item.authorName || "Owner" },
    );

    const fetchMsgs = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    fetchMsgs();

    const channel = supabase
      .channel(`chat:${convId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) =>
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Message).id)
              ? prev
              : [...prev, payload.new as Message],
          ),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showChat, item, user, isLost]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const conversationId =
    item && user
      ? getConversationId(
          { id: String(item.id) + (isLost ? "_lost" : ""), title: item.name },
          { uid: user.id, displayName: user.fullName || "Me" },
          { uid: item.authorId, displayName: item.authorName || "Owner" },
        )
      : "";

  // ── HANDLERS ────────────────────────────────────────────────────────────────

  const handleRetrieve = async () => {
    if (!user || !item) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("items")
      .update({
        status: "pending",
        claimer_email: user.primaryEmailAddress?.emailAddress,
      })
      .eq("id", item.id);

    if (!error) {
      fetch("/api/emails/item-retrieval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_name: item.authorName || "Owner",
          author_email: item.authorEmail,
          item_name: item.name,
          retriever_name: user.fullName || "A user",
          retriever_email: user.primaryEmailAddress?.emailAddress,
        }),
      }).catch(console.error);

      updateItemStatus(
        item.id,
        "pending",
        user.primaryEmailAddress?.emailAddress,
      );
      setItem((prev: any) => ({ ...prev, status: "pending" }));
      setActionMsg("Request sent! The owner has been notified.");
    }
    setActionLoading(false);
  };

  const handleConfirmClaimed = async () => {
    if (!item || !user) return;
    setActionLoading(true);
    const res = await fetch("/api/confirm-return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.id, user_id: user.id }),
    });
    if (res.ok) {
      removeItem(item.id);
      setActionMsg("Item marked as returned!");
      setTimeout(() => router.push("/dashboard"), 1200);
    } else {
      const body = await res.json().catch(() => ({}));
      setActionMsg(`Error: ${body.error ?? res.status}`);
    }
    setActionLoading(false);
  };

  // handleDelete with 4-case logic (Step 5)
  const handleDelete = async () => {
    if (!item || !user) return;

    const currentStatus = item.status || "waiting";

    // Lost item: simple delete
    if (isLost) {
      if (!confirm("Delete this lost item report permanently?")) return;
      setActionLoading(true);
      const { error } = await supabase.from("lost_items").delete().eq("id", item.id);
      if (!error) {
        removeLostItem(item.id);
        router.push("/dashboard");
      }
      setActionLoading(false);
      return;
    }

    // Case D: cannot delete while handoff or dispute is in progress
    if (currentStatus === "handed_off" || currentStatus === "disputed") {
      alert(
        "This item cannot be deleted while a handoff or dispute is in progress. Please wait for the claimant to confirm receipt or for admin to resolve the dispute.",
      );
      return;
    }

    // Fetch all claim requests for this item
    const { data: allClaims } = await supabase
      .from("claim_requests")
      .select("*")
      .eq("item_id", item.id);

    const pendClaimsArr = (allClaims || []).filter((c: any) => c.status === "pending");
    const hasActiveClaimsOnly = (allClaims || []).some(
      (c: any) => c.status === "pending" || c.status === "accepted",
    );

    // Case A: no claims or all resolved
    if (!allClaims || allClaims.length === 0 || !hasActiveClaimsOnly) {
      if (!confirm("Delete this item permanently?")) return;
      setActionLoading(true);
      const { error } = await supabase.from("items").delete().eq("id", item.id);
      if (!error) {
        updateItemStatus(item.id, "claimed");
        router.push("/dashboard");
      }
      setActionLoading(false);
      return;
    }

    // Case B: waiting with pending claims
    if (currentStatus === "waiting" && pendClaimsArr.length > 0) {
      if (
        !confirm(
          `There are ${pendClaimsArr.length} students who submitted claims for this item. Deleting will notify them it's been removed. Continue?`,
        )
      )
        return;
      setActionLoading(true);
      for (const c of pendClaimsArr) {
        sendEmail("claim-rejected", {
          claimant_email: c.claimant_email,
          claimant_name: c.claimant_name,
          item_name: item.name,
          rejection_reason: "The item was removed by the finder.",
        });
      }
      const { error } = await supabase.from("items").delete().eq("id", item.id);
      if (!error) {
        updateItemStatus(item.id, "claimed");
        router.push("/dashboard");
      }
      setActionLoading(false);
      return;
    }

    // Case C: claim_accepted
    if (currentStatus === "claim_accepted") {
      const accName = item.accepted_claimant_name || "the claimant";
      if (
        !confirm(
          `You accepted ${accName}'s claim. Deleting now will cancel their accepted claim and notify them. Continue?`,
        )
      )
        return;
      setActionLoading(true);
      sendEmail("claim-rejected", {
        claimant_email: item.accepted_claimant_email,
        claimant_name: item.accepted_claimant_name || "",
        item_name: item.name,
        rejection_reason:
          "The item listing was removed by the finder after your claim was accepted. Please contact your school admin if you believe this is incorrect.",
      });
      const { error } = await supabase.from("items").delete().eq("id", item.id);
      if (!error) {
        updateItemStatus(item.id, "claimed");
        router.push("/dashboard");
      }
      setActionLoading(false);
      return;
    }
  };

  const handleMarkFound = async () => {
    if (!item) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("lost_items")
      .delete()
      .eq("id", item.id);
    if (!error) {
      removeLostItem(item.id);
      setActionMsg("Marked as found!");
      setTimeout(() => router.push("/dashboard"), 1200);
    }
    setActionLoading(false);
  };

  // Step 1: Claimant submits a claim
  const handleSubmitClaim = async () => {
    if (!user || !item || claimSubmitting) return;
    if (claimProofText.trim().length < 20) return;
    setClaimSubmitting(true);

    let proofImageUrl = "";
    if (claimProofFile) {
      const fileName = `claim_proof_${Date.now()}_${claimProofFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(fileName, claimProofFile);
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("item-images")
          .getPublicUrl(fileName);
        proofImageUrl = urlData.publicUrl;
      }
    }

    const finderEmail = item.authorEmail || item.author_email || "";
    const finderName = item.authorName || item.author_name || "Finder";

    const { data: insertedClaim, error } = await supabase.from("claim_requests").insert({
      item_id: item.id,
      claimant_id: user.id,
      claimant_name:
        user.fullName ||
        user.username ||
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
        user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
        "Anonymous",
      claimant_email: user.primaryEmailAddress?.emailAddress,
      description_proof: claimProofText.trim(),
      proof_image_url: proofImageUrl || null,
      status: "pending",
    }).select().single();

    console.log("[claim_requests insert] data:", insertedClaim, "error:", error);

    if (!error) {
      sendEmail("claim-submitted", {
        finder_email: finderEmail,
        finder_name: finderName,
        item_name: item.name,
        claimant_name:
          user.fullName ||
          user.username ||
          [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
          user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
          "Someone",
      });
      setShowClaimModal(false);
      setClaimProofText("");
      setClaimProofFile(null);
      setUserExistingClaim({ status: "pending", description_proof: claimProofText.trim() });
      setActionMsg("Your claim has been submitted. The finder will review it and get back to you.");
    } else {
      console.error("[claim submit failed]", error?.message, error?.code, error?.details, error?.hint);
      setActionMsg("Failed to submit claim: " + (error?.message || "Unknown error"));
    }
    setClaimSubmitting(false);
  };

  // Step 2: Finder loads and views claims
  const handleLoadAndShowClaims = async () => {
    setClaimsLoading(true);
    setShowClaimsReviewModal(true);
    const { data } = await supabase
      .from("claim_requests")
      .select("*")
      .eq("item_id", item.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setPendingClaims(data || []);
    setClaimsLoading(false);
  };

  // Step 2: Finder accepts a claim
  const handleAcceptClaim = async (claim: any) => {
    if (!item || claimActionLoading) return;
    setClaimActionLoading(true);

    await supabase.from("items").update({
      status: "claim_accepted",
      accepted_claimant_id: claim.claimant_id,
      accepted_claimant_email: claim.claimant_email,
      accepted_claimant_name: claim.claimant_name,
      claim_accepted_at: new Date().toISOString(),
    }).eq("id", item.id);

    await supabase.from("claim_requests").update({ status: "accepted" }).eq("id", claim.id);

    // Reject all other pending claims
    const { data: otherPending } = await supabase
      .from("claim_requests")
      .select("*")
      .eq("item_id", item.id)
      .eq("status", "pending")
      .neq("id", claim.id);

    if (otherPending && otherPending.length > 0) {
      await supabase.from("claim_requests")
        .update({
          status: "rejected",
          rejection_reason: "Another claim was accepted for this item.",
          updated_at: new Date().toISOString(),
        })
        .eq("item_id", item.id)
        .eq("status", "pending")
        .neq("id", claim.id);

      for (const rejected of otherPending) {
        sendEmail("claim-rejected", {
          claimant_email: rejected.claimant_email,
          claimant_name: rejected.claimant_name,
          item_name: item.name,
          rejection_reason: "Another claim was accepted for this item.",
        });
      }
    }

    sendEmail("claim-accepted", {
      claimant_email: claim.claimant_email,
      claimant_name: claim.claimant_name,
      item_name: item.name,
    });

    setItem((prev: any) =>
      prev
        ? {
            ...prev,
            status: "claim_accepted",
            accepted_claimant_id: claim.claimant_id,
            accepted_claimant_email: claim.claimant_email,
            accepted_claimant_name: claim.claimant_name,
            claim_accepted_at: new Date().toISOString(),
          }
        : prev,
    );
    updateItemStatus(item.id, "claim_accepted");
    setShowClaimsReviewModal(false);
    setClaimActionLoading(false);
  };

  // Step 2: Finder rejects a claim
  const handleRejectClaim = async (claim: any) => {
    const reason = rejectReasons[claim.id] || "";
    if (!item || claimActionLoading || !reason.trim()) return;
    setClaimActionLoading(true);

    await supabase.from("claim_requests").update({
      status: "rejected",
      rejection_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", claim.id);

    const newCount = (item.rejection_count || 0) + 1;
    await supabase.from("items").update({ rejection_count: newCount }).eq("id", item.id);

    if (newCount >= 5) {
      await supabase.from("reports").insert({
        item_id: item.id,
        item_name: item.name,
        reporter_name: "System",
        reporter_email: "system@findr.com",
        reason: "This item has had 5 or more claims rejected. Possible finder misconduct.",
      });
    }

    sendEmail("claim-rejected", {
      claimant_email: claim.claimant_email,
      claimant_name: claim.claimant_name,
      item_name: item.name,
      rejection_reason: reason.trim(),
    });

    setItem((prev: any) => (prev ? { ...prev, rejection_count: newCount } : prev));
    setPendingClaims((prev) => prev.filter((c) => c.id !== claim.id));
    setPendingClaimsCount((prev) => Math.max(0, prev - 1));
    setRejectingId(null);
    setRejectReasons((prev) => {
      const n = { ...prev };
      delete n[claim.id];
      return n;
    });
    setClaimActionLoading(false);
  };

  // Step 3: Finder confirms handoff
  const handleFinderHandoff = async () => {
    if (!item || actionLoading) return;
    setActionLoading(true);

    await supabase.from("items").update({
      handoff_confirmed_by_poster: true,
      handed_off_at: new Date().toISOString(),
      status: "handed_off",
    }).eq("id", item.id);

    // Re-fetch accepted claimant email from DB in case context doesn't have it
    const { data: freshItem } = await supabase
      .from("items")
      .select("accepted_claimant_email, accepted_claimant_name")
      .eq("id", item.id)
      .maybeSingle();

    const claimantEmail = freshItem?.accepted_claimant_email || item.accepted_claimant_email || "";
    const claimantName = freshItem?.accepted_claimant_name || item.accepted_claimant_name || "";

    if (claimantEmail) {
      sendEmail("handoff-confirmed", {
        claimant_email: claimantEmail,
        claimant_name: claimantName,
        item_name: item.name,
      });
    }

    setItem((prev: any) =>
      prev
        ? {
            ...prev,
            status: "handed_off",
            handoff_confirmed_by_poster: true,
            handed_off_at: new Date().toISOString(),
          }
        : prev,
    );
    updateItemStatus(item.id, "handed_off");
    setActionMsg("You've confirmed the handoff. The claimant has been notified.");
    setActionLoading(false);
  };

  // Step 4: Claimant confirms receipt
  const handleClaimantConfirmReceipt = async () => {
    if (!item || !user || actionLoading) return;
    setActionLoading(true);

    const res = await fetch("/api/confirm-return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.id, user_id: user.id }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionMsg(`Error confirming return: ${body.error ?? res.status}`);
      setActionLoading(false);
      return;
    }

    removeItem(item.id);
    setActionMsg("Thanks for confirming! This listing has been removed.");
    setTimeout(() => router.push("/dashboard"), 1500);
    setActionLoading(false);
  };

  // Step 4: Claimant submits a dispute
  const handleSubmitDispute = async () => {
    if (!item || !user || disputeText.trim().length < 50 || disputeSubmitting) return;
    setDisputeSubmitting(true);

    await supabase.from("disputes").insert({
      item_id: item.id,
      item_name: item.name,
      claimant_id: user.id,
      claimant_email: user.primaryEmailAddress?.emailAddress,
      reason: disputeText.trim(),
    });

    await supabase.from("items").update({ status: "disputed" }).eq("id", item.id);

    sendEmail("dispute-filed", {
      item_name: item.name,
      item_description: item.description || "",
      item_image_url: item.image || "",
      item_id: String(item.id),
      finder_name: item.authorName || "",
      finder_email: item.authorEmail || item.author_email || "",
      claimant_email: user.primaryEmailAddress?.emailAddress || "",
      dispute_reason: disputeText.trim(),
    });

    setItem((prev: any) => (prev ? { ...prev, status: "disputed" } : prev));
    updateItemStatus(item.id, "disputed");
    setShowDisputeModal(false);
    setActionMsg("Your dispute has been filed. An admin will review it.");
    setDisputeSubmitting(false);
  };

  const handleReportSubmit = async () => {
    if (!reportReason || !user || !item) return;
    setReportSubmitting(true);
    await supabase.from("reports").insert({
      item_id: item.id,
      item_name: item.name,
      item_image: item.image || null,
      reporter_id: user.id,
      reporter_name: user.fullName || "Me",
      reporter_email: user.primaryEmailAddress?.emailAddress,
      reason: reportReason,
    });
    setReportDone(true);
    setReportSubmitting(false);
    setTimeout(() => {
      setShowReport(false);
      setReportDone(false);
      setReportReason("");
    }, 1500);
  };

  const handleSendChat = async () => {
    if (!chatText.trim() || chatSending || !user || !item) return;
    setChatSending(true);
    const trimmed = chatText.trim();
    setChatText("");
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        conversation_id: conversationId,
        sender_id: user.id,
        sender_name: user.fullName || "Me",
        receiver_id: item.authorId,
        item_id: String(item.id),
        item_title: item.name,
        text: trimmed,
        created_at: new Date().toISOString(),
      },
    ]);
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_name: user.fullName || "Me",
      receiver_id: item.authorId,
      receiver_name: item.authorName,
      item_id: String(item.id),
      item_title: item.name,
      text: trimmed,
      read: false,
    });
    setChatSending(false);
  };

  // Auto-fetch related items when the item loads
  useEffect(() => {
    if (!item) return;
    const query = item.category || item.name;
    if (!query) return;
    setRelatedLoading(true);
    fetch("/api/circle-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
      .then((r) => r.json())
      .then((data) => {
        setRelatedItems(
          (data.items || [])
            .filter((i: any) => i.id !== parseInt(id, 10))
            .slice(0, 6),
        );
      })
      .catch(() => setRelatedItems([]))
      .finally(() => setRelatedLoading(false));
  }, [item, id]);

  if (!isLoaded || loading) return <LoadingSpinner />;
  if (!item)
    return (
      <div className="detail-not-found">
        <p>Item not found.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="detail-back-btn"
        >
          ← Back to Dashboard
        </button>
      </div>
    );

  const isItemOwner = user?.id === item.authorId;
  const currentStatus = item.status || "waiting";
  const isAcceptedClaimant = !isLost && user?.id === item.accepted_claimant_id;

  const dateLabel = item.date_found
    ? new Date(item.date_found).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const hasLocation =
    item.latitude != null &&
    item.longitude != null &&
    !isNaN(Number(item.latitude)) &&
    !isNaN(Number(item.longitude));

  // Overlay/modal shared style
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    zIndex: 1500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };
  const modalCardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 480,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    maxHeight: "90vh",
    overflowY: "auto",
  };

  return (
    <div className="detail-page">
      {/* Back nav */}
      <div className="detail-breadcrumb">
        <button className="detail-back-btn" onClick={() => router.back()}>
          <FaArrowLeft />
          <span>Back</span>
        </button>
        <span className="detail-breadcrumb__sep">/</span>
        <span className="detail-breadcrumb__label">
          {isLost ? "Lost Items" : "Found Items"}
        </span>
        <span className="detail-breadcrumb__sep">/</span>
        <span className="detail-breadcrumb__current">{item.name}</span>
      </div>

      {/* Main layout */}
      <div className="detail-layout">
        {/* LEFT: Image */}
        <div className="detail-image-col">
          <ImageGallery
            images={item.images || [item.image].filter(Boolean)}
            title={item.name}
          />
          <div
            className={`detail-status-badge detail-status-badge--${currentStatus}`}
          >
            {isLost
              ? "🔍 Still Looking"
              : currentStatus === "waiting"
                ? "✓ Available"
                : currentStatus === "pending"
                  ? "⏳ Claim Pending"
                  : currentStatus === "claim_accepted"
                    ? "✅ Claim Accepted"
                    : currentStatus === "handed_off"
                      ? "🤝 Handoff in Progress"
                      : currentStatus === "disputed"
                        ? "⚠️ Disputed"
                        : "✓ Claimed"}
          </div>
        </div>

        {/* RIGHT: Info + Actions */}
        <div className="detail-info-col">
          {/* Type pill */}
          <div className="detail-type-pill">
            {isLost ? "Lost Item" : "Found Item"}
          </div>

          {/* Title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h1 className="detail-title">{item.name}</h1>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {!isItemOwner && (
                <button
                  className="detail-secondary-btn detail-secondary-btn--danger"
                  onClick={() => setShowReport(true)}
                  style={{ whiteSpace: "nowrap" }}
                >
                  <FaFlag style={{ marginRight: 6 }} />
                  Report
                </button>
              )}
              {isItemOwner && currentStatus !== "handed_off" && currentStatus !== "disputed" && (
                <button
                  className="detail-secondary-btn detail-secondary-btn--danger"
                  onClick={handleDelete}
                >
                  <FaTrash style={{ marginRight: 6 }} />
                  Delete My Post
                </button>
              )}
            </div>
          </div>

          {/* Posted by */}
          <div className="detail-poster">
            {item.authorAvatar && (
              <img
                src={item.authorAvatar}
                alt={item.authorName}
                className="detail-poster__avatar"
              />
            )}
            <div className="detail-poster__info">
              <span className="detail-poster__label">
                {isLost ? "Lost by" : "Found by"}
              </span>
              <span className="detail-poster__name">
                {item.authorName || "Anonymous"}
              </span>
            </div>
          </div>

          <div className="detail-divider" />

          {/* Meta chips */}
          <div className="detail-meta-row">
            {dateLabel && (
              <div className="detail-meta-chip">
                <FaCalendar className="detail-meta-chip__icon" />
                <span>
                  {isLost ? "Reported" : "Found"} {dateLabel}
                </span>
              </div>
            )}
            {item.location && (
              <div className="detail-meta-chip">
                <FaMapPin className="detail-meta-chip__icon" />
                <span>{item.location}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="detail-description-box">
            <p className="detail-description-label">Description</p>
            <p className="detail-description-text">{item.description}</p>
          </div>

          {/* Tags */}
          {(item.category || item.aiKeywords) && (
            <div className="detail-tags-section">
              <p className="detail-tags-label">Tags</p>
              <div className="detail-tags-row">
                {item.category && (
                  <span className="detail-tag-chip">
                    <FaTag style={{ fontSize: "9px" }} />
                    {item.category}
                  </span>
                )}
                {item.aiKeywords &&
                  item.aiKeywords
                    .split(",")
                    .map((kw: string) => kw.trim())
                    .filter(Boolean)
                    .slice(0, 8)
                    .map((kw: string) => (
                      <span key={kw} className="detail-tag-chip">
                        {kw}
                      </span>
                    ))}
              </div>
            </div>
          )}

          {/* Location map */}
          {hasLocation && (
            <div style={{ marginTop: "4px" }}>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "var(--text-muted)",
                  margin: "0 0 8px",
                }}
              >
                {isLost ? "Last seen location" : "Found location"}
              </p>
              <LocationMap
                lat={Number(item.latitude)}
                lng={Number(item.longitude)}
                address={item.location ?? undefined}
              />
            </div>
          )}

          {/* Action success message */}
          {actionMsg && (
            <div className="detail-action-msg">
              <span>✓</span> {actionMsg}
            </div>
          )}

          {/* ── PRIMARY ACTIONS ── */}
          <div className="detail-actions">

            {/* ── CLAIMANT: "This is mine" button (waiting status) ── */}
            {!isLost && !isItemOwner && currentStatus === "waiting" && (
              <>
                {!claimCheckDone ? null : userExistingClaim?.status === "rejected" ? (
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 13,
                      color: "var(--warning)",
                      padding: "10px 14px",
                      background: "rgba(245,158,11,0.1)",
                      borderRadius: 10,
                      border: "1px solid var(--warning)",
                      margin: 0,
                    }}
                  >
                    You have already submitted a claim for this item that was not accepted.
                  </p>
                ) : userExistingClaim?.status === "pending" || userExistingClaim?.status === "accepted" ? (
                  <button className="detail-btn detail-btn--disabled" disabled>
                    ⏳ Claim Submitted — Awaiting Review
                  </button>
                ) : rateLimitCount >= 2 ? (
                  <button
                    className="detail-btn detail-btn--disabled"
                    disabled
                    title="You already have 2 active claims. Resolve one before claiming another."
                  >
                    This is mine - Submit a Claim
                  </button>
                ) : (
                  <button
                    className="detail-btn detail-btn--primary"
                    onClick={() => setShowClaimModal(true)}
                  >
                    This is mine - Submit a Claim
                  </button>
                )}
              </>
            )}

            {/* ── CLAIMANT: claim accepted, waiting for finder handoff ── */}
            {!isLost && !isItemOwner && currentStatus === "claim_accepted" && isAcceptedClaimant && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--success)",
                  background: "rgba(16,185,129,0.08)",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  color: "var(--success)",
                }}
              >
                Your claim has been accepted! Coordinate with the finder for pickup.
              </div>
            )}

            {/* ── CLAIMANT: handed off — confirm receipt or dispute ── */}
            {!isLost && !isItemOwner && currentStatus === "handed_off" && isAcceptedClaimant && !item.handoff_confirmed_by_claimant && (
              <>
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--accent)",
                    background: "rgba(47,128,237,0.08)",
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "var(--text-primary)",
                  }}
                >
                  The finder says they handed this back to you. Please confirm below.
                </div>
                <button
                  className="detail-btn detail-btn--success"
                  onClick={handleClaimantConfirmReceipt}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Confirming..." : "Confirm I Received It"}
                </button>
                <button
                  className="detail-btn"
                  style={{ background: "var(--danger)", color: "#fff" }}
                  onClick={() => setShowDisputeModal(true)}
                  disabled={actionLoading}
                >
                  Dispute
                </button>
              </>
            )}

            {/* ── FINDER: view claims button ── */}
            {!isLost && isItemOwner && currentStatus === "waiting" && claimCheckDone && (
              <button
                className={
                  pendingClaimsCount > 0
                    ? "detail-btn detail-btn--secondary"
                    : "detail-btn detail-btn--disabled"
                }
                onClick={pendingClaimsCount > 0 ? handleLoadAndShowClaims : undefined}
                disabled={pendingClaimsCount === 0}
              >
                {pendingClaimsCount === 0
                  ? "No claims yet"
                  : `View Claims (${pendingClaimsCount})`}
              </button>
            )}

            {/* ── FINDER: claim accepted — confirm handoff ── */}
            {!isLost && isItemOwner && currentStatus === "claim_accepted" && (
              <>
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--success)",
                    background: "rgba(16,185,129,0.08)",
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "var(--success)",
                  }}
                >
                  You accepted <strong>{item.accepted_claimant_name}</strong>'s claim. Once you've physically handed the item back, click below.
                </div>
                <button
                  className="detail-btn detail-btn--success"
                  onClick={handleFinderHandoff}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Confirming..." : "Confirm I Handed It Back"}
                </button>
                <button
                  className="detail-btn detail-btn--secondary"
                  onClick={() => setShowChat(true)}
                >
                  Message {item.accepted_claimant_name}
                </button>
              </>
            )}

            {/* ── LEGACY: pending status (old flow) ── */}
            {!isLost && !isItemOwner && currentStatus === "pending" && (
              <button className="detail-btn detail-btn--disabled" disabled>
                ⏳ Claim Pending Confirmation
              </button>
            )}
            {!isLost && isItemOwner && currentStatus === "pending" && (
              <button
                className="detail-btn detail-btn--success"
                onClick={handleConfirmClaimed}
                disabled={actionLoading}
              >
                {actionLoading ? "Confirming..." : "✓ Confirm Item is Claimed"}
              </button>
            )}

            {/* ── LOST ITEM ACTIONS ── */}
            {isLost && !isItemOwner && (
              <button
                className="detail-btn detail-btn--primary"
                onClick={() => setShowChat(true)}
                disabled={actionLoading}
              >
                I Found This! — Message Owner
              </button>
            )}
            {isLost && isItemOwner && (
              <button
                className="detail-btn detail-btn--success"
                onClick={handleMarkFound}
                disabled={actionLoading}
              >
                {actionLoading ? "Updating..." : "✓ Mark as Found"}
              </button>
            )}

            {/* ── Message finder (found, non-owner) ── */}
            {!isLost && !isItemOwner && (
              <button
                className="detail-btn detail-btn--secondary"
                onClick={() => setShowChat(true)}
              >
                <FaMessage style={{ marginRight: 8 }} />
                Message Finder
              </button>
            )}
          </div>

          {/* SECONDARY ACTIONS */}
          <div className="detail-secondary-actions">
            {isAdmin && (
              <button
                className="detail-secondary-btn detail-secondary-btn--danger"
                onClick={handleDelete}
              >
                <FaTrash style={{ marginRight: 6 }} />
                Delete (Admin)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Related items */}
      {(relatedLoading || relatedItems.length > 0) && (
        <div className="related-section">
          <div className="related-section__header">
            <p className="related-section__title">Similar items</p>
          </div>
          <div className="related-grid">
            {relatedLoading ? (
              <p className="related-loading">Finding similar items...</p>
            ) : (
              relatedItems.map((ri: any) => (
                <a
                  key={ri.id}
                  href={`/items/${ri.id}`}
                  className="related-card"
                >
                  {ri.image ? (
                    <img
                      src={ri.image}
                      alt={ri.name}
                      className="related-card__img"
                    />
                  ) : (
                    <div className="related-card__img-placeholder">📦</div>
                  )}
                  <div className="related-card__body">
                    <p className="related-card__name">{ri.name}</p>
                    {ri.category && (
                      <p className="related-card__cat">{ri.category}</p>
                    )}
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── REPORT MODAL ── */}
      {showReport && (
        <div className="detail-overlay" onClick={() => setShowReport(false)}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            {reportDone ? (
              <div className="panel-success">
                <span className="panel-success__icon">✓</span>
                <p>Report submitted</p>
              </div>
            ) : (
              <>
                <p className="detail-modal__title">Report "{item.name}"</p>
                <p className="detail-modal__subtitle">
                  Why are you reporting this item?
                </p>
                <div className="detail-modal__reasons">
                  {REPORT_REASONS.map((r) => (
                    <button
                      key={r}
                      className={`detail-modal__reason${reportReason === r ? " detail-modal__reason--selected" : ""}`}
                      onClick={() => setReportReason(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="detail-modal__actions">
                  <button
                    className="detail-modal__cancel"
                    onClick={() => setShowReport(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="detail-modal__submit"
                    onClick={handleReportSubmit}
                    disabled={!reportReason || reportSubmitting}
                  >
                    {reportSubmitting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CHAT PANEL ── */}
      {showChat && user && (
        <div className="detail-overlay" onClick={() => setShowChat(false)}>
          <div className="detail-chat" onClick={(e) => e.stopPropagation()}>
            <div className="detail-chat__header">
              <div className="chat-modal__avatar">
                {item.authorName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="chat-modal__header-info">
                <div className="chat-modal__name">{item.authorName}</div>
                <div className="chat-modal__item">{item.name}</div>
              </div>
              <button
                className="chat-modal__close"
                onClick={() => setShowChat(false)}
              >
                ×
              </button>
            </div>
            <div className="chat-modal__messages">
              {item && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: "var(--bg-input)",
                    borderRadius: 10,
                    margin: "8px 12px",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "var(--text-primary)",
                      margin: 0,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.name}
                  </p>
                  <a
                    href={`/items/${item.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: "var(--accent)",
                      color: "#fff",
                      fontSize: 11,
                      padding: "3px 10px",
                      borderRadius: 100,
                      textDecoration: "none",
                      fontWeight: 600,
                      fontFamily: "var(--font-body)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    View Item
                  </a>
                </div>
              )}
              {messages.length === 0 && (
                <div className="chat-modal__empty">
                  <p>
                    Say hi about <strong>{item.name}</strong>
                  </p>
                </div>
              )}
              {messages.map((msg) => {
                const isOwn = msg.sender_id === user.id;
                return (
                  <div
                    key={msg.id}
                    className={`chat-bubble-wrapper${isOwn ? " chat-bubble-wrapper--own" : ""}`}
                  >
                    <div
                      className={`chat-bubble${isOwn ? " chat-bubble--own" : " chat-bubble--other"}`}
                    >
                      {msg.text}
                    </div>
                    <span className="chat-bubble__time">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            {messages.length === 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  padding: "8px 12px",
                  borderTop: "1px solid var(--border-default)",
                }}
              >
                {[
                  isLost
                    ? "Hi! I think I found your item. Is it still missing?"
                    : "Hi! I think this might be mine. Can we arrange a pickup?",
                  "Can you describe it in more detail?",
                  "Where can we meet to return it?",
                  "Is this still available?",
                ].map((template) => (
                  <button
                    key={template}
                    onClick={() => setChatText(template)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "100px",
                      border: "1.5px solid var(--border-input)",
                      background: "var(--bg-input)",
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-body)",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.borderColor =
                        "var(--accent)";
                      (e.target as HTMLButtonElement).style.color =
                        "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.borderColor =
                        "var(--border-input)";
                      (e.target as HTMLButtonElement).style.color =
                        "var(--text-secondary)";
                    }}
                  >
                    {template}
                  </button>
                ))}
              </div>
            )}
            <div className="chat-modal__input-row">
              <textarea
                rows={1}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="Type a message..."
                className="chat-modal__textarea"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatText.trim() || chatSending}
                className={`chat-modal__send${chatText.trim() ? " chat-modal__send--active" : ""}`}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CLAIM SUBMISSION MODAL (Step 1) ── */}
      {showClaimModal && (
        <div style={overlayStyle} onClick={() => setShowClaimModal(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Submit a Claim
            </p>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              Describe something specific about this item that is NOT visible in the photo. Be as detailed as possible — the finder will use this to verify ownership.
            </p>
            <textarea
              className="panel-form__textarea"
              placeholder='e.g. There&apos;s a small scratch on the bottom-left corner, the brand sticker is peeling, my name is written inside in black marker'
              value={claimProofText}
              onChange={(e) => setClaimProofText(e.target.value)}
              minLength={20}
              required
              style={{ minHeight: 100 }}
            />
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 11,
                color:
                  claimProofText.trim().length >= 20
                    ? "var(--success)"
                    : "var(--text-muted)",
                margin: "4px 0 0",
                textAlign: "right",
              }}
            >
              {claimProofText.trim().length}/20 minimum characters
            </p>
            <div>
              <label
                className="panel-form__label"
                style={{ display: "block", marginBottom: 6 }}
              >
                Upload proof (optional)
              </label>
              <label
                className="panel-form__file-label"
                htmlFor="claim-proof-upload"
              >
                <span className="panel-form__file-icon">+</span>
                <span className="panel-form__file-text">
                  {claimProofFile ? claimProofFile.name : "Choose image"}
                </span>
              </label>
              <input
                id="claim-proof-upload"
                className="panel-form__file"
                type="file"
                accept="image/*"
                onChange={(e) =>
                  e.target.files?.[0] && setClaimProofFile(e.target.files[0])
                }
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="panel-form__cancel"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowClaimModal(false);
                  setClaimProofText("");
                  setClaimProofFile(null);
                }}
              >
                Cancel
              </button>
              <button
                className="panel-form__submit"
                style={{ flex: 2 }}
                onClick={handleSubmitClaim}
                disabled={claimSubmitting || claimProofText.trim().length < 20}
              >
                {claimSubmitting ? "Submitting..." : "Submit Claim"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FINDER CLAIMS REVIEW MODAL (Step 2) ── */}
      {showClaimsReviewModal && (
        <div
          style={overlayStyle}
          onClick={() => setShowClaimsReviewModal(false)}
        >
          <div
            style={{ ...modalCardStyle, maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Claims for "{item.name}"
            </p>
            {claimsLoading ? (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                Loading claims...
              </p>
            ) : pendingClaims.length === 0 ? (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                No pending claims.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {pendingClaims.map((claim) => (
                  <div
                    key={claim.id}
                    style={{
                      border: "1px solid var(--border-default)",
                      borderRadius: 12,
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontFamily: "var(--font-body)",
                            fontWeight: 700,
                            fontSize: 14,
                            color: "var(--text-primary)",
                            margin: 0,
                          }}
                        >
                          {claim.claimant_name}
                        </p>
                        <p
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: 11,
                            color: "var(--text-muted)",
                            margin: "2px 0 0",
                          }}
                        >
                          {new Date(claim.created_at).toLocaleDateString(
                            undefined,
                            { year: "numeric", month: "short", day: "numeric" },
                          )}
                        </p>
                      </div>
                    </div>
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 13,
                        color: "var(--text-primary)",
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {claim.description_proof}
                    </p>
                    {claim.proof_image_url && (
                      <img
                        src={claim.proof_image_url}
                        alt="proof"
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: "cover",
                          borderRadius: 8,
                          cursor: "pointer",
                          border: "1px solid var(--border-default)",
                        }}
                        onClick={() => setEnlargedImage(claim.proof_image_url)}
                      />
                    )}
                    {rejectingId === claim.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <textarea
                          className="panel-form__textarea"
                          placeholder="Enter rejection reason (required)"
                          value={rejectReasons[claim.id] || ""}
                          onChange={(e) =>
                            setRejectReasons((prev) => ({
                              ...prev,
                              [claim.id]: e.target.value,
                            }))
                          }
                          style={{ minHeight: 70 }}
                          required
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            style={{
                              flex: 1,
                              padding: "9px 0",
                              borderRadius: 8,
                              border: "1.5px solid var(--border-input)",
                              background: "transparent",
                              color: "var(--text-muted)",
                              fontFamily: "var(--font-body)",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReasons((prev) => {
                                const n = { ...prev };
                                delete n[claim.id];
                                return n;
                              });
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            style={{
                              flex: 2,
                              padding: "9px 0",
                              borderRadius: 8,
                              border: "none",
                              background: "var(--danger)",
                              color: "#fff",
                              fontFamily: "var(--font-body)",
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                            onClick={() => handleRejectClaim(claim)}
                            disabled={
                              claimActionLoading ||
                              !(rejectReasons[claim.id] || "").trim()
                            }
                          >
                            {claimActionLoading ? "Rejecting..." : "Confirm Reject"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          style={{
                            flex: 1,
                            padding: "9px 0",
                            borderRadius: 8,
                            border: "none",
                            background: "var(--success)",
                            color: "#fff",
                            fontFamily: "var(--font-body)",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: claimActionLoading ? "not-allowed" : "pointer",
                            opacity: claimActionLoading ? 0.6 : 1,
                          }}
                          onClick={() => handleAcceptClaim(claim)}
                          disabled={claimActionLoading}
                        >
                          {claimActionLoading ? "..." : "Accept"}
                        </button>
                        <button
                          style={{
                            flex: 1,
                            padding: "9px 0",
                            borderRadius: 8,
                            border: "none",
                            background: "var(--danger)",
                            color: "#fff",
                            fontFamily: "var(--font-body)",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: claimActionLoading ? "not-allowed" : "pointer",
                            opacity: claimActionLoading ? 0.6 : 1,
                          }}
                          onClick={() => setRejectingId(claim.id)}
                          disabled={claimActionLoading}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    <button
                      style={{
                        width: "100%",
                        padding: "8px 0",
                        borderRadius: 8,
                        border: "1.5px solid var(--border-input)",
                        background: "transparent",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        marginTop: 4,
                      }}
                      onClick={() =>
                        setMessagingClaimId(
                          messagingClaimId === claim.id ? null : claim.id,
                        )
                      }
                    >
                      {messagingClaimId === claim.id
                        ? "Cancel"
                        : "Message Claimant"}
                    </button>
                    {messagingClaimId === claim.id && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <textarea
                          className="panel-form__textarea"
                          placeholder={`Ask ${claim.claimant_name} for more details about their claim...`}
                          value={claimMsgText}
                          onChange={(e) => setClaimMsgText(e.target.value)}
                          style={{ minHeight: 70 }}
                        />
                        <button
                          className="panel-form__submit"
                          disabled={claimMsgSending || !claimMsgText.trim()}
                          onClick={async () => {
                            if (!user) return;
                            setClaimMsgSending(true);
                            const convId = `conv_${[user.id, claim.claimant_id].sort().join("_")}`;
                            await supabase.from("chat_messages").insert({
                              conversation_id: convId,
                              sender_id: user.id,
                              sender_name: user.fullName || "",
                              sender_email: user.primaryEmailAddress?.emailAddress || "",
                              receiver_id: claim.claimant_id,
                              receiver_name: claim.claimant_name,
                              receiver_email: claim.claimant_email,
                              item_id: item.id,
                              item_title: item.name,
                              text: claimMsgText.trim(),
                              read: false,
                            });
                            setClaimMsgSending(false);
                            setClaimMsgText("");
                            setMessagingClaimId(null);
                          }}
                        >
                          {claimMsgSending ? "Sending..." : "Send Message"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              className="panel-form__cancel"
              onClick={() => setShowClaimsReviewModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── PROOF IMAGE ENLARGE ── */}
      {enlargedImage && (
        <div
          style={{ ...overlayStyle, zIndex: 1600 }}
          onClick={() => setEnlargedImage(null)}
        >
          <img
            src={enlargedImage}
            alt="proof enlarged"
            style={{
              maxWidth: "90vw",
              maxHeight: "85vh",
              objectFit: "contain",
              borderRadius: 12,
            }}
          />
        </div>
      )}

      {/* ── DISPUTE MODAL (Step 4) ── */}
      {showDisputeModal && (
        <div style={overlayStyle} onClick={() => setShowDisputeModal(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Open a Dispute
            </p>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              Describe what went wrong. An admin will review your dispute.
            </p>
            <textarea
              placeholder="Describe what went wrong (minimum 50 characters)"
              value={disputeText}
              onChange={(e) => setDisputeText(e.target.value)}
              style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: `1.5px solid ${disputeText.length > 0 && disputeText.trim().length < 50 ? "var(--danger)" : "var(--border-input)"}`, background: "var(--bg-input)", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: 13, resize: "vertical", minHeight: 100, boxSizing: "border-box", outline: "none" }}
            />
            <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: disputeText.trim().length >= 50 ? "var(--success)" : "var(--text-muted)", margin: "-8px 0 0", textAlign: "right" }}>
              {disputeText.trim().length}/50 min chars
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "1.5px solid var(--border-input)", background: "transparent", color: "var(--text-muted)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                onClick={() => {
                  setShowDisputeModal(false);
                  setDisputeText("");
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  flex: 2,
                  padding: "11px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--danger)",
                  color: "#fff",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor:
                    disputeSubmitting || disputeText.trim().length < 50
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    disputeSubmitting || disputeText.trim().length < 50
                      ? 0.6
                      : 1,
                }}
                onClick={handleSubmitDispute}
                disabled={disputeSubmitting || disputeText.trim().length < 50}
              >
                {disputeSubmitting ? "Submitting..." : "Submit Dispute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
