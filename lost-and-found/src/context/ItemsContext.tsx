"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSettings } from "@/context/SettingsContext";

// Item types used by the UI.
//
// These are the client-facing shapes after mapping from Supabase row fields.
// (e.g. `image_url` -> `image`, `author_name` -> `authorName`).
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

// Lost item type (separate table) used to represent items that users report
// as missing and are actively looking for.
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

// RawItem represents the stored values fetched from Supabase.
// We keep an untranslated `rawItems` list so we can:
// - apply realtime updates to a stable canonical list
// - re-translate when language changes without re-fetching from the backend
interface RawItem extends Omit<Item, "name" | "description"> {
  name: string;
  description: string;
}

// Public API for the ItemsContext.
//
// `items` is the translated list used by the UI.
// `rawItems` is internal state.
interface ItemsContextType {
  items: Item[];
  lostItems: LostItem[];
  addItem: (item: Item) => void;
  addLostItem: (item: LostItem) => void;
  updateItemStatus: (id: number, newStatus: string, claimerEmail?: string) => void;
  removeLostItem: (id: number) => void;
}

const ItemsContext = createContext<ItemsContextType | undefined>(undefined);

// Translate a string into the target language via the server route.
//
// Translation results are cached in localStorage to reduce API calls and keep
// the UI responsive when the same strings appear repeatedly.
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

// Translate the item list for display in the currently selected language.
// This returns a new list that preserves all non-text fields.
async function translateItems(rawItems: RawItem[], language: string): Promise<Item[]> {
  if (language === "en") return rawItems;
  return Promise.all(
    rawItems.map(async (item) => {
      const [name, description] = await Promise.all([
        translateText(item.name, language),
        translateText(item.description, language)
      ]);
      return { ...item, name, description };
    })
  );
}

export const ItemsProvider = ({ children }: { children: ReactNode; }) => {
  // Raw items fetched from Supabase (untranslated source of truth).
  const [rawItems, setRawItems] = useState<RawItem[]>([]);

  // Display items (translated based on SettingsContext language).
  const [items, setItems] = useState<Item[]>([]);

  // Lost items are not translated currently (can be added similarly if needed).
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const { language } = useSettings();

  useEffect(() => {
    // Initial fetch for found items.
    const fetchItems = async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("id", { ascending: false });
      if (error) { console.error("Failed to fetch items:", error.message); return; }
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
    // Initial fetch for currently-looking lost items.
    const fetchLostItems = async () => {
      const { data, error } = await supabase
        .from("lost_items")
        .select("*")
        .eq("status", "looking")
        .order("id", { ascending: false });
      if (error) { console.error("Failed to fetch lost items:", error.message); return; }
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
    // Realtime updates from Supabase for the `items` table.
    //
    // We only listen for UPDATE + DELETE because INSERTs are added via UI flows
    // (and can be added here later if needed).
    const channel = supabase
      .channel("items-realtime")
      .on(
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
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "items" },
        (payload) => {
          setRawItems((prev) => prev.filter((item) => item.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    // Re-translate whenever the canonical list or the language changes.
    //
    // Note: when `rawItems` is empty we skip to avoid unnecessary work.
    if (rawItems.length === 0) return;
    translateItems(rawItems, language).then(setItems);
  }, [rawItems, language]);

  // Optimistic add for new found items.
  // This updates the canonical list; translation will run in the effect above.
  const addItem = (item: Item) => {
    setRawItems((prev) => [item, ...prev]);
  };

  // Add a lost item to the local list (used after creating a lost item).
  const addLostItem = (item: LostItem) => {
    setLostItems((prev) => [item, ...prev]);
  };

  // Remove a lost item locally (e.g. when resolved or deleted).
  const removeLostItem = (id: number) => {
    setLostItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Update the status locally.
  //
  // This is used as an optimistic UI update; the realtime subscription will also
  // keep the canonical list aligned with the database.
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
    </ItemsContext.Provider>
  );
};

export const useItems = () => {
  const context = useContext(ItemsContext);
  // Guard against missing provider.
  if (!context) throw new Error("useItems must be used inside ItemsProvider");
  return context;
};
