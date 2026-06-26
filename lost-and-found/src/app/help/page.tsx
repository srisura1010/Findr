"use client";

import "./help.css";
import { useState, useRef, useEffect } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/app/components/LoadingSpinner";


interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function useTranslated(text: string, language: string): string {
  const [translated, setTranslated] = useState(text);

  useEffect(() => {
    setTranslated(text);
    if (language === "en") return;

    const cacheKey = `help_${text.slice(0, 40).replace(/\s+/g, "_")}_${language}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {setTranslated(cached);return;}

    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target: language })
    }).
    then((r) => r.json()).
    then((d) => {
      const result = d.translatedText || text;
      setTranslated(result);
      localStorage.setItem(cacheKey, result);
    }).
    catch(() => setTranslated(text));
  }, [text, language]);

  return translated;
}

function TranslatedText({ text, language }: {text: string;language: string;}) {
  const translated = useTranslated(text, language);
  return <>{translated}</>;
}

const FAQ_CATEGORIES = [
{
  id: "getting-started",
  label: "Getting Started",
  icon: "",
  questions: [
  { q: "What is Findr?", a: "Findr is a lost & found platform for schools and institutions. Finders post items they've found, and claimants submit proof-based claims to retrieve themall in one place with a full verification workflow." },
  { q: "Do I need an account to use Findr?", a: "You can browse posted items without an account, but you'll need to sign in to post a found item, submit a claim, or message a finder." },
  { q: "How do I sign in?", a: "Click 'Sign In' in the top navigation. We use Clerk for authentication, so you can sign in with your email or a social account. Your profile info is automatically filled in when you post items." }]
},
{
  id: "finding-items",
  label: "Finding Items",
  icon: "",
  questions: [
  { q: "How do I search for a lost item?", a: "Use the search bar on the dashboard. You can type keywords like the color, brand, item type, or location where you lost it. Our AI-powered search understands natural language, so try things like 'blue water bottle' or 'AirPods case'." },
  { q: "How does the AI image search work?", a: "When a finder uploads a photo of an item, our AI automatically reads and tags the image with keywordsthings like color, brand, and type. This makes items searchable even if the finder didn't describe them perfectly." },
  { q: "What do the item status labels mean?", a: "'Available' means the item is waiting to be claimed. 'Claim in progress' means a claim was accepted and the finder is arranging the handoff. 'Awaiting confirmation' means the finder confirmed the handoff and the claimant needs to confirm receipt. 'Disputed' means the claimant opened a dispute that an admin is reviewing." },
  { q: "Can I filter items by category or date?", a: "Yesuse the filter bar on the dashboard to filter by category, location, or date range. Active filters show as removable chips so you can see exactly what's applied." }]
},
{
  id: "claiming",
  label: "Claiming Items",
  icon: "",
  questions: [
  { q: "How do I claim an item I lost?", a: "Find your item and click 'This is mine'. You'll need to describe something specific about the item that is NOT visible in the photoa scratch, a name written inside, a sticker placement, etc. You can also upload optional proof like a receipt or photo. The finder reviews your claim and decides to accept or reject it." },
  { q: "Why do I need to provide proof?", a: "Proof protects against false claims. Since anyone can see the item photo, we ask you to describe something only the true owner would knowsomething not visible in the image. The finder uses this to verify your ownership." },
  { q: "How many claims can I have active at once?", a: "You can have a maximum of 2 active claims at any time. Once a claim is resolved (accepted, rejected, or cancelled), the slot frees up. Cancelled claims still count toward the limit for 24 hours to prevent abuse." },
  { q: "Can I cancel a claim I submitted?", a: "Yes, as long as the item is still in 'waiting' status and the finder hasn't accepted your claim yet. Go to 'My Dashboard' and find it under 'My Active Claims'. Once a claim is accepted, it can no longer be cancelled." },
  { q: "What happens if my claim is rejected?", a: "You'll receive a notification with the finder's reason. Once rejected on a specific item, you cannot re-submit a claim for that same item. If you believe the rejection was wrong, you can report the item from the dashboard." },
  { q: "What if multiple people claim the same item?", a: "The finder sees all pending claims and chooses one to accept. When a claim is accepted, all other pending claims for that item are automatically rejected and those claimants are notified." }]
},
{
  id: "handoff",
  label: "Handoff & Disputes",
  icon: "",
  questions: [
  { q: "What happens after my claim is accepted?", a: "The finder will see a banner prompting them to physically hand the item back to you. Once they do, they click 'Confirm I Handed It Back'. You then receive a notification to confirm receipt on your end." },
  { q: "How do I confirm I received my item?", a: "After the finder confirms the handoff, go to the item page and click 'Confirm I Received It'. This completes the return and removes the listing. You have 48 hours before the system auto-confirms." },
  { q: "What if I didn't actually receive the item?", a: "Click 'Dispute' on the item page instead of confirming receipt. Write a description of what went wrong (minimum 50 characters). All registered admins are notified immediately and the item is flagged as disputed. An admin will review and either resolve it in your favor (deleting the listing) or dismiss the dispute (returning the item to claim_accepted status)." },
  { q: "Can I message the finder?", a: "Yesuse 'Message Finder' on any item page to open a real-time chat. You can also access all your conversations from the Messages page in the navigation. Conversations are organized per person, so all messages with the same user appear in one thread regardless of which item you're discussing." }]
},
{
  id: "posting-items",
  label: "Posting Found Items",
  icon: "",
  questions: [
  { q: "How do I post a found item?", a: "Go to the Dashboard and click 'Lost/Found Item' in the sidebar, then select 'Found an Item'. Fill in the item name, category, description (include where and when you found it), location, and upload a clear photo. Hit 'Post Item' and it'll be live instantly." },
  { q: "What makes a good item description?", a: "Include: where you found it (e.g., 'near the gym lockers'), when you found it, any identifying features (color, brand, engravings), and the general condition of the item. Don't reveal every detailleave some features for claimants to describe so you can verify their proof." },
  { q: "How do I review claims on my item?", a: "When claims come in, a 'View Claims (N)' button appears on your item page showing how many pending claims exist. Click it to open a review panel where you can read each claimant's proof description, view any proof images they uploaded, and choose to Accept or Reject. Accepting requires no reason; Rejecting requires you to enter a reason." },
  { q: "Can I message a claimant to ask for more info?", a: "Yesin the claims review modal, each claim card has a 'Message Claimant' option. Your message goes directly into the in-app chat thread with that user." },
  { q: "Can I delete my posted item?", a: "Yes, but with restrictions based on claim status. If there are no claims: simple delete. If there are pending claims: you'll be warned and claimants will be notified. If a claim is accepted: you'll be warned and the accepted claimant will be notified. If the item is in 'handed_off' or 'disputed' status, deletion is blocked until the situation resolves." },
  { q: "What happens if my item gets too many rejected claims?", a: "If 5 or more claims are rejected on a single item, it's automatically flagged in the admin Reports panel as potential finder misconduct. An admin may review the situation." }]
},
{
  id: "schools",
  label: "School Boards",
  icon: "",
  questions: [
  { q: "What is a School Board?", a: "School Boards are private lost & found boards for specific schools or institutions. Each school has its own themed board with its own found items and lost item reports, separate from the main Findr board." },
  { q: "How do I join a school board?", a: "Go to the Schools page in the navigation and enter your school's code. Once joined, the school's board appears in your schools list and you can post and browse items specific to that school." },
  { q: "How do I become a school admin?", a: "On your school's board page, click the Admin tab and enter the school admin password from your Findr approval email. Once unlocked, you can delete items, view school-specific reports, and access the school inbox." },
  { q: "Can I message a school admin?", a: "Yeson the Messages page, click 'Contact a School Admin' to select your school and choose who to message. School admin conversations are separate from regular item chats." }]
},
{
  id: "admin",
  label: "Admin",
  icon: "",
  questions: [
  { q: "How do I become a Findr admin?", a: "Click 'Become an Admin' in the dashboard sidebar. Fill out the form with your school, staff number, and optionally upload your ID badge. Requests are reviewed manually and you'll receive an approval email with your admin password." },
  { q: "What can Findr admins do?", a: "Admins can delete any item, ban or suspend users, view reported items and users, manage disputes (resolve in claimant's favor or dismiss back to claim_accepted), and message any party in a dispute directly through the in-app chat." },
  { q: "How does dispute resolution work for admins?", a: "In the dashboard under Reports → Disputes, each dispute card shows the item name, the claimant's reason, a 'View Item' link, and a 'Message Parties' button. Admins can message either the finder or the claimant directly. 'Resolve for Claimant' permanently deletes the item listing. 'Dismiss Dispute' returns the item to claim_accepted status so the finder can re-confirm the handoff." },
  { q: "I forgot my admin password. What do I do?", a: "Reach out to a super-admin. Admin passwords are issued per-account and can be reset through the super-admin panel." }]
},
{
  id: "settings",
  label: "Settings & Accessibility",
  icon: "",
  questions: [
  { q: "Can I change the language?", a: "Yesgo to Settings and pick your preferred language. Findr uses AI-powered translation to localize the entire interface including item descriptions." },
  { q: "Does Findr have text-to-speech?", a: "Yesgo to the Settings page to enable TTS, which will read item descriptions aloud." },
  { q: "Does Findr have accessibility modes?", a: "YesSettings includes a high-contrast mode and a colorblind-friendly mode in addition to the standard light and dark themes." }]
}];


function FAQAccordion({ language }: {language: string;}) {
  const [activeCategory, setActiveCategory] = useState("getting-started");
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const activeData = FAQ_CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <div>
      <div className="faq-categories">
        {FAQ_CATEGORIES.map((cat) =>
        <button
          key={cat.id}
          className={`faq-cat-btn${activeCategory === cat.id ? " active" : ""}`}
          onClick={() => {setActiveCategory(cat.id);setOpenQuestion(null);}}>
          
            <span>{cat.icon}</span>
            <span><TranslatedText text={cat.label} language={language} /></span>
          </button>
        )}
      </div>
      <div>
        {activeData?.questions.map((item, i) => {
          const key = `${activeCategory}-${i}`;
          const isOpen = openQuestion === key;
          return (
            <div key={key} className="faq-item">
              <button className="faq-item__question" onClick={() => setOpenQuestion(isOpen ? null : key)}>
                <span><TranslatedText text={item.q} language={language} /></span>
                <span className={`faq-item__chevron${isOpen ? " faq-item__chevron--open" : ""}`}>›</span>
              </button>
              {isOpen &&
              <div className="faq-item__answer">
                  <TranslatedText text={item.a} language={language} />
                </div>
              }
            </div>);

        })}
      </div>
    </div>);

}

const SYSTEM_PROMPT = `You are the helpful support assistant for Findr, a school lost & found web app.
Keep answers short, friendly, and focused on Findr. Here's what you know:

POSTING FOUND ITEMS:
- Finders post items via Dashboard → Lost/Found Item → Found an Item
- They fill in name, category, description, location (map picker), and upload up to 3 photos
- AI auto-tags photos with keywords for better searchability
- Items start with "waiting" status

CLAIMING ITEMS (the new proof-based flow):
- Claimants click "This is mine" on an item page
- They must describe something specific NOT visible in the photo (min 20 chars) to prove ownership
- Optional proof image upload (receipt, old photo, etc.)
- Max 2 active claims at once; cancelled claims count for 24h to prevent abuse
- Once rejected on an item, you cannot re-claim that same item

FINDER REVIEWS CLAIMS:
- "View Claims (N)" button appears on their item when claims come in
- They see each claimant's name, proof text, and optional proof image
- Accept: sets item to claim_accepted, auto-rejects and notifies all other claimants
- Reject: requires a typed reason, increments rejection counter; 5+ rejections auto-flags item to admin

HANDOFF FLOW:
- Finder physically hands item back, then clicks "Confirm I Handed It Back" → item becomes "handed_off"
- Claimant gets notified to confirm receipt within 48 hours
- Claimant clicks "Confirm I Received It" → item is permanently deleted (success!)
- Or claimant clicks "Dispute" → writes reason (min 50 chars) → all admins notified, item flagged "disputed"

ADMIN DISPUTE RESOLUTION:
- Admins see disputes in Dashboard → Reports → Disputes tab
- Each dispute shows item name, reason, View Item link, Message Parties button
- "Resolve for Claimant": deletes item permanently
- "Dismiss Dispute": returns item to claim_accepted so finder can re-confirm handoff
- Admins can message finder or claimant directly via in-app chat

DELETION RULES:
- No claims: simple delete
- Pending claims exist: warns finder, notifies claimants on delete
- Claim accepted: warns finder, notifies accepted claimant on delete
- Handed off or disputed: BLOCKED, cannot delete

MESSAGING:
- All conversations are per user-pair (not per item)one thread per two people regardless of items
- Messages page shows all conversations with unread indicators
- "Message Finder" on item page, "Message Claimant" in claims review modal
- Admins can message dispute parties from the Disputes panel
- "Contact an Admin" and "Contact a School Admin" buttons on the Messages page

SCHOOL BOARDS:
- Private boards per school with their own items, theming, and admins
- Join with a school code; school admins unlock with a password from their approval email
- School admins can delete items, view school reports, and access school inbox

SETTINGS:
- Language switching with AI translation
- Text-to-speech for item descriptions
- High-contrast and colorblind-friendly modes
- Light/dark themes

Built with Next.js, Clerk auth, Supabase, Groq AI, Resend email.

If you don't know something, say so and suggest contacting a Findr admin.`;

function GroqChatbot({ language }: {language: string;}) {
  const initialMessage = useTranslated("Hey! I'm Findr's support assistant. Ask me anything about how to use the app", language);
  const placeholderText = useTranslated("Ask anything about Findr...", language);
  const poweredByText = useTranslated("Powered by", language);
  const askAnythingText = useTranslated("Ask anything about how the app works.", language);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([{ role: "assistant", content: initialMessage }]);
  }, [initialMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/groq-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...updatedMessages.map((m) => ({ role: m.role, content: m.content }))]

        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {e.preventDefault();sendMessage();}
  };

  return (
    <>
      <p className="chatbot-intro">{poweredByText} <strong>Groq</strong>: {askAnythingText}</p>
      <div className="chatbot">
        <div className="chatbot__header">
          <div className="chatbot__header-dot" />
          <span className="chatbot__header-title"><TranslatedText text="Findr AI Support" language={language} /></span>
        </div>
        <div className="chatbot__messages">
          {messages.map((msg, i) =>
          <div key={i} className={`chatbot__bubble-wrap${msg.role === "user" ? " chatbot__bubble-wrap--user" : ""}`}>
              {msg.role === "assistant" && <div className="chatbot__avatar">F</div>}
              <div className={`chatbot__bubble chatbot__bubble--${msg.role}`}>{msg.content}</div>
            </div>
          )}
          {loading &&
          <div className="chatbot__bubble-wrap">
              <div className="chatbot__avatar">F</div>
              <div className="chatbot__bubble chatbot__bubble--assistant chatbot__bubble--typing">
                <span /><span /><span />
              </div>
            </div>
          }
          <div ref={bottomRef} />
        </div>
        <div className="chatbot__input-row">
          <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown} placeholder={placeholderText} className="chatbot__textarea" />
          <button onClick={sendMessage} disabled={!input.trim() || loading}
          className={`chatbot__send${input.trim() ? " chatbot__send--active" : ""}`}>↑</button>
        </div>
      </div>
    </>);

}

