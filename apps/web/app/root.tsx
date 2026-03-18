import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { Route } from "./+types/root";
import "./globals.css";
import "./styles/docs.css";
import "driver.js/dist/driver.css";
import { getTheme } from "./lib/theme";
import { AudioPlayerProvider } from "./components/audio/AudioPlayerProvider";
import { AudioPlayer } from "./components/audio/AudioPlayer";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      // refetchOnWindowFocus: false,
    },
  },
});

export async function loader({ request }: Route.LoaderArgs) {
  const theme = await getTheme(request);
  return { theme };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "ACME CORP" },
    { name: "description", content: "Claude Code observability platform" },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  // Access loader data through the useLoaderData hook in the Layout
  // This works because Layout is rendered as part of the React Router framework
  const data = useLoaderData<typeof loader>();
  const theme = data?.theme || "light";

  return (
    <html lang="en" className={theme === "dark" ? "dark h-full" : "h-full"}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AudioPlayerProvider>
        <Outlet />
        <AudioPlayer />
      </AudioPlayerProvider>
    </QueryClientProvider>
  );
}
