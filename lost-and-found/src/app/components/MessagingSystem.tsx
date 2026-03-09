

import { supabase } from "@/lib/supabaseClient";





export function getConversationId(
item: {id: string;title: string;},
currentUser: {uid: string;displayName: string;},
otherUser: {uid: string;displayName: string;})
: string {
  const participants = [currentUser.uid, otherUser.uid].sort();
  return `${item.id}_${participants.join("_")}`;
}
