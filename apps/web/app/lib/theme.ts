import { createCookieSessionStorage } from "react-router";

export type Theme = "light" | "dark";

const themeStorage = createCookieSessionStorage({
  cookie: {
    name: "theme",
    secure: process.env.NODE_ENV === "production",
    secrets: [process.env.SESSION_SECRET || "default-secret"],
    sameSite: "lax",
    path: "/",
    httpOnly: true,
  },
});

export async function getTheme(request: Request): Promise<Theme> {
  const session = await themeStorage.getSession(request.headers.get("Cookie"));
  const theme = session.get("theme");
  return theme === "dark" ? "dark" : "light";
}

export async function setTheme(theme: Theme) {
  const session = await themeStorage.getSession();
  session.set("theme", theme);
  return themeStorage.commitSession(session);
}
