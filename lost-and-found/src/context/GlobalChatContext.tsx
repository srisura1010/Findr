"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface GlobalChatContextType {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const GlobalChatContext = createContext<GlobalChatContextType | undefined>(
  undefined,
);

export function GlobalChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <GlobalChatContext.Provider
      value={{ messages, setMessages, isOpen, setIsOpen }}
    >
      {children}
    </GlobalChatContext.Provider>
  );
}

export function useGlobalChat() {
  const ctx = useContext(GlobalChatContext);
  if (!ctx)
    throw new Error("useGlobalChat must be used within GlobalChatProvider");
  return ctx;
}
