"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { useSettings } from "@/context/SettingsContext";
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
import "./school-item-detail.css";

//all translatable UI strings for the school item detail page
interface SItemStrings {
  itemNotFound: string; backBtn: string; back: string; schoolItems: string;
  schoolFoundItem: string; foundBy: string; foundDate: string; foundLocation: string;
  description: string; report: string; deleteMyPost: string; deleteAdmin: string;
  statusAvailable: string; statusClaimPending: string; statusClaimAccepted: string;
  statusAwaiting: string; statusDisputed: string;
  viewClaims: string; noClaimsYet: string; confirmHandoff: string; confirming: string;
  waitingClaimant: string; disputedAdmin: string; messagePrefix: string;
  messageFinder: string; submitClaimBtn: string; claimSubmittedBtn: string;
  claimAcceptedMsg: string; claimAcceptedTitle: string; claimAcceptedSub: string;
  iReceived: string; fileDisputeBtn: string; disputeReview: string; anotherClaim: string;
  similarItems: string; noSimilarItems: string; noImage: string;
  submitClaimTitle: string; cancel: string; submitClaim: string; submitting: string;
  claimsFor: string; loading: string; noClaimsModal: string; pending: string;
  accept: string; accepting: string; reject: string; rejecting: string;
  confirmReject: string; close: string; messageClaimant: string;
  fileDisputeTitle: string; submitDispute: string; filing: string;
  reportSubmitted: string; submitReport: string; submittingReport: string; viewItem: string;
  claimInstructions: string; claimPlaceholder: string; minChars: string;
  uploadProof: string; chooseImage: string; rejectPlaceholder: string;
  disputeInstructions: string; disputePlaceholder: string; whyReporting: string;
  reasonInappropriate: string; reasonSpam: string; reasonMisleading: string;
  reasonClaimed: string; reasonOther: string;
  typeMessage: string;
  handoffConfirmedMsg: string;
  receiptConfirmedMsg: string;
  itemReturnedMsg: string;
  disputeFiledMsg: string;
  deleteConfirm: string;
  sayHiAbout: string;
  chatTemplateMine: string;
  chatTemplateDescribe: string;
  chatTemplateMeet: string;
  chatTemplateAvailable: string;
  acceptedClaimPre: string;
  acceptedClaimPost: string;
}
//English default strings shown before translations load
const DEFAULT_SITEM: SItemStrings = {
  itemNotFound: "Item not found.", backBtn: "← Back", back: "Back", schoolItems: "School Items",
  schoolFoundItem: "School Found Item", foundBy: "Found by", foundDate: "Found",
  foundLocation: "Found location", description: "Description", report: "Report",
  deleteMyPost: "Delete My Post", deleteAdmin: "Delete (School Admin)",
  statusAvailable: "Available", statusClaimPending: "Claim Pending",
  statusClaimAccepted: "Claim Accepted", statusAwaiting: "Awaiting Confirmation",
  statusDisputed: "Disputed", viewClaims: "View Claims", noClaimsYet: "No claims yet",
  confirmHandoff: "Confirm I Handed Off Item", confirming: "Confirming...",
  waitingClaimant: "Waiting for claimant to confirm receipt...",
  disputedAdmin: "Disputed - admin is reviewing", messagePrefix: "Message",
  messageFinder: "Message Finder", submitClaimBtn: "This is Mine - Submit a Claim",
  claimSubmittedBtn: "Claim Submitted - Awaiting Review",
  claimAcceptedMsg: "Your claim has been accepted! Coordinate with the finder for pickup.",
  claimAcceptedTitle: "Your claim was accepted!",
  claimAcceptedSub: "Coordinate with the finder to retrieve your item, then confirm receipt below.",
  iReceived: "I Received My Item", fileDisputeBtn: "No - File a Dispute",
  disputeReview: "Dispute under admin review", anotherClaim: "Another claim has been accepted",
  similarItems: "Similar items", noSimilarItems: "No similar items", noImage: "No image",
  submitClaimTitle: "Submit a Claim", cancel: "Cancel", submitClaim: "Submit Claim",
  submitting: "Submitting...", claimsFor: "Claims for", loading: "Loading...",
  noClaimsModal: "No claims yet.", pending: "Pending",
  accept: "Accept", accepting: "Accepting...",
  reject: "Reject", rejecting: "Rejecting...", confirmReject: "Confirm Reject",
  close: "Close", messageClaimant: "Message Claimant", fileDisputeTitle: "File a Dispute",
  submitDispute: "Submit Dispute", filing: "Filing...", reportSubmitted: "Report submitted",
  submitReport: "Submit Report", submittingReport: "Submitting...", viewItem: "View Item",
  claimInstructions: "Describe something specific about this item that is NOT visible in the photo. Be as detailed as possible - the finder will use this to verify ownership.",
  claimPlaceholder: "e.g. It's a navy blue JanSport with a keychain of a red mushroom on the zipper, and my name 'Jamie' written inside the front pocket...",
  minChars: "min chars",
  uploadProof: "Upload proof (optional)", chooseImage: "Choose image",
  rejectPlaceholder: "Enter rejection reason (required)",
  disputeInstructions: "Explain what happened. The school admin will review and contact both parties.",
  disputePlaceholder: "e.g. I arranged to meet the finder but they never showed up. I believe the item hasn't actually been handed off...",
  whyReporting: "Why are you reporting this item?",
  reasonInappropriate: "Inappropriate content",
  reasonSpam: "Spam or duplicate",
  reasonMisleading: "Misleading information",
  reasonClaimed: "Already claimed / resolved",
  reasonOther: "Other",
  typeMessage: "Type a message...",
  handoffConfirmedMsg: "You've confirmed the handoff. The claimant has been notified.",
  receiptConfirmedMsg: "Receipt confirmed! Waiting for the finder to confirm handoff.",
  itemReturnedMsg: "Item successfully returned! Redirecting...",
  disputeFiledMsg: "Dispute filed. The school admin will review and contact you.",
  deleteConfirm: "Delete this item permanently?",
  sayHiAbout: "Say hi about",
  chatTemplateMine: "Hi! I think this might be mine. Can we arrange a pickup?",
  chatTemplateDescribe: "Can you describe it in more detail?",
  chatTemplateMeet: "Where can we meet to return it?",
  chatTemplateAvailable: "Is this still available?",
  acceptedClaimPre: "Accepted",
  acceptedClaimPost: "'s claim. Coordinate the handoff!",
};

