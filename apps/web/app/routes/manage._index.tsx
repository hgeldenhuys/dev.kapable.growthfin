/**
 * Management Overview Page
 * User-global management dashboard
 * TWEAK-005: Separated from workspace context
 * Note: Settings moved to workspace-scoped /dashboard/{workspaceId}/settings
 */

import { Key, Cpu } from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";

export default function ManageOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Management</h1>
        <p className="text-muted-foreground mt-2">
          User-global settings and configurations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/manage/credentials">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Key className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>Credentials</CardTitle>
                  <CardDescription>Manage encrypted API keys</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure and manage encrypted API keys for LLM providers (OpenAI, Anthropic, Together AI, etc.)
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/manage/llm-configs">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Cpu className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>LLM Configs</CardTitle>
                  <CardDescription>Configure LLM services</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Set up LLM service configurations with models, prompts, and parameters
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
