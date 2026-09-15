const avatarPaths = [
  "/avatars/avatar-1.svg",
  "/avatars/avatar-2.svg",
  "/avatars/avatar-3.svg",
  "/avatars/avatar-4.svg",
  "/avatars/avatar-5.svg",
  "/avatars/avatar-6.svg",
];

export const getUserAvatar = (identity: string) => {
  if (typeof window === "undefined") return avatarPaths[0];
  const key = `internarea-avatar:${identity.trim().toLowerCase()}`;
  const saved = localStorage.getItem(key);
  if (saved && avatarPaths.includes(saved)) return saved;

  let hash = 0;
  for (const character of identity) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const avatar = avatarPaths[hash % avatarPaths.length];
  localStorage.setItem(key, avatar);
  return avatar;
};
