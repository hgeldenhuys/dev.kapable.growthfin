/**
 * Claude Observability Overview
 * Landing page for Claude observability features
 */

import { Activity, Webhook, MessageSquare, Cpu } from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export default function ClaudeOverview() {
  const quickLinks = [
    {
      title: "Hook Events",
      description: "View all hook events from Claude Code sessions",
      icon: <Webhook className="h-8 w-8" />,
      href: "/claude/hooks",
      color: "text-blue-500",
    },
    {
      title: "Chat Messages",
      description: "Browse conversation history and chat interactions",
      icon: <MessageSquare className="h-8 w-8" />,
      href: "/claude/chat",
      color: "text-green-500",
    },
    {
      title: "Sessions",
      description: "Track Claude Code sessions and activity",
      icon: <Activity className="h-8 w-8" />,
      href: "/claude/sessions",
      color: "text-purple-500",
    },
    {
      title: "Agents",
      description: "Monitor agent types and their behavior",
      icon: <Cpu className="h-8 w-8" />,
      href: "/claude/agents",
      color: "text-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Claude Observability</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and analyze Claude Code activity, hook events, and agent behavior
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((link) => (
          <Link key={link.href} to={link.href} className="block">
            <Card className="transition-all hover:shadow-md hover:border-primary/50">
              <CardHeader>
                <div className={`${link.color} mb-2`}>{link.icon}</div>
                <CardTitle className="text-lg">{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About This Section</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This is a dedicated observability interface for Claude Code. Unlike the main dashboard,
            this section focuses purely on event tracking and analysis without workspace or project
            context filtering. Use this interface to monitor real-time hook events, analyze chat
            patterns, and track agent behavior across all your Claude Code sessions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
