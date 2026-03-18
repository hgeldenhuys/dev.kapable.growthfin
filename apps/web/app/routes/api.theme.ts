/**
 * Theme API Route
 * Handles theme switching via POST requests
 */

import { redirect } from "react-router";
import type { Route } from "./+types/api.theme";
import { setTheme, type Theme } from "../lib/theme";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const theme = formData.get("theme") as Theme;

  if (theme !== "light" && theme !== "dark") {
    return redirect("/dashboard");
  }

  const cookie = await setTheme(theme);

  return redirect(request.headers.get("Referer") || "/dashboard", {
    headers: {
      "Set-Cookie": cookie,
    },
  });
}