const STEPS = [
{ num: "01", title: "Sign In", desc: "Create an account or sign in with your email via Clerk." },
{ num: "02", title: "Browse Items", desc: "Search the dashboard for your lost item using keywords, colors, category filters, or location." },
{ num: "03", title: "Submit a Claim", desc: "Click 'This is mine' and describe something specific about the item not visible in the photo. The finder uses this to verify ownership." },
{ num: "04", title: "Claim Reviewed", desc: "The finder reviews your proof and accepts or rejects your claim. You'll be notified either way with a reason if rejected." },
{ num: "05", title: "Coordinate Pickup", desc: "Once accepted, use 'Message Finder' to arrange the handoff. The finder posts the item; you retrieve it in person." },
{ num: "06", title: "Confirm Receipt", desc: "After the finder confirms the handoff, you confirm receipt on your end. The listing is permanently removed. Done!" }];


const PRO_TIPS = [
"Use descriptive keywords when searchingthe AI understands 'black north face backpack'",
"When claiming, describe something not in the photo: a name written inside, a specific scratch, a sticker placement",
"Message the finder before or after claiming if you need to confirm details or arrange pickup",
"If you find something, avoid describing every detail in your postleave some details for claimants to prove ownership",
"Check 'My Dashboard' to see pending claims on items you've posted without having to visit each item page",
"Admins can help resolve disputesuse the Dispute button if the finder confirmed a handoff that didn't happen",
"Switch languages in Settings if English isn't your first languagethe whole interface translates"];


