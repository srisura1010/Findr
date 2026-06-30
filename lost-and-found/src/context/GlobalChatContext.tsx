"use client";

import { createContext, useContext, useState, ReactNode } from "react";

//a single turn in the chatbot conversation
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface GlobalChatContextType {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isOpen: boolean; //whether the chatbot panel is visible
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const GlobalChatContext = createContext<GlobalChatContextType | undefined>(
  undefined,
);

//persists chatbot message history and open state across page navigations
export function GlobalChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]); //conversation history
  const [isOpen, setIsOpen] = useState(false); //panel visibility

  return (
    <GlobalChatContext.Provider
      value={{ messages, setMessages, isOpen, setIsOpen }}
    >
      {children}
    </GlobalChatContext.Provider>
  );
}

//hook to access the global chatbot state from any component
export function useGlobalChat() {
  const ctx = useContext(GlobalChatContext);
  if (!ctx)
    throw new Error("useGlobalChat must be used within GlobalChatProvider");
  return ctx;
}
