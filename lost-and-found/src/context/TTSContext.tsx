"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface TTSContextType {
  enabled: boolean;
  setEnabled: (val: boolean) => void;
  rate: number;
  setRate: (val: number) => void;
  announce: (text: string) => void;
  cancelSpeech: () => void;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

export const TTSProvider: React.FC<{children: React.ReactNode;}> = ({
  children
}) => {
  const pathname = usePathname();

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ttsEnabled") === "true";
    }
    return false;
  });

  const [rate, setRateState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return parseFloat(localStorage.getItem("ttsRate") || "1");
    }
    return 1;
  });

  const rateRef = useRef<number>(rate);

  const setRate = (val: number) => {
    setRateState(val);
    rateRef.current = val;
    localStorage.setItem("ttsRate", val.toString());
  };

  const speechRef = useRef<SpeechSynthesis>(
    typeof window !== "undefined" ? window.speechSynthesis : null
  );
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  useEffect(() => {
    localStorage.setItem("ttsEnabled", enabled.toString());
  }, [enabled]);

  const cancelSpeech = () => {
    if (!speechRef.current) return;
    if (speechRef.current.speaking || speechRef.current.pending) {
      speechRef.current.cancel();
    }
    queueRef.current = [];
    speakingRef.current = false;
  };

  const extractText = (node: Node): string => {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const childrenText = Array.from(node.childNodes).
    map((child) => extractText(child)).
    filter(Boolean).
    join(" ");

    return childrenText;
  };

  const speakNext = () => {
    if (!enabled || !speechRef.current || speakingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      speakingRef.current = false;
      return;
    }

    speakingRef.current = true;
    const utterance = new SpeechSynthesisUtterance(
      next.trim().replace(/\s+/g, " ")
    );
    utterance.rate = rateRef.current;
    utterance.pitch = 1;

    utterance.onend = () => {
      speakingRef.current = false;
      speakNext();
    };

    speechRef.current.speak(utterance);
  };

  const announce = (text: string) => {
    if (!text) return;
    queueRef.current.push(text);
    if (!speakingRef.current) speakNext();
  };

  useEffect(() => {
    cancelSpeech();
    if (!enabled) return;

    const containers: HTMLElement[] = [
    document.querySelector("#main-content"),
    document.querySelector("#settings-page"),
    document.querySelector("#messages-container"),
    ...Array.from(document.querySelectorAll(".carousel"))].
    filter(Boolean) as HTMLElement[];

    containers.forEach((container) => {
      let text = "";
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
    if (!enabled) return;

    const containers: HTMLElement[] = [
    document.querySelector("#main-content"),
    document.querySelector("#settings-page"),
    document.querySelector("#messages-container"),
    ...Array.from(document.querySelectorAll(".carousel"))].
    filter(Boolean) as HTMLElement[];

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
      value={{ enabled, setEnabled, rate, setRate, announce, cancelSpeech }}>
      
      {children}
    </TTSContext.Provider>);

};

export const useTTS = (): TTSContextType => {
  const context = useContext(TTSContext);
  if (!context) throw new Error("useTTS must be used within a TTSProvider");
  return context;
};