export default function HelpPage() {
  const { language, hydrated } = useSettings();
  const { user } = useUser();
  const router = useRouter();
  const [banChecked, setBanChecked] = useState(false);
  const [activeSection, setActiveSection] = useState<"guide" | "faq" | "chat">("guide");

  const [isReady, setIsReady] = useState(false);
  const [quickStartLabel, setQuickStartLabel] = useState("Quick Start");
  const [faqLabel, setFaqLabel] = useState("FAQs");
  const [aiSupportLabel, setAiSupportLabel] = useState("AI Support");
  const [helpTitle, setHelpTitle] = useState("Help & Support");
  const [helpSubtitle, setHelpSubtitle] = useState("Everything you need to use Findr: guides, FAQs, and live AI support.");
  const [howItWorksText, setHowItWorksText] = useState("How it works");
  const [proTipsText, setProTipsText] = useState("Pro Tips");
  const [faqHeading, setFaqHeading] = useState("Frequently Asked Questions");
  const [aiSupportHeading, setAiSupportHeading] = useState("AI Support Chat");

  useEffect(() => {
    if (!hydrated) return;
    if (language === "en") {
      setQuickStartLabel("Quick Start");
      setFaqLabel("FAQs");
      setAiSupportLabel("AI Support");
      setHelpTitle("Help & Support");
      setHelpSubtitle("Everything you need to use Findr: guides, FAQs, and live AI support.");
      setHowItWorksText("How it works");
      setProTipsText("Pro Tips");
      setFaqHeading("Frequently Asked Questions");
      setAiSupportHeading("AI Support Chat");
      setIsReady(true);
      return;
    }
    const translateAndCache = async () => {
      const translations = [
        { key: "Quick Start", setter: setQuickStartLabel, cacheKey: "help_quickStart" },
        { key: "FAQs", setter: setFaqLabel, cacheKey: "help_faq" },
        { key: "AI Support", setter: setAiSupportLabel, cacheKey: "help_aiSupport" },
        { key: "Help & Support", setter: setHelpTitle, cacheKey: "help_title" },
        { key: "Everything you need to use Findr: guides, FAQs, and live AI support.", setter: setHelpSubtitle, cacheKey: "help_subtitle" },
        { key: "How it works", setter: setHowItWorksText, cacheKey: "help_howItWorks" },
        { key: "Pro Tips", setter: setProTipsText, cacheKey: "help_proTips" },
        { key: "Frequently Asked Questions", setter: setFaqHeading, cacheKey: "help_faqHeading" },
        { key: "AI Support Chat", setter: setAiSupportHeading, cacheKey: "help_aiSupportHeading" },
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

  useEffect(() => {
    if (!user) {setBanChecked(true);return;}
    const checkBan = async () => {
      const { data } = await supabase.
      from("banned_users").
      select("email, suspended_until").
      eq("email", user.primaryEmailAddress?.emailAddress).
      single();
      if (data) {
        const isPermanent = !data.suspended_until;
        const isSuspended = data.suspended_until && new Date(data.suspended_until) > new Date();
        if (isPermanent || isSuspended) {router.push("/banned");return;}
      }
      setBanChecked(true);
    };
    checkBan();
  }, [user]);

  if (!banChecked || !isReady) return <LoadingSpinner />;

  return (
    <div className="help-page">
      <div className="help-card">
        <h1>{helpTitle}</h1>
        <p className="help-subtitle">{helpSubtitle}</p>
        <div className="help-nav">
          <button className={activeSection === "guide" ? "active" : ""} onClick={() => setActiveSection("guide")}>{quickStartLabel}</button>
          <button className={activeSection === "faq" ? "active" : ""} onClick={() => setActiveSection("faq")}>{faqLabel}</button>
          <button className={activeSection === "chat" ? "active" : ""} onClick={() => setActiveSection("chat")}>{aiSupportLabel}</button>
        </div>
        {activeSection === "guide" &&
        <>
            <div className="help-section">
              <h3>{howItWorksText}</h3>
              <div className="guide-steps">
                {STEPS.map((step) =>
              <div key={step.num} className="guide-step">
                    <div className="guide-step__num">{step.num}</div>
                    <div>
                      <div className="guide-step__title"><TranslatedText text={step.title} language={language} /></div>
                      <div className="guide-step__desc"><TranslatedText text={step.desc} language={language} /></div>
                    </div>
                  </div>
              )}
              </div>
            </div>
            <div className="help-section">
              <h3>{proTipsText}</h3>
              <ul className="guide-tips">
                {PRO_TIPS.map((tip, i) =>
              <li key={i}><TranslatedText text={tip} language={language} /></li>
              )}
              </ul>
            </div>
          </>
        }
        {activeSection === "faq" &&
        <div className="help-section">
            <h3>{faqHeading}</h3>
            <FAQAccordion language={language} />
          </div>
        }
        {activeSection === "chat" &&
        <div className="help-section">
            <h3>{aiSupportHeading}</h3>
            <GroqChatbot language={language} />
          </div>
        }
      </div>
    </div>);

}