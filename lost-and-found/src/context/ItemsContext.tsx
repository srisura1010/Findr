"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSettings } from "@/context/SettingsContext";

export interface Item {
  id: number;
  name: string;
  description: string;
  image: string;
  authorName: string;
  authorAvatar?: string;
  status: string;
  authorId: string;
  authorEmail: string;
  claimerEmail?: string;
  aiKeywords?: string;
}

export interface LostItem {
  id: number;
  name: string;
  description: string;
  image: string;
  authorName: string;
  authorAvatar?: string;
  authorId: string;
  authorEmail: string;
  status: string;
  created_at: string;
}

interface RawItem extends Omit<Item, "name" | "description"> {
  name: string;
  description: string;
}

interface ItemsContextType {
  items: Item[];
  lostItems: LostItem[];
  addItem: (item: Item) => void;
  addLostItem: (item: LostItem) => void;
  updateItemStatus: (id: number, newStatus: string, claimerEmail?: string) => void;
  removeLostItem: (id: number) => void;
}

const ItemsContext = createContext<ItemsContextType | undefined>(undefined);

async function translateText(text: string, target: string): Promise<string> {
  const cacheKey = `item_text_${target}_${btoa(encodeURIComponent(text)).slice(0, 40)}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target })
    });
    if (res.ok) {
      const data = await res.json();
      const translated = data.translatedText || text;
      localStorage.setItem(cacheKey, translated);
      return translated;
    }
  } catch {

  }
  return text;
}

async function translateItems(rawItems: RawItem[], language: string): Promise<Item[]> {
  if (language === "en") return rawItems;
  return Promise.all(
    rawItems.map(async (item) => {
      const [name, description] = await Promise.all([
      translateText(item.name, language),
      translateText(item.description, language)]
      );
      return { ...item, name, description };
    })
  );
}

export const ItemsProvider = ({ children }: {children: ReactNode;}) => {
  const [rawItems, setRawItems] = useState<RawItem[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const { language } = useSettings();

  useEffect(() => {
    const fetchItems = async () => {
      const { data, error } = await supabase.
      from("items").
      select("*").
      order("id", { ascending: false });
      if (error) {console.error("Failed to fetch items:", error.message);return;}
      const formatted: RawItem[] = data.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        image: item.image_url,
        authorName: item.author_name,
        authorAvatar: item.author_avatar,
        status: item.status,
        authorId: item.author_id,
        authorEmail: item.author_email,
        claimerEmail: item.claimer_email,
        aiKeywords: item.ai_keywords || ""
      }));
      setRawItems(formatted);
    };
    fetchItems();
  }, []);

  useEffect(() => {
    const fetchLostItems = async () => {
      const { data, error } = await supabase.
      from("lost_items").
      select("*").
      eq("status", "looking").
      order("id", { ascending: false });
      if (error) {console.error("Failed to fetch lost items:", error.message);return;}
      const formatted: LostItem[] = data.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        image: item.image_url || "",
        authorName: item.author_name,
        authorAvatar: item.author_avatar,
        authorId: item.author_id,
        authorEmail: item.author_email,
        status: item.status,
        created_at: item.created_at
      }));
      setLostItems(formatted);
    };
    fetchLostItems();
  }, []);


  useEffect(() => {
    const channel = supabase.
    channel("items-realtime").
    on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "items" },
      (payload) => {
        const updated = payload.new;
        setRawItems((prev) =>
        prev.map((item) =>
        item.id === updated.id ?
        {
          ...item,
          status: updated.status,
          claimerEmail: updated.claimer_email
        } :
        item
        )
        );
      }
    ).
    on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "items" },
      (payload) => {
        setRawItems((prev) => prev.filter((item) => item.id !== payload.old.id));
      }
    ).
    subscribe();

    return () => {supabase.removeChannel(channel);};
  }, []);

  useEffect(() => {
    if (rawItems.length === 0) return;
    translateItems(rawItems, language).then(setItems);
  }, [rawItems, language]);

  const addItem = (item: Item) => {
    setRawItems((prev) => [item, ...prev]);
  };

  const addLostItem = (item: LostItem) => {
    setLostItems((prev) => [item, ...prev]);
  };

  const removeLostItem = (id: number) => {
    setLostItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemStatus = (id: number, newStatus: string, claimerEmail?: string) => {
    setRawItems((prev) =>
    prev.map((item) =>
    item.id === id ?
    { ...item, status: newStatus, claimerEmail: claimerEmail || item.claimerEmail } :
    item
    )
    );
    setItems((prev) =>
    prev.map((item) =>
    item.id === id ?
    { ...item, status: newStatus, claimerEmail: claimerEmail || item.claimerEmail } :
    item
    )
    );
  };

  return (
    <ItemsContext.Provider value={{ items, lostItems, addItem, addLostItem, updateItemStatus, removeLostItem }}>
      {children}
    </ItemsContext.Provider>);

};

export const useItems = () => {
  const context = useContext(ItemsContext);
  if (!context) throw new Error("useItems must be used inside ItemsProvider");
  return context;
};
