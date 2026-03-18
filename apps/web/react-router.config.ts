import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  // Prerendering disabled - "/" redirects cause build failures
  // async prerender() {
  //   return ["/"];
  // },
} satisfies Config;
