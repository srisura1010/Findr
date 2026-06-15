export function getConversationId(
  item: { id: string; title: string },
  currentUser: { uid: string; displayName: string },
  otherUser: { uid: string; displayName: string },
): string {
  const participants = [currentUser.uid, otherUser.uid].sort();
  return `conv_${participants.join("_")}`;
}

export function getSchoolAdminConversationId(
  schoolId: string,
  userId: string,
  adminUserId: string,
): string {
  return `school_${schoolId}_${[userId, adminUserId].sort().join("_")}`;
}

export function isSchoolAdminConversation(conversationId: string): boolean {
  return conversationId.startsWith("school_");
}

// Clerk IDs start with "user_", UUIDs use hyphens — split on "_user_" is safe
export function schoolIdFromConversationId(conversationId: string): string {
  return conversationId.replace(/^school_/, "").split("_user_")[0];
}
