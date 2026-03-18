/**
 * Summaries Dashboard Default Route
 * Redirects to the contextual summaries page with "all" context
 */
import { redirect } from "react-router";

export function loader() {
  // Redirect to the contextual route with "_" (all) for both project and agent
  return redirect("/dashboard/project/_/agent/_/summaries");
}