async function batchTranslateSItem(
  entries: Array<[keyof SItemStrings, string]>,
  target: string,
  apply: (u: Partial<SItemStrings>) => void,
): Promise<void> {
  const updates: Partial<SItemStrings> = {};
  const uncached: typeof entries = [];
  for (const [field, key] of entries) {
    const hit = localStorage.getItem(`si_${field}_${target}`);
    if (hit) { updates[field] = hit; } else { uncached.push([field, key]); }
  }
  if (Object.keys(updates).length > 0) apply(updates);
  if (uncached.length === 0) return;
  try {
    const res = await fetch("/api/translate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: uncached.map(([, k]) => k), target }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const results: string[] = data.translatedTexts ?? [];
    const newU: Partial<SItemStrings> = {};
    for (let i = 0; i < uncached.length; i++) {
      const [field, key] = uncached[i];
      const t = results[i]?.trim() || key;
      newU[field] = t;
      localStorage.setItem(`si_${field}_${target}`, t);
    }
    apply(newU);
  } catch {}
}

// ── helpers ───────────────────────────────────────────────────────────────────
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

function sendEmail(route: string, body: Record<string, string>) {
  fetch(`/api/emails/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(console.error);
}

// ── types ─────────────────────────────────────────────────────────────────────
interface SchoolClaimRequest {
  id: string;
  school_id: string;
  item_id: number;
  item_name: string;
  finder_id: string;
  claimant_id: string;
  claimant_name: string;
  claimant_email: string;
  description_proof: string;
  proof_image_url: string | null;
  status: string; // pending | accepted | rejected | cancelled
  rejection_reason: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ChatMessage {
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

// ── component ─────────────────────────────────────────────────────────────────
//school-scoped item detail page with claims, chat, and school admin tools
export default function SchoolItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { language, hydrated } = useSettings();

  const [s, setS] = useState<SItemStrings>(DEFAULT_SITEM);
  const [isReady, setIsReady] = useState(false);

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);

  // ── claim state (finder view) ──────────────────────────────────────────────
  const [claims, setClaims] = useState<SchoolClaimRequest[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [showClaimsModal, setShowClaimsModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [claimActionLoading, setClaimActionLoading] = useState(false);

  // ── submit claim (claimant view) ───────────────────────────────────────────
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimProof, setClaimProof] = useState("");
  const [claimProofFile, setClaimProofFile] = useState<File | null>(null);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSubmitted, setClaimSubmitted] = useState(false);
  const [myExistingClaim, setMyExistingClaim] = useState<SchoolClaimRequest | null>(null);

  // ── dispute (claimant view after handoff) ─────────────────────────────────
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  // ── report modal ───────────────────────────────────────────────────────────
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  // ── chat ───────────────────────────────────────────────────────────────────
  const [activeChatPartnerId, setActiveChatPartnerId] = useState<string | null>(null);
  const [activeChatPartnerName, setActiveChatPartnerName] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── misc ───────────────────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [relatedItems, setRelatedItems] = useState<any[]>([]);
  const [relatedLoaded, setRelatedLoaded] = useState(false);
  const [translatedCategory, setTranslatedCategory] = useState<string>("");
  const [translatedName, setTranslatedName] = useState<string>("");
  const [translatedDescription, setTranslatedDescription] = useState<string>("");
  const [translatedLocation, setTranslatedLocation] = useState<string>("");
  const [translatedKeywords, setTranslatedKeywords] = useState<string[]>([]);
  const [relatedNameMap, setRelatedNameMap] = useState<Record<number, string>>({});
  const [relatedCatMap, setRelatedCatMap] = useState<Record<number, string>>({});

  // ── translations ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (language === "en") { setS(DEFAULT_SITEM); setIsReady(true); return; }
    const pairs = (Object.keys(DEFAULT_SITEM) as Array<keyof SItemStrings>).map(
      (k): [keyof SItemStrings, string] => [k, DEFAULT_SITEM[k]]
    );
    batchTranslateSItem(pairs, language, (u) => setS((prev) => ({ ...prev, ...u })))
      .then(() => setIsReady(true));
  }, [language, hydrated]);

  // translate user content (name, description, location, category) when item loads
  useEffect(() => {
    if (!hydrated) return;
    if (!item) return;
    if (language === "en") {
      setTranslatedName(item.name || "");
      setTranslatedDescription(item.description || "");
      setTranslatedLocation(item.location || "");
      setTranslatedCategory(item.category || "");
      return;
    }
    const tx = async (text: string, field: string) => {
      if (!text) return text;
      const cacheKey = `si_c_${item.id}_${field}_${language}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) return cached;
      try {
        const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, target: language }) });
        const data = await res.json();
        const t = (data.translatedText as string | undefined)?.trim() || text;
        localStorage.setItem(cacheKey, t);
        return t;
      } catch { return text; }
    };
    const catKey = item.category ? `sc_cat_${item.category.replace(/\s+/g, "_")}_${language}` : "";
    const cachedCat = catKey ? localStorage.getItem(catKey) : null;
    Promise.all([
      tx(item.name, "name"),
      tx(item.description, "desc"),
      tx(item.location, "loc"),
      cachedCat ? Promise.resolve(cachedCat) : (item.category ? tx(item.category, "cat").then((t) => { if (catKey) localStorage.setItem(catKey, t); return t; }) : Promise.resolve("")),
    ]).then(([name, desc, loc, cat]) => {
      setTranslatedName(name);
      setTranslatedDescription(desc);
      setTranslatedLocation(loc);
      setTranslatedCategory(cat);
    });
  }, [item, language, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // translate ai keywords
  useEffect(() => {
    if (!hydrated) return;
    if (!item?.aiKeywords) { setTranslatedKeywords([]); return; }
    const kws: string[] = item.aiKeywords.split(",").map((k: string) => k.trim()).filter(Boolean);
    if (language === "en") { setTranslatedKeywords(kws); return; }
    const uncached: string[] = [];
    const result: string[] = kws.map((kw) => {
      const hit = localStorage.getItem(`si_kw_${kw.replace(/\s+/g, "_")}_${language}`);
      return hit ?? (uncached.push(kw), kw);
    });
    setTranslatedKeywords(result);
    if (uncached.length === 0) return;
    fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texts: uncached, target: language }) })
      .then((r) => r.json())
      .then((data) => {
        const translated: string[] = data.translatedTexts ?? [];
        setTranslatedKeywords(kws.map((kw) => {
          const ci = uncached.indexOf(kw);
          if (ci >= 0 && translated[ci]) {
            localStorage.setItem(`si_kw_${kw.replace(/\s+/g, "_")}_${language}`, translated[ci]);
            return translated[ci];
          }
          return localStorage.getItem(`si_kw_${kw.replace(/\s+/g, "_")}_${language}`) ?? kw;
        }));
      }).catch(() => {});
  }, [item?.aiKeywords, language, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // translate related item names + categories
  useEffect(() => {
    if (relatedItems.length === 0 || language === "en") {
      setRelatedNameMap({});
      setRelatedCatMap({});
      return;
    }
    const texts: string[] = [];
    const keys: Array<{ type: "name" | "cat"; id: number; fallback: string; cacheKey: string }> = [];
    const nameMap: Record<number, string> = {};
    const catMap: Record<number, string> = {};
    for (const ri of relatedItems) {
      const nameCK = `si_ri_${ri.id}_${language}`;
      const cachedName = localStorage.getItem(nameCK);
      if (cachedName) { nameMap[ri.id] = cachedName; }
      else { texts.push(ri.name); keys.push({ type: "name", id: ri.id, fallback: ri.name, cacheKey: nameCK }); }
      if (ri.category) {
        const catCK = `si_rc_${ri.category.replace(/\s+/g, "_")}_${language}`;
        const cachedCat = localStorage.getItem(catCK);
        if (cachedCat) { catMap[ri.id] = cachedCat; }
        else { texts.push(ri.category); keys.push({ type: "cat", id: ri.id, fallback: ri.category, cacheKey: catCK }); }
      }
    }
    if (Object.keys(nameMap).length > 0) setRelatedNameMap((prev) => ({ ...prev, ...nameMap }));
    if (Object.keys(catMap).length > 0) setRelatedCatMap((prev) => ({ ...prev, ...catMap }));
    if (texts.length === 0) return;
    fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texts, target: language }) })
      .then((r) => r.json())
      .then((data) => {
        const results: string[] = data.translatedTexts ?? [];
        const newNameMap: Record<number, string> = {};
        const newCatMap: Record<number, string> = {};
        keys.forEach(({ type, id, fallback, cacheKey }, i) => {
          const t = results[i]?.trim() || fallback;
          localStorage.setItem(cacheKey, t);
          if (type === "name") newNameMap[id] = t;
          else newCatMap[id] = t;
        });
        setRelatedNameMap((prev) => ({ ...prev, ...newNameMap }));
        setRelatedCatMap((prev) => ({ ...prev, ...newCatMap }));
      }).catch(() => {});
  }, [relatedItems, language]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── fetch item ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    const idNum = parseInt(id, 10);

    supabase
      .from("school_items")
      .select("*")
      .eq("id", idNum)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const imageArray = normalizeImages(data.image_urls || data.image_url);
          setItem({
            id: data.id,
            name: data.name,
            description: data.description,
            image: imageArray[0] || "",
            images: imageArray,
            authorName: data.author_name,
            authorAvatar: data.author_avatar,
            authorId: data.author_id,
            authorEmail: data.author_email,
            status: data.status,
            aiKeywords: data.ai_keywords,
            category: data.category ?? null,
            date_found: data.date_found,
            location: data.location ?? null,
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
            school_id: data.school_id,
            accepted_claimant_id: data.accepted_claimant_id ?? null,
            accepted_claimant_name: data.accepted_claimant_name ?? null,
            accepted_claimant_email: data.accepted_claimant_email ?? null,
            handoff_confirmed_by_poster: data.handoff_confirmed_by_poster ?? false,
            handoff_confirmed_by_claimant: data.handoff_confirmed_by_claimant ?? false,
            rejection_count: data.rejection_count ?? 0,
          });
          if (typeof window !== "undefined") {
            setIsSchoolAdmin(
              localStorage.getItem(`finder_school_admin_${data.school_id}`) === "true"
            );
          }
        }
        setLoading(false);
      });
  }, [id, isLoaded]);

  // ── fetch my existing claim ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !item?.id) return;
    supabase
      .from("school_claim_requests")
      .select("*")
      .eq("item_id", item.id)
      .eq("claimant_id", user.id)
      .in("status", ["pending", "accepted"])
      .maybeSingle()
      .then(({ data }) => {
        if (data) setMyExistingClaim(data as SchoolClaimRequest);
      });
  }, [user?.id, item?.id]);

  // ── fetch claims (finder view) ────────────────────────────────────────────
  const fetchClaims = async () => {
    if (!item?.id) return;
    setClaimsLoading(true);
    const { data } = await supabase
      .from("school_claim_requests")
      .select("*")
      .eq("item_id", item.id)
      .order("created_at", { ascending: false });
    setClaims((data as SchoolClaimRequest[]) ?? []);
    setClaimsLoading(false);
  };

  useEffect(() => {
    if (item?.id && user?.id && item.authorId === user.id) fetchClaims();
  }, [item?.id, user?.id]);

  // ── related items ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!item?.school_id) return;
    const query = item.category || item.name;
    if (!query) return;
    setRelatedLoaded(false);
    fetch("/api/school-similar-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, school_id: item.school_id, exclude_id: item.id }),
    })
      .then((r) => r.json())
      .then((data) => setRelatedItems(data.items || []))
      .catch(() => setRelatedItems([]))
      .finally(() => setRelatedLoaded(true));
  }, [item?.id]);

  // ── chat subscription ─────────────────────────────────────────────────────
  const showChat = !!activeChatPartnerId;

  const conversationId =
    item && user && activeChatPartnerId
      ? `conv_${[user.id, activeChatPartnerId].sort().join("_")}`
      : "";

  useEffect(() => {
    if (!showChat || !conversationId) return;

    supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setMessages(data as ChatMessage[]); });

    const channelName = `chat:${conversationId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) =>
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as ChatMessage).id)
              ? prev
              : [...prev, payload.new as ChatMessage]
          )
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [showChat, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── open chat helpers ─────────────────────────────────────────────────────
  const openChatWith = (partnerId: string, partnerName: string) => {
    setActiveChatPartnerId(partnerId);
    setActiveChatPartnerName(partnerName);
    setMessages([]);
  };

  const closeChat = () => {
    setActiveChatPartnerId(null);
    setActiveChatPartnerName("");
    setMessages([]);
    setChatText("");
  };

  // ── send chat message ─────────────────────────────────────────────────────
  const handleSendChat = async () => {
    if (!chatText.trim() || chatSending || !user || !item || !activeChatPartnerId) return;
    setChatSending(true);
    const trimmed = chatText.trim();
    setChatText("");
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_name: user.fullName || "Me",
      sender_email: user.primaryEmailAddress?.emailAddress || "",
      receiver_id: activeChatPartnerId,
      receiver_name: activeChatPartnerName,
      receiver_email: "",
      item_id: String(item.id),
      item_title: item.name,
      text: trimmed,
      read: false,
    });
    setChatSending(false);
  };

  // ── submit claim ──────────────────────────────────────────────────────────
  const handleSubmitClaim = async () => {
    if (claimProof.trim().length < 20 || !user || !item) return;
    setClaimSubmitting(true);

    let proofImageUrl: string | null = null;
    if (claimProofFile) {
      const fn = `school_claim_${item.id}_${Date.now()}_${claimProofFile.name}`;
      await supabase.storage.from("item-images").upload(fn, claimProofFile);
      const { data: urlData } = supabase.storage.from("item-images").getPublicUrl(fn);
      proofImageUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from("school_claim_requests").insert({
      school_id: item.school_id,
      item_id: item.id,
      item_name: item.name,
      finder_id: item.authorId,
      claimant_id: user.id,
      claimant_name: user.fullName || user.username || "Anonymous",
      claimant_email: user.primaryEmailAddress?.emailAddress || "",
      description_proof: claimProof.trim(),
      proof_image_url: proofImageUrl,
      status: "pending",
    });
    if (error) { console.error("Claim insert error:", error); alert(error.message); setClaimSubmitting(false); return; }

    if (!error) {
      // Update item status to pending
      await supabase.from("school_items").update({ status: "pending" }).eq("id", item.id);
      setItem((prev: any) => ({ ...prev, status: "pending" }));

      // Email the finder
      sendEmail("item-retrieval", {
        author_name: item.authorName || "Finder",
        author_email: item.authorEmail,
        item_name: item.name,
        retriever_name: user.fullName || "A user",
        retriever_email: user.primaryEmailAddress?.emailAddress || "",
      });

      setClaimSubmitted(true);
      setShowClaimModal(false);
      setClaimProof("");
      setClaimProofFile(null);
      setMyExistingClaim({
        id: "temp",
        school_id: item.school_id,
        item_id: item.id,
        item_name: item.name,
        finder_id: item.authorId,
        claimant_id: user.id,
        claimant_name: user.fullName || "",
        claimant_email: user.primaryEmailAddress?.emailAddress || "",
        description_proof: claimProof.trim(),
        proof_image_url: proofImageUrl,
        status: "pending",
        rejection_reason: null,
        created_at: new Date().toISOString(),
        updated_at: null,
      });
    }
    setClaimSubmitting(false);
  };

  // ── accept claim (finder) ─────────────────────────────────────────────────
  const handleAcceptClaim = async (claim: SchoolClaimRequest) => {
    if (!item) return;
    setClaimActionLoading(true);

    // Reject all other pending claims
    const others = claims.filter((c) => c.id !== claim.id && c.status === "pending");
    for (const other of others) {
      await supabase
        .from("school_claim_requests")
        .update({ status: "rejected", rejection_reason: "Another claim was accepted.", updated_at: new Date().toISOString() })
        .eq("id", other.id);
      sendEmail("claim-rejected", {
        claimant_email: other.claimant_email,
        claimant_name: other.claimant_name,
        item_name: item.name,
        rejection_reason: "Another claim was accepted for this item.",
      });
    }

    // Accept this claim
    await supabase
      .from("school_claim_requests")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", claim.id);

    // Update item
    await supabase.from("school_items").update({
      status: "claim_accepted",
      accepted_claimant_id: claim.claimant_id,
      accepted_claimant_name: claim.claimant_name,
      accepted_claimant_email: claim.claimant_email,
      claim_accepted_at: new Date().toISOString(),
    }).eq("id", item.id);

    // Email the claimant
    sendEmail("claim-accepted", {
      claimant_email: claim.claimant_email,
      claimant_name: claim.claimant_name,
      item_name: item.name,
      finder_name: item.authorName || "Finder",
      finder_email: item.authorEmail || "",
    });

    setItem((prev: any) => ({
      ...prev,
      status: "claim_accepted",
      accepted_claimant_id: claim.claimant_id,
      accepted_claimant_name: claim.claimant_name,
      accepted_claimant_email: claim.claimant_email,
    }));
    setClaims((prev) =>
      prev.map((c) =>
        c.id === claim.id
          ? { ...c, status: "accepted" }
          : c.status === "pending"
          ? { ...c, status: "rejected" }
          : c
      )
    );
    setClaimActionLoading(false);
    setShowClaimsModal(false);
    setActionMsg(`${s.acceptedClaimPre} ${claim.claimant_name}${s.acceptedClaimPost}`);
  };

  // ── reject claim (finder) ─────────────────────────────────────────────────
  const handleRejectClaim = async (claim: SchoolClaimRequest) => {
    const reason = rejectReasons[claim.id] || "";
    if (!item || claimActionLoading || !reason.trim()) return;
    setClaimActionLoading(true);
    await supabase
      .from("school_claim_requests")
      .update({ status: "rejected", rejection_reason: reason.trim(), updated_at: new Date().toISOString() })
      .eq("id", claim.id);

    const newRejectionCount = (item.rejection_count || 0) + 1;
    await supabase
      .from("school_items")
      .update({ rejection_count: newRejectionCount })
      .eq("id", item.id);

    sendEmail("claim-rejected", {
      claimant_email: claim.claimant_email,
      claimant_name: claim.claimant_name,
      item_name: item.name,
      rejection_reason: reason.trim(),
    });

    setClaims((prev) => prev.map((c) => c.id === claim.id ? { ...c, status: "rejected" } : c));
    setRejectingId(null);
    setRejectReasons((prev) => { const n = { ...prev }; delete n[claim.id]; return n; });
    setItem((prev: any) => ({ ...prev, rejection_count: newRejectionCount }));
    setClaimActionLoading(false);
  };

  // ── finder confirms handoff ───────────────────────────────────────────────
  const handleFinderConfirmHandoff = async () => {
    if (!item) return;
    setActionLoading(true);
    const claimantAlreadyConfirmed = item.handoff_confirmed_by_claimant;

    if (claimantAlreadyConfirmed) {
      // Both confirmed — complete the handoff
      await completeHandoff();
    } else {
      await supabase.from("school_items").update({
        handoff_confirmed_by_poster: true,
        status: "handed_off",
      }).eq("id", item.id);
      setItem((prev: any) => ({ ...prev, handoff_confirmed_by_poster: true, status: "handed_off" }));
      setActionMsg(s.handoffConfirmedMsg);
    }
    setActionLoading(false);
  };

  // ── claimant confirms receipt ─────────────────────────────────────────────
  const handleClaimantConfirmReceipt = async () => {
    if (!item) return;
    setActionLoading(true);

    // Fetch fresh data to ensure latest handoff flags (claimant page may be stale)
    const { data: freshData } = await supabase
      .from("school_items")
      .select("handoff_confirmed_by_poster, handoff_confirmed_by_claimant")
      .eq("id", item.id)
      .maybeSingle();
    const finderAlreadyConfirmed = freshData?.handoff_confirmed_by_poster ?? item.handoff_confirmed_by_poster;

    if (finderAlreadyConfirmed) {
      await completeHandoff();
    } else {
      await supabase.from("school_items").update({
        handoff_confirmed_by_claimant: true,
        status: "handed_off",
      }).eq("id", item.id);
      setItem((prev: any) => ({ ...prev, handoff_confirmed_by_claimant: true, status: "handed_off" }));
      setActionMsg(s.receiptConfirmedMsg);
    }
    setActionLoading(false);
  };

  // ── complete handoff (both confirmed) ────────────────────────────────────
  const completeHandoff = async () => {
    if (!item) return;
    const { error: insertError } = await supabase.from("school_returned_items").insert({
      school_id: item.school_id,
      original_item_id: item.id,
      author_id: item.authorId,
      author_name: item.authorName,
      item_name: item.name,
      returned_by_id: item.accepted_claimant_id,
      date_found: item.date_found,
      returned_at: new Date().toISOString(),
      snapshot: item,
    });
    if (insertError) {
      console.error("school_returned_items insert failed:", insertError);
      setActionMsg(`Error recording return: ${insertError.message}. Please contact your school admin.`);
      return;
    }
    await supabase.from("school_items").delete().eq("id", item.id);
    setActionMsg(s.itemReturnedMsg);
    setTimeout(() => router.back(), 1800);
  };

  // ── claimant files dispute ────────────────────────────────────────────────
  const handleSubmitDispute = async () => {
    if (disputeReason.trim().length < 50 || !user || !item) return;
    setDisputeSubmitting(true);
    await supabase.from("school_disputes").insert({
      school_id: item.school_id,
      item_id: item.id,
      item_name: item.name,
      claimant_id: user.id,
      claimant_email: user.primaryEmailAddress?.emailAddress || "",
      reason: disputeReason.trim(),
    });
    await supabase.from("school_items").update({ status: "disputed" }).eq("id", item.id);
    setItem((prev: any) => ({ ...prev, status: "disputed" }));
    setShowDisputeModal(false);
    setDisputeReason("");
    setDisputeSubmitting(false);
    setActionMsg(s.disputeFiledMsg);
  };

  // ── report ────────────────────────────────────────────────────────────────
  const handleReportSubmit = async () => {
    if (!reportReason || !user || !item) return;
    setReportSubmitting(true);
    await supabase.from("school_reports").insert({
      school_id: item.school_id,
      item_id: item.id,
      item_name: item.name,
      item_image: item.image || null,
      item_type: "found",
      reporter_id: user.id,
      reporter_name: user.fullName || "Me",
      reporter_email: user.primaryEmailAddress?.emailAddress || "",
      reason: reportReason,
    });
    setReportDone(true);
    setReportSubmitting(false);
    setTimeout(() => { setShowReport(false); setReportDone(false); setReportReason(""); }, 1500);
  };

  // ── delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!item || !confirm(s.deleteConfirm)) return;
    setActionLoading(true);
    // Notify pending claimants
    const { data: pendingClaims } = await supabase
      .from("school_claim_requests")
      .select("*")
      .eq("item_id", item.id)
      .eq("status", "pending");
    for (const c of pendingClaims || []) {
      sendEmail("claim-rejected", {
        claimant_email: c.claimant_email,
        claimant_name: c.claimant_name,
        item_name: item.name,
        rejection_reason: "The item was removed by the finder.",
      });
    }
    await supabase.from("school_items").delete().eq("id", item.id);
    router.back();
    setActionLoading(false);
  };

  // ── guards ────────────────────────────────────────────────────────────────
  if (!isLoaded || loading || !isReady) return <LoadingSpinner />;
  if (!item) return (
    <div className="detail-not-found">
      <p>{s.itemNotFound}</p>
      <button onClick={() => router.back()} className="detail-back-btn">{s.backBtn}</button>
    </div>
  );

  const isItemOwner = user?.id === item.authorId;
  const canDelete = isItemOwner || isSchoolAdmin;
  const currentStatus = item.status || "waiting";
  const isMyAcceptedClaim = item.accepted_claimant_id === user?.id;
  const pendingClaims = claims.filter((c) => c.status === "pending");
  const acceptedClaim = claims.find((c) => c.status === "accepted");

  const dateLabel = item.date_found
    ? new Date(item.date_found).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  const hasLocation =
    item.latitude != null && item.longitude != null &&
    !isNaN(Number(item.latitude)) && !isNaN(Number(item.longitude));

  // ── status badge text ─────────────────────────────────────────────────────
  const statusBadgeText = () => {
    switch (currentStatus) {
      case "waiting": return s.statusAvailable;
      case "pending": return s.statusClaimPending;
      case "claim_accepted": return s.statusClaimAccepted;
      case "handed_off": return s.statusAwaiting;
      case "disputed": return s.statusDisputed;
      default: return s.statusAvailable;
    }
  };

  return (
    <div className="detail-page">
      {/* Breadcrumb */}
      <div className="detail-breadcrumb" style={{ marginLeft: 0, alignSelf: "flex-start" }}>
        <button className="detail-back-btn" onClick={() => router.back()}>
          <FaArrowLeft /><span>{s.back}</span>
        </button>
        <span className="detail-breadcrumb__sep">/</span>
        <span className="detail-breadcrumb__label">{s.schoolItems}</span>
        <span className="detail-breadcrumb__sep">/</span>
        <span className="detail-breadcrumb__current">{translatedName || item.name}</span>
      </div>

      {/* Main layout */}
      <div className="detail-layout">
        {/* LEFT: Image */}
        <div className="detail-image-col">
          <ImageGallery images={item.images || [item.image].filter(Boolean)} title={item.name} />
          <div className={`detail-status-badge detail-status-badge--${currentStatus}`}>
            {statusBadgeText()}
          </div>
        </div>

        {/* RIGHT: Info + Actions */}
        <div className="detail-info-col">
          <div className="detail-type-pill">{s.schoolFoundItem}</div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h1 className="detail-title">{translatedName || item.name}</h1>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {!isItemOwner && (
                <button className="detail-secondary-btn detail-secondary-btn--danger" onClick={() => setShowReport(true)}>
                  <FaFlag style={{ marginRight: 6 }} />{s.report}
                </button>
              )}
              {canDelete && (
                <button className="detail-secondary-btn detail-secondary-btn--danger" onClick={handleDelete} disabled={actionLoading}>
                  <FaTrash style={{ marginRight: 6 }} />
                  {isSchoolAdmin && !isItemOwner ? s.deleteAdmin : s.deleteMyPost}
                </button>
              )}
            </div>
          </div>

          {/* Posted by */}
          <div className="detail-poster">
            {item.authorAvatar && (
              <img src={item.authorAvatar} alt={item.authorName} className="detail-poster__avatar" />
            )}
            <div className="detail-poster__info">
              <span className="detail-poster__label">{s.foundBy}</span>
              <span className="detail-poster__name">{item.authorName || "Anonymous"}</span>
            </div>
          </div>

          <div className="detail-divider" />

          {/* Meta chips */}
          <div className="detail-meta-row">
            {dateLabel && (
              <div className="detail-meta-chip">
                <FaCalendar className="detail-meta-chip__icon" />
                <span>{s.foundDate} {dateLabel}</span>
              </div>
            )}
            {item.location && (
              <div className="detail-meta-chip">
                <FaMapPin className="detail-meta-chip__icon" />
                <span>{translatedLocation || item.location}</span>
              </div>
            )}
            {item.category && (
              <div className="detail-meta-chip">
                <FaTag className="detail-meta-chip__icon" />
                <span>{translatedCategory || item.category}</span>
              </div>
            )}
          </div>

          {/* AI keyword chips */}
          {item.aiKeywords && (
            <div className="detail-tags-row">
              {(translatedKeywords.length > 0 ? translatedKeywords : item.aiKeywords.split(",").map((k: string) => k.trim()).filter(Boolean)).slice(0, 8).map((kw: string) => (
                <span key={kw} className="detail-tag-chip">{kw}</span>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="detail-description-box">
            <p className="detail-description-label">{s.description}</p>
            <p className="detail-description-text">{translatedDescription || item.description}</p>
          </div>

          {/* Location map */}
          {hasLocation && (
            <div style={{ marginTop: "4px" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", margin: "0 0 8px" }}>
                {s.foundLocation}
              </p>
              <LocationMap lat={Number(item.latitude)} lng={Number(item.longitude)} address={item.location ?? undefined} />
            </div>
          )}

          {/* Action message */}
          {actionMsg && (
            <div className="detail-action-msg">{actionMsg}</div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              PRIMARY ACTIONS — depends on role + status
          ════════════════════════════════════════════════════════════════ */}
          <div className="detail-actions">

            {/* ── FINDER ACTIONS ── */}
            {isItemOwner && (
              <>
                {/* View claims button */}
                {(currentStatus === "waiting" || currentStatus === "pending") && (
                  pendingClaims.length > 0 ? (
                    <button
                      className="detail-btn detail-btn--secondary"
                      onClick={() => { setShowClaimsModal(true); fetchClaims(); }}
                    >
                      {s.viewClaims} ({pendingClaims.length})
                    </button>
                  ) : (
                    <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "8px 0", margin: 0 }}>
                      {s.noClaimsYet}
                    </p>
                  )
                )}

                {/* Confirm handoff button (claim accepted, not yet handed off) */}
                {currentStatus === "claim_accepted" && !item.handoff_confirmed_by_poster && (
                  <button className="detail-btn detail-btn--success" onClick={handleFinderConfirmHandoff} disabled={actionLoading}>
                    {actionLoading ? s.confirming : s.confirmHandoff}
                  </button>
                )}

                {/* Waiting for claimant to confirm */}
                {currentStatus === "handed_off" && item.handoff_confirmed_by_poster && !item.handoff_confirmed_by_claimant && (
                  <button className="detail-btn detail-btn--disabled" disabled>
                    {s.waitingClaimant}
                  </button>
                )}

                {/* Disputed */}
                {currentStatus === "disputed" && (
                  <button className="detail-btn detail-btn--disabled" disabled>
                    {s.disputedAdmin}
                  </button>
                )}

                {/* Message accepted claimant */}
                {(currentStatus === "claim_accepted" || currentStatus === "handed_off") && item.accepted_claimant_id && (
                  <button
                    className="detail-btn detail-btn--secondary"
                    onClick={() => openChatWith(item.accepted_claimant_id, item.accepted_claimant_name || "Claimant")}
                  >
                    <FaMessage style={{ marginRight: 8 }} />
                    {s.messagePrefix} {item.accepted_claimant_name || "Claimant"}
                  </button>
                )}
              </>
            )}

            {/* ── CLAIMANT / VISITOR ACTIONS ── */}
            {!isItemOwner && (
              <>
                {/* Submit claim */}
                {currentStatus === "waiting" && !myExistingClaim && !claimSubmitted && (
                  <button className="detail-btn detail-btn--primary" onClick={() => setShowClaimModal(true)}>
                    {s.submitClaimBtn}
                  </button>
                )}

                {/* Already submitted a claim */}
                {(myExistingClaim || claimSubmitted) && myExistingClaim?.status !== "accepted" && (
                  <button className="detail-btn detail-btn--disabled" disabled>
                    {s.claimSubmittedBtn}
                  </button>
                )}

                {/* My claim was accepted — info only; receipt button appears only after finder confirms handoff */}
                {isMyAcceptedClaim && currentStatus === "claim_accepted" && (
                  <div style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid var(--success)", background: "rgba(16,185,129,0.08)", fontFamily: "var(--font-body)", fontSize: 13, color: "var(--success)" }}>
                    {s.claimAcceptedMsg}
                  </div>
                )}

                {/* Handed off — claimant confirms receipt */}
                {isMyAcceptedClaim && currentStatus === "handed_off" && !item.handoff_confirmed_by_claimant && (
                  <>
                    <div style={{ padding: "12px 16px", borderRadius: 10, background: "var(--bg-card)", border: "1.5px solid var(--success)", marginBottom: 8 }}>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", fontWeight: 700, color: "var(--success)", margin: "0 0 4px" }}>
                        {s.claimAcceptedTitle}
                      </p>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
                        {s.claimAcceptedSub}
                      </p>
                    </div>
                    <button className="detail-btn detail-btn--success" onClick={handleClaimantConfirmReceipt} disabled={actionLoading}>
                      {actionLoading ? s.confirming : s.iReceived}
                    </button>
                    <button
                      className="detail-btn detail-btn--secondary"
                      style={{ border: "1.5px solid var(--danger)", color: "var(--danger)", background: "transparent" }}
                      onClick={() => setShowDisputeModal(true)}
                    >
                      {s.fileDisputeBtn}
                    </button>
                  </>
                )}

                {/* Disputed */}
                {currentStatus === "disputed" && (
                  <button className="detail-btn detail-btn--disabled" disabled>
                    {s.disputeReview}
                  </button>
                )}

                {/* Claim pending but item is in claim_accepted (someone else got it) */}
                {currentStatus === "claim_accepted" && !isMyAcceptedClaim && (
                  <button className="detail-btn detail-btn--disabled" disabled>
                    {s.anotherClaim}
                  </button>
                )}

                {/* Message finder (always visible for non-owners) */}
                {currentStatus !== "disputed" && (
                  <button
                    className="detail-btn detail-btn--secondary"
                    onClick={() => openChatWith(item.authorId, item.authorName || "Finder")}
                  >
                    <FaMessage style={{ marginRight: 8}} />
                    {s.messageFinder}
                  </button>
                )}
              </>
            )}
          </div>

        </div>
      </div>

      {/* Related items */}
      {relatedLoaded && (
        <div className="related-section">
          <div className="related-section__header">
            <p className="related-section__title">{s.similarItems}</p>
          </div>
          {relatedItems.length === 0 ? (
            <p className="related-loading">{s.noSimilarItems}</p>
          ) : (
            <div className="related-grid">
              {relatedItems.map((ri: any) => {
                const img = ri.image || null;
                return (
                  <a key={ri.id} href={`/school-items/${ri.id}`} className="related-card">
                    {img
                      ? <img src={img} alt={ri.name} className="related-card__img" />
                      : <div className="related-card__img-placeholder">{s.noImage}</div>}
                    <div className="related-card__body">
                      <p className="related-card__name">{relatedNameMap[ri.id] || ri.name}</p>
                      {ri.category && <p className="related-card__cat">{relatedCatMap[ri.id] || ri.category}</p>}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CLAIM SUBMISSION MODAL ── */}
      {showClaimModal && !isItemOwner && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => { setShowClaimModal(false); setClaimProof(""); setClaimProofFile(null); }}
        >
          <div
            style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 14, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontFamily: "var(--font-body)", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              {s.submitClaimTitle}
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              {s.claimInstructions}
            </p>
            <textarea
              className="school-claim-textarea"
              value={claimProof}
              onChange={(e) => setClaimProof(e.target.value)}
              placeholder={s.claimPlaceholder}
              rows={5}
              style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none" }}
            />
            <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: claimProof.trim().length >= 20 ? "var(--success)" : "var(--text-muted)", margin: "-8px 0 0", textAlign: "right" }}>
              {claimProof.trim().length}/20 {s.minChars}
            </p>
            <div>
              <label
                className="panel-form__label"
                style={{ display: "block", marginBottom: 6 }}
              >
                {s.uploadProof}
              </label>
              <label
                className="panel-form__file-label"
                htmlFor="school-claim-proof-upload"
              >
                <span className="panel-form__file-icon">+</span>
                <span className="panel-form__file-text">
                  {claimProofFile ? claimProofFile.name : s.chooseImage}
                </span>
              </label>
              <input
                id="school-claim-proof-upload"
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
                onClick={() => { setShowClaimModal(false); setClaimProof(""); setClaimProofFile(null); }}
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "1.5px solid var(--border-input)", background: "transparent", color: "var(--text-muted)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                {s.cancel}
              </button>
              <button
                onClick={handleSubmitClaim}
                disabled={claimProof.trim().length < 20 || claimSubmitting}
                style={{ flex: 2, padding: "11px 0", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13, cursor: claimProof.trim().length >= 20 ? "pointer" : "not-allowed", opacity: claimProof.trim().length >= 20 ? 1 : 0.5 }}
              >
                {claimSubmitting ? s.submitting : s.submitClaim}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CLAIMS REVIEW MODAL ── */}
      {isItemOwner && showClaimsModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setShowClaimsModal(false)}
        >
          <div
            style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 16, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontFamily: "var(--font-body)", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              {s.claimsFor} "{item.name}"
            </p>
            {claimsLoading ? (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)" }}>{s.loading}</p>
            ) : claims.length === 0 ? (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)" }}>{s.noClaimsModal}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {claims.map((claim) => (
                  <div
                    key={claim.id}
                    style={{ border: "1px solid var(--border-default)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, opacity: claim.status === "rejected" ? 0.55 : 1 }}
                  >
                    {/* Header row: name + date on left, status badge on right */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 14, color: "var(--text-primary)", margin: "0 0 2px" }}>{claim.claimant_name}</p>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{new Date(claim.created_at).toLocaleDateString()}</p>
                      </div>
                      <span style={{ padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, fontFamily: "var(--font-body)", background: claim.status === "accepted" ? "var(--success)" : claim.status === "rejected" ? "var(--bg-input)" : "var(--warning)", color: claim.status === "pending" ? "#fff" : claim.status === "accepted" ? "#fff" : "var(--text-muted)", flexShrink: 0 }}>
                        {claim.status === "accepted" ? s.accept : claim.status === "rejected" ? s.reject : s.pending}
                      </span>
                    </div>

                    {/* Claim text */}
                    <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, margin: 0 }}>{claim.description_proof}</p>

                    {/* Proof image */}
                    {claim.proof_image_url && (
                      <a href={claim.proof_image_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block" }}>
                        <img src={claim.proof_image_url} alt="proof" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-default)", display: "block", cursor: "pointer" }} />
                      </a>
                    )}

                    {/* Pending actions */}
                    {claim.status === "pending" && (
                      <>
                        {rejectingId === claim.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <textarea
                              value={rejectReasons[claim.id] || ""}
                              onChange={(e) => setRejectReasons((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                              placeholder={s.rejectPlaceholder}
                              rows={3}
                              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none" }}
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => { setRejectingId(null); setRejectReasons((prev) => { const n = { ...prev }; delete n[claim.id]; return n; }); }}
                                style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1.5px solid var(--border-input)", background: "transparent", color: "var(--text-muted)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                              >
                                {s.cancel}
                              </button>
                              <button
                                onClick={() => handleRejectClaim(claim)}
                                disabled={claimActionLoading || !(rejectReasons[claim.id] || "").trim()}
                                style={{ flex: 2, padding: "9px 0", borderRadius: 8, border: "none", background: "var(--danger)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, cursor: (rejectReasons[claim.id] || "").trim() ? "pointer" : "not-allowed", opacity: (rejectReasons[claim.id] || "").trim() ? 1 : 0.5 }}
                              >
                                {claimActionLoading ? s.rejecting : s.confirmReject}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => handleAcceptClaim(claim)}
                              disabled={claimActionLoading}
                              style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "var(--success)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                            >
                              {claimActionLoading ? s.accepting : s.accept}
                            </button>
                            <button
                              onClick={() => setRejectingId(claim.id)}
                              style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "var(--danger)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                            >
                              {s.reject}
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => { setShowClaimsModal(false); openChatWith(claim.claimant_id, claim.claimant_name); }}
                          style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1.5px solid var(--accent)", background: "var(--accent)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 4, transition: "opacity 0.15s ease, transform 0.12s ease" }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.opacity = "0.88";
                            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                          }}
                        >
                          {s.messageClaimant}
                        </button>
                      </>
                    )}

                    {/* Accepted — message button */}
                    {claim.status === "accepted" && (
                      <button
                        onClick={() => { setShowClaimsModal(false); openChatWith(claim.claimant_id, claim.claimant_name); }}
                        style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1.5px solid var(--accent)", background: "var(--accent)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 4, transition: "opacity 0.15s ease, transform 0.12s ease" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.opacity = "0.88";
                          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                        }}
                      >
                        {s.messageClaimant}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowClaimsModal(false)}
              style={{ padding: "11px 0", borderRadius: 9, border: "1.5px solid var(--border-input)", background: "transparent", color: "var(--text-muted)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              {s.close}
            </button>
          </div>
        </div>
      )}

      {/* ── DISPUTE MODAL ── */}
      {showDisputeModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => { setShowDisputeModal(false); setDisputeReason(""); }}
        >
          <div
            style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 14, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontFamily: "var(--font-body)", fontSize: 20, fontWeight: 700, color: "var(--danger)", margin: 0 }}>
              {s.fileDisputeTitle}
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              {s.disputeInstructions}
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder={s.disputePlaceholder}
              rows={5}
              style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: `1.5px solid ${disputeReason.length > 0 && disputeReason.trim().length < 50 ? "var(--danger)" : "var(--border-input)"}`, background: "var(--bg-input)", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none" }}
            />
            <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: disputeReason.trim().length >= 50 ? "var(--success)" : "var(--text-muted)", margin: "-8px 0 0", textAlign: "right" }}>
              {disputeReason.trim().length}/50 {s.minChars}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setShowDisputeModal(false); setDisputeReason(""); }}
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "1.5px solid var(--border-input)", background: "transparent", color: "var(--text-muted)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                {s.cancel}
              </button>
              <button
                onClick={handleSubmitDispute}
                disabled={disputeReason.trim().length < 50 || disputeSubmitting}
                style={{ flex: 2, padding: "11px 0", borderRadius: 9, border: "none", background: "var(--danger)", color: "#fff", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13, cursor: disputeReason.trim().length >= 50 ? "pointer" : "not-allowed", opacity: disputeReason.trim().length >= 50 ? 1 : 0.5 }}
              >
                {disputeSubmitting ? s.filing : s.submitDispute}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT MODAL ── */}
      {showReport && (
        <div className="detail-overlay" onClick={() => setShowReport(false)}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            {reportDone ? (
              <div className="panel-success">
                <p>{s.reportSubmitted}</p>
              </div>
            ) : (
              <>
                <p className="detail-modal__title">Report "{item.name}"</p>
                <p className="detail-modal__subtitle">{s.whyReporting}</p>
                <div className="detail-modal__reasons">
                  {REPORT_REASONS.map((r, i) => {
                    const labels = [s.reasonInappropriate, s.reasonSpam, s.reasonMisleading, s.reasonClaimed, s.reasonOther];
                    return (
                      <button key={r} className={`detail-modal__reason${reportReason === r ? " detail-modal__reason--selected" : ""}`} onClick={() => setReportReason(r)}>
                        {labels[i]}
                      </button>
                    );
                  })}
                </div>
                <div className="detail-modal__actions">
                  <button className="detail-modal__cancel" onClick={() => setShowReport(false)}>{s.cancel}</button>
                  <button className="detail-modal__submit" onClick={handleReportSubmit} disabled={!reportReason || reportSubmitting}>
                    {reportSubmitting ? s.submittingReport : s.submitReport}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CHAT PANEL ── */}
      {showChat && user && (
        <div className="detail-overlay" onClick={closeChat}>
          <div className="detail-chat" onClick={(e) => e.stopPropagation()}>
            <div className="detail-chat__header">
              <div className="chat-modal__avatar">
                {activeChatPartnerName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="chat-modal__header-info">
                <div className="chat-modal__name">{activeChatPartnerName}</div>
                <div className="chat-modal__item">{item.name}</div>
              </div>
              <button className="chat-modal__close" onClick={closeChat}>×</button>
            </div>
            <div className="chat-modal__messages">
              {item && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-input)", borderRadius: 10, margin: "8px 12px", border: "1px solid var(--border-default)" }}>
                  {item.image && (
                    <img src={item.image} alt={item.name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <p style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13, color: "var(--text-primary)", margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </p>
                  <a href={`/school-items/${item.id}`} target="_blank" rel="noreferrer" style={{ background: "var(--accent)", color: "#fff", fontSize: 11, padding: "3px 10px", borderRadius: 100, textDecoration: "none", fontWeight: 600, fontFamily: "var(--font-body)", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {s.viewItem}
                  </a>
                </div>
              )}
              {messages.length === 0 && (
                <div className="chat-modal__empty">
                  <p>{s.sayHiAbout} <strong>{item.name}</strong></p>
                </div>
              )}
              {messages.map((msg) => {
                const isOwn = msg.sender_id === user.id;
                return (
                  <div key={msg.id} className={`chat-bubble-wrapper${isOwn ? " chat-bubble-wrapper--own" : ""}`}>
                    <div className={`chat-bubble${isOwn ? " chat-bubble--own" : " chat-bubble--other"}`}>
                      {msg.text}
                    </div>
                    <span className="chat-bubble__time">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            {messages.length === 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "8px 12px", borderTop: "1px solid var(--border-default)" }}>
                {[
                  s.chatTemplateMine,
                  s.chatTemplateDescribe,
                  s.chatTemplateMeet,
                  s.chatTemplateAvailable,
                ].map((template) => (
                  <button
                    key={template}
                    onClick={() => setChatText(template)}
                    style={{ padding: "6px 12px", borderRadius: "100px", border: "1.5px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease", whiteSpace: "nowrap" }}
                    onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.target as HTMLButtonElement).style.color = "var(--accent)"; }}
                    onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.borderColor = "var(--border-input)"; (e.target as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
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
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                placeholder={s.typeMessage}
                className="chat-modal__textarea"
              />
              <button onClick={handleSendChat} disabled={!chatText.trim() || chatSending} className={`chat-modal__send${chatText.trim() ? " chat-modal__send--active" : ""}`}>
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}