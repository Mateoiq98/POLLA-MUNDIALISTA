export const ALLOWED_USERS = [
  "Mateo Agudelo",
  "Tatiana Tobar",
  "Juan Esteban",
  "Miguel Andres",
  "Mauricio",
  "Celene",
  "Michael",
  "Daniel",
] as const;

export const MAX_USERS = ALLOWED_USERS.length;

export function isAllowedUser(name: string): boolean {
  return getCanonicalName(name) !== null;
}

export function getCanonicalName(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  const match = ALLOWED_USERS.find((allowed) => {
    const a = allowed.toLowerCase();
    return a === normalized || a.split(" ")[0] === normalized;
  });

  return match ?? null;
}
