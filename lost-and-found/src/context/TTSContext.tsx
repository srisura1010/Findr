"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Text-to-Speech (TTS) context.
//
// This provider uses the browser's Web Speech API (`window.speechSynthesis`)
// to read relevant page content aloud. It is designed as an accessibility aid
// and reacts to:
// - route changes (via `usePathname`)
// - dynamic content insertion (via MutationObserver)
interface TTSContextType {
  enabled: boolean;
  setEnabled: (val: boolean) => void;
  rate: number;
  setRate: (val: number) => void;
  announce: (text: string) => void;
  cancelSpeech: () => void;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

export const TTSProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Used to re-announce content when the user navigates to a different route.
  const pathname = usePathname();

  // Persist the enabled flag in localStorage so it survives refreshes.
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ttsEnabled") === "true";
    }
    return false;
  });

  // Persist the speech rate (1 = default) in localStorage.
  const [rate, setRateState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return parseFloat(localStorage.getItem("ttsRate") || "1");
    }
    return 1;
  });

  // Keep the latest rate available to callbacks without re-binding functions.
  const rateRef = useRef<number>(rate);

  const setRate = (val: number) => {
    setRateState(val);
    rateRef.current = val;
    localStorage.setItem("ttsRate", val.toString());
  };

  // Web Speech API reference.
  // This is `null` on the server.
  const speechRef = useRef<SpeechSynthesis>(
    typeof window !== "undefined" ? window.speechSynthesis : null
  );

  // Simple FIFO queue of strings to speak.
  // This queue is used to manage the order in which text is spoken.
  // When a new message is added to the queue, it will be spoken after any
  // currently playing messages have finished.
  const queueRef = useRef<string[]>([]);

  // Tracks whether we are currently speaking to avoid overlapping utterances.
  // This flag is used to prevent multiple messages from being spoken at the same time.
  const speakingRef = useRef<boolean>(false);

  useEffect(() => {
    localStorage.setItem("ttsEnabled", enabled.toString());
  }, [enabled]);

  // Cancel current speech and clear any queued utterances.
  // This function is used to stop any currently playing messages and clear the queue.
  const cancelSpeech = () => {
    if (!speechRef.current) return;
    if (speechRef.current.speaking || speechRef.current.pending) {
      speechRef.current.cancel();
    }
    queueRef.current = [];
    speakingRef.current = false;
  };

  // Extract human-readable text from a DOM node.
  // We walk the tree so we can ignore non-element nodes and collapse whitespace.
  // This function is used to extract the text content of a DOM node, ignoring any non-text nodes.
  const extractText = (node: Node): string => {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const childrenText = Array.from(node.childNodes)
      .map((child) => extractText(child))
      .filter(Boolean)
      .join(" ");

    return childrenText;
  };

  // Dequeue and speak the next message.
  // `SpeechSynthesis` is event-driven; we call ourselves again on `onend`.
  // This function is used to speak the next message in the queue.
  // It checks if there are any messages in the queue, and if so, creates a new SpeechSynthesisUtterance object and speaks it.
  const speakNext = () => {
    if (!enabled || !speechRef.current || speakingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      speakingRef.current = false;
      return;
    }

    speakingRef.current = true;
    const utterance = new SpeechSynthesisUtterance(next.trim().replace(/\s+/g, " "));
    utterance.rate = rateRef.current;
    utterance.pitch = 1;

    utterance.onend = () => {
      speakingRef.current = false;
      speakNext();
    };

    speechRef.current.speak(utterance);
  };

  // Queue a message to be spoken.
  // If nothing is currently speaking, we kick off `speakNext` immediately.
  // This function is used to add a new message to the queue.
  // If there are no currently playing messages, it will start speaking the new message immediately.
  const announce = (text: string) => {
    if (!text) return;
    queueRef.current.push(text);
    if (!speakingRef.current) speakNext();
  };

  useEffect(() => {
    // On route changes:
    // - stop any in-progress speech
    // - read the relevant containers for the new page
    cancelSpeech();
    if (!enabled) return;

    // Containers to read.
    // Specific IDs/classes are used so we don't accidentally read nav/footer etc.
    const containers: HTMLElement[] = [
      document.querySelector("#main-content"),
      document.querySelector("#settings-page"),
      document.querySelector("#messages-container"),
      ...Array.from(document.querySelectorAll(".carousel")),
    ].filter(Boolean) as HTMLElement[];

    containers.forEach((container) => {
      let text = "";

      // Carousels can hide non-visible slides; we attempt to read only the visible one.
      if (container.classList.contains("carousel")) {
        const visibleSlide = container.querySelector(
          ".slide:not([style*='display: none'])"
        );
        if (visibleSlide) text = extractText(visibleSlide);
      } else {
        text = extractText(container);
      }
      if (text) announce(text);
    });
  }, [pathname, enabled]);

  useEffect(() => {
    // Observe dynamic content changes (e.g., messages loading, items appearing).
    // When nodes are added, extract and announce their text.
    if (!enabled) return;

    const containers: HTMLElement[] = [
      document.querySelector("#main-content"),
      document.querySelector("#settings-page"),
      document.querySelector("#messages-container"),
      ...Array.from(document.querySelectorAll(".carousel")),
    ].filter(Boolean) as HTMLElement[];

    const observers: MutationObserver[] = containers.map((container) => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              let text = "";
              const element = node as Element;
              const carousel = element.closest?.(".carousel");
              if (carousel) {
                const visibleSlide = carousel.querySelector(
                  ".slide:not([style*='display: none'])"
                );
                if (visibleSlide) text = extractText(visibleSlide);
              } else {
                text = extractText(node);
              }
              if (text) announce(text);
            }
          });
        });
      });

      observer.observe(container, { childList: true, subtree: true });
      return observer;
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, [enabled, pathname]);

  return (
    <TTSContext.Provider
      value={{ enabled, setEnabled, rate, setRate, announce, cancelSpeech }}
    >
      {children}
    </TTSContext.Provider>
  );
};

export const useTTS = (): TTSContextType => {
  const context = useContext(TTSContext);
  // Guard against missing provider.
  if (!context) throw new Error("useTTS must be used within a TTSProvider");
  return context;
};
