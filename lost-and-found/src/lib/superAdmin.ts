// Comma-separated allowlist of super-admin emails.
 //
 // This is read from an environment variable so super-admins can be changed
 // without code changes. Example:
 // NEXT_PUBLIC_SUPER_ADMINS="a@school.org,b@school.org"
 export const SUPER_ADMINS = (process.env.NEXT_PUBLIC_SUPER_ADMINS ?? "")
 .split(",")
 .map((e) => e.trim())
 .filter(Boolean);
