/**
 * SDLC Tasks Route
 * Shows all tasks across stories and epics
 * Epic 2 Implementation - Placeholder (no tasks content in old implementation)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { CheckSquare, Info } from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";

export default function TasksRoute() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CheckSquare className="h-8 w-8" />
            Tasks
          </h1>
          <p className="text-muted-foreground mt-1">
            View all tasks across stories and epics
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Tasks view coming soon. This will provide a unified view of all acceptance criteria
          and implementation tasks across active stories and epics.
        </AlertDescription>
      </Alert>

      {/* Placeholder Card */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Tasks View Coming Soon
          </CardTitle>
          <CardDescription>
            Planned features for the Tasks view
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-2">What will be included:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All acceptance criteria from active stories</li>
              <li>Implementation tasks with status tracking</li>
              <li>Task dependencies and blockers</li>
              <li>Assignee and priority information</li>
              <li>Filtering by epic, story, or status</li>
              <li>Time tracking and estimates</li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-foreground mb-2">Use case:</p>
            <p>
              The Tasks view will provide a granular, task-level perspective on work across all active stories,
              complementing the Kanban board's story-level view and helping teams track detailed progress.
            </p>
          </div>

          <div className="text-xs pt-2 border-t">
            <p>
              <span className="font-semibold">Note:</span> Currently, tasks can be viewed within individual
              stories on the Kanban board. This dedicated view will aggregate all tasks for easier tracking
              and filtering.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
