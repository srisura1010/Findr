"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { useSettings } from "@/context/SettingsContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Item {
  id: number;
  name: string;
  description: string;
  image: string;
  images: string[];
  authorName: string;
  authorAvatar?: string;
  status: string;
  authorId: string;
  authorEmail: string;
  claimerEmail?: string;
  aiKeywords?: string;
  school_id?: string | null;
  date_found?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
}

export interface LostItem {
  id: number;
  name: string;
  description: string;
  image: string;
  images: string[];
  authorName: string;
  authorAvatar?: string;
  authorId: string;
  authorEmail: string;
  status: string;
  created_at: string;
  date_found?: string | null;
  school_id?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string;
}

//coerces image_url or image_urls (array or JSON string) to a clean string array
function normalizeImages(imageData: any): string[] {
  if (Array.isArray(imageData))
    return imageData.filter((url) => url && typeof url === "string");
  if (typeof imageData === "string" && imageData) return [imageData];
  return [];
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
  updateItemStatus: (
    id: number,
    newStatus: string,
    claimerEmail?: string,
  ) => void;
  removeLostItem: (id: number) => void;
  removeItem: (id: number) => void;
  // schoolId is set externally by SchoolContext integration in the provider wrapper
  setActiveSchoolId: (id: string | null) => void;
}

const ItemsContext = createContext<ItemsContextType | undefined>(undefined);

// ─── Translation helpers ───────────────────────────────────────────────────────

//translates a single string with localStorage caching to avoid repeat API calls
async function translateText(text: string, target: string): Promise<string> {
  const cacheKey = `item_text_${target}_${btoa(encodeURIComponent(text)).slice(0, 40)}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target }),
    });
    if (res.ok) {
      const data = await res.json();
      const translated = data.translatedText || text;
      localStorage.setItem(cacheKey, translated);
      return translated;
    }
  } catch {}
  return text;
}

//translates name and description on all items in parallel
async function translateItems(
  rawItems: RawItem[],
  language: string,
): Promise<Item[]> {
  if (language === "en") return rawItems;
  return Promise.all(
    rawItems.map(async (item) => {
      const [name, description] = await Promise.all([
        translateText(item.name, language),
        translateText(item.description, language),
      ]);
      return { ...item, name, description };
    }),
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

//provides found items, lost items, and mutation helpers to the entire app
export const ItemsProvider = ({ children }: { children: ReactNode }) => {
  const [rawItems, setRawItems] = useState<RawItem[]>([]); //untranslated found items from supabase
  const [items, setItems] = useState<Item[]>([]); //translated found items shown to users
  const [lostItems, setLostItems] = useState<LostItem[]>([]); //items users have reported as lost
  const { language } = useSettings();

  // schoolId drives which subset of items we fetch.
  // null = global (no school filter).
  // This is set by the SchoolBanner / dashboard once SchoolContext resolves.
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);

  // ── Fetch found items ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchItems = async () => {
      let query = supabase
        .from("items")
        .select("*")
        .neq("status", "returned")
        .order("id", { ascending: false });

      // If user is in a school, only show that school's items.
      // If not in a school, show items with no school (global items).
      if (activeSchoolId) {
        query = query.eq("school_id", activeSchoolId);
      } else {
        query = query.is("school_id", null);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Failed to fetch items:", error.message);
        return;
      }

      const formatted: RawItem[] = data.map((item) => {
        const imageArray = normalizeImages(item.image_urls || item.image_url);
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          image: imageArray[0] || "",
          images: imageArray,
          authorName: item.author_name,
          authorAvatar: item.author_avatar,
          status: item.status,
          authorId: item.author_id,
          authorEmail: item.author_email,
          claimerEmail: item.claimer_email,
          aiKeywords: item.ai_keywords || "",
          date_found: item.date_found ?? null,
          location: item.location ?? null,
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          school_id: item.school_id ?? null,
          category: item.category ?? null,
        };
      });
      setRawItems(formatted);
    };
    fetchItems();
  }, [activeSchoolId]);

  // ── Fetch lost items ───────────────────────────────────────────────────────
  useEffect(() => {
    const fetchLostItems = async () => {
      let query = supabase
        .from("lost_items")
        .select("*")
        .eq("status", "looking")
        .order("id", { ascending: false });

      if (activeSchoolId) {
        query = query.eq("school_id", activeSchoolId);
      } else {
        query = query.is("school_id", null);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Failed to fetch lost items:", error.message);
        return;
      }

      const formatted: LostItem[] = data.map((item) => {
        const imageArray = normalizeImages(item.image_urls || item.image_url);
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          image: imageArray[0] || "",
          images: imageArray,
          authorName: item.author_name,
          authorAvatar: item.author_avatar,
          authorId: item.author_id,
          authorEmail: item.author_email,
          status: item.status,
          created_at: item.created_at,
          date_found: item.created_at ?? null,
          school_id: item.school_id ?? null,
          location: item.location ?? null,
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          category: item.category ?? null,
        };
      });
      setLostItems(formatted);
    };
    fetchLostItems();
  }, [activeSchoolId]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("items-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "items" },
        (payload) => {
          const updated = payload.new;
          setRawItems((prev) =>
            prev.map((item) =>
              item.id === updated.id
                ? {
                    ...item,
                    status: updated.status,
                    claimerEmail: updated.claimer_email,
                  }
                : item,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "items" },
        (payload) => {
          setRawItems((prev) =>
            prev.filter((item) => item.id !== payload.old.id),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Translate on language or rawItems change ───────────────────────────────
  useEffect(() => {
    if (rawItems.length === 0) {
      setItems([]);
      return;
    }
    translateItems(rawItems, language).then(setItems);
  }, [rawItems, language]);

  // ── Public mutations ───────────────────────────────────────────────────────

  //optimistically prepends a new found item to the local list
  const addItem = (item: Item) => {
    setRawItems((prev) => [item, ...prev]);
  };

  //optimistically prepends a new lost item to the local list
  const addLostItem = (item: LostItem) => {
    setLostItems((prev) => [item, ...prev]);
  };

  //removes a lost item from local state (e.g. after it has been found)
  const removeLostItem = (id: number) => {
    setLostItems((prev) => prev.filter((item) => item.id !== id));
  };

  //removes a found item from both raw and translated lists
  const removeItem = (id: number) => {
    setRawItems((prev) => prev.filter((item) => item.id !== id));
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  //updates the status and optional claimer email on a found item in both lists
  const updateItemStatus = (
    id: number,
    newStatus: string,
    claimerEmail?: string,
  ) => {
    setRawItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: newStatus,
              claimerEmail: claimerEmail || item.claimerEmail,
            }
          : item,
      ),
    );
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: newStatus,
              claimerEmail: claimerEmail || item.claimerEmail,
            }
          : item,
      ),
    );
  };

  return (
    <ItemsContext.Provider
      value={{
        items,
        lostItems,
        addItem,
        addLostItem,
        updateItemStatus,
        removeLostItem,
        removeItem,
        setActiveSchoolId,
      }}
    >
      {children}
    </ItemsContext.Provider>
  );
};

//hook to access items context from any component inside ItemsProvider
export const useItems = () => {
  const ctx = useContext(ItemsContext);
  if (!ctx) throw new Error("useItems must be used inside ItemsProvider");
  return ctx;
};
