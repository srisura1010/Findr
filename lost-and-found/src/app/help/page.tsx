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
  { q: "What is Findr?", a: "Findr is a lost & found platform for schools and institutions. If you find something, you post it. If you lost something, you search and claim it — all in one place." },
  { q: "Do I need an account to use Findr?", a: "You can browse posted items without an account, but you'll need to sign in to post a found item, retrieve an item, or message a finder." },
  { q: "How do I sign in?", a: "Click 'Sign In' in the top navigation. We use Clerk for authentication, so you can sign in with your email or a social account. Your profile info is automatically filled in when you post items." }]

},
{
  id: "finding-items",
  label: "Finding Items",
  icon: "",
  questions: [
  { q: "How do I search for a lost item?", a: "Use the search bar on the dashboard. You can type keywords like the color, brand, item type, or location where you lost it. Our AI-powered search understands natural language, so try things like 'blue water bottle' or 'AirPods case'." },
  { q: "How does the AI image search work?", a: "When a finder uploads a photo of an item, our AI automatically reads and tags the image with keywords — things like color, brand, and type. This makes items searchable even if the finder didn't describe them perfectly." },
  { q: "What does 'waiting' status mean?", a: "'Waiting' means the item has been posted and is available to be claimed. No one has started a retrieval request yet." },
  { q: "What does 'pending' status mean?", a: "'Pending' means someone has submitted a retrieval request. The original finder gets an email notification and needs to confirm the claim." }]

},
{
  id: "posting-items",
  label: "Posting Found Items",
  icon: "",
  questions: [
  { q: "How do I post a found item?", a: "Go to the Dashboard and click 'Add Item' in the sidebar. Fill in the item name, a description (include where and when you found it), and upload a clear photo. Hit 'Post Item' and it'll be live instantly." },
  { q: "What makes a good item description?", a: "Include: where you found it (e.g., 'near the gym lockers'), when you found it, any identifying features (color, brand, engravings), and where the item is being kept." },
  { q: "Can I delete my posted item?", a: "Contact an admin to remove a listing. If the item has been claimed, use 'Confirm Claimed' — the item will be automatically removed from the board." }]

},
{
  id: "claiming",
  label: "Claiming & Retrieval",
  icon: "",
  questions: [
  { q: "How do I claim an item I lost?", a: "Find your item in the dashboard, then click 'Retrieve'. This sends an email notification to the finder and marks the item as 'Pending'. The finder will reach out to arrange the handoff." },
  { q: "I'm the finder — how do I confirm a handoff?", a: "Once you've physically returned the item, go to the item card and click 'Confirm Claimed'. This deletes the listing and closes the loop." },
  { q: "Can I message the finder before claiming?", a: "Yes! Hit 'Message Finder' on any item card to open a real-time chat. Coordinate pickup without sharing personal contact info." }]

},
{
  id: "admin",
  label: "Admin",
  icon: "",
  questions: [
  { q: "How do I become an admin?", a: "Click 'Become an Admin' in the dashboard sidebar. Fill out the form with your school, staff number, and optionally upload your ID badge. Requests are reviewed manually and you'll receive an approval email." },
  { q: "What can admins do?", a: "Admins can delete any item from the board — useful for removing spam, duplicates, or items resolved offline." },
  { q: "I forgot my admin password. What do I do?", a: "Reach out to your institution's Findr contact or the super-admin. Admin passwords are issued per-account and can be reset." }]

},
{
  id: "settings",
  label: "Settings",
  icon: "",
  questions: [
  { q: "Can I change the language?", a: "Yes! Go to Settings and pick your preferred language. Findr uses AI-powered translation to localize the entire interface." },
  { q: "Does Findr have text-to-speech?", a: "Yes — go to the Settings page to enable TTS, which will read item descriptions aloud." }]

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

- Users post found items (name, description, photo) on the dashboard
- AI reads item photos and auto-tags them with keywords for better search
- Users search items using natural language in the search bar
- Clicking "Retrieve" sends an email to the finder and marks it "pending"
- Finder clicks "Confirm Claimed" once they hand the item back — it's deleted
- "Message Finder" opens a real-time chat between finder and claimer
- "Become an Admin" lets staff submit a request; approved admins get a password and can delete items
- Settings page has language switching (AI translation) and text-to-speech accessibility
- Built with Next.js, Clerk auth, Supabase, Groq AI, EmailJS

If you don't know something, say so and suggest contacting the school admin.`;

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
      <p className="chatbot-intro">{poweredByText} <strong>Groq</strong> — {askAnythingText}</p>
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
{ num: "02", title: "Browse Items", desc: "Search the dashboard for your lost item using keywords, colors, or item type." },
{ num: "03", title: "Claim or Post", desc: "Hit 'Retrieve' to claim a found item, or 'Add Item' to report something you found." },
{ num: "04", title: "Connect", desc: "Use 'Message Finder' to chat directly and arrange the handoff." },
{ num: "05", title: "Confirm", desc: "Once returned, the finder hits 'Confirm Claimed' — the listing is removed automatically." }];


const PRO_TIPS = [
"Use descriptive keywords when searching — the AI understands \"black north face backpack\"",
"Post found items ASAP with a clear photo — AI auto-tags it for better discoverability",
"Use \"Message Finder\" before claiming if you need to confirm it's yours",
"Admins can moderate the board — contact them for duplicate or spam listings",
"Switch languages in Settings if English isn't your first language"];


export default function HelpPage() {
  const { language } = useSettings();
  const { user } = useUser();
  const router = useRouter();
  const [banChecked, setBanChecked] = useState(false);
  const [activeSection, setActiveSection] = useState<"guide" | "faq" | "chat">("guide");

  const quickStartLabel = useTranslated("Quick Start", language);
  const faqLabel = useTranslated("FAQs", language);
  const aiSupportLabel = useTranslated("AI Support", language);
  const helpTitle = useTranslated("Help & Support", language);
  const helpSubtitle = useTranslated("Everything you need to use Findr — guides, FAQs, and live AI support.", language);
  const howItWorksText = useTranslated("How it works", language);
  const proTipsText = useTranslated("Pro Tips", language);
  const faqHeading = useTranslated("Frequently Asked Questions", language);
  const aiSupportHeading = useTranslated("AI Support Chat", language);

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

  if (!banChecked) return <LoadingSpinner />;

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
