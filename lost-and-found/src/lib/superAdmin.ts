export const SUPER_ADMINS = (process.env.NEXT_PUBLIC_SUPER_ADMINS ?? "").
split(",").
map((e) => e.trim()).
filter(Boolean);
