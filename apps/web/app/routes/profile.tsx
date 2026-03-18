/**
 * Profile Page - User Profile Management
 *
 * US-PROFILE-003: Profile Route with Loader
 * US-PROFILE-004: Profile View Component
 * US-PROFILE-005: Profile Edit Form
 */

import { useState } from "react";
import { redirect } from "react-router";
import type { Route } from "./+types/profile";
import { getSession } from "~/lib/auth";
import { getTheme } from "~/lib/theme";
import { AppShell } from "~/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from 'sonner';
import { Edit2, Mail, User, Calendar, ShieldCheck, X, Save } from "lucide-react";

const API_URL = (typeof process !== 'undefined' && process.env?.['API_URL']) || 'http://localhost:3000';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export async function loader({ request }: Route.LoaderArgs) {
  const theme = await getTheme(request);

  // Get authenticated user from session
  const session = await getSession(request);

  // Redirect to sign-in if not authenticated
  if (!session) {
    return redirect("/auth/sign-in");
  }

  // Fetch user profile from API
  try {
    const cookie = request.headers.get("cookie");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (cookie) {
      headers["cookie"] = cookie;
    }

    const response = await fetch(`${API_URL}/api/v1/users/${session.user.id}`, {
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      console.error("Failed to fetch user profile:", response.statusText);
      throw new Error(`Failed to fetch profile: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      user: data.user as UserProfile,
      theme,
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    // Return session data as fallback
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name || null,
        emailVerified: false,
        createdAt: new Date().toISOString(),
      } as UserProfile,
      theme,
    };
  }
}

export default function ProfilePage({ loaderData }: Route.ComponentProps) {
  const { user: initialUser, theme } = loaderData;
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(initialUser);

  // Form state for editing
  const [formData, setFormData] = useState({
    name: user.name || "",
    email: user.email,
  });
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    email?: string;
  }>({});

  // Simple navigation for profile page (no workspace context)
  const navigation = [
    { to: "/dashboard", label: "Dashboard", icon: <User className="h-4 w-4" /> },
  ];

  const handleEdit = () => {
    setFormData({
      name: user.name || "",
      email: user.email,
    });
    setFormErrors({});
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormErrors({});
    setFormData({
      name: user.name || "",
      email: user.email,
    });
  };

  const validateForm = () => {
    const errors: { name?: string; email?: string } = {};

    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Validation Error', { description: 'Please fix the errors in the form' });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update profile");
      }

      const data = await response.json();

      // Update local state with new data
      setUser(data.user);
      setIsEditing(false);

      toast.success('Profile Updated', { description: 'Your profile has been updated successfully' });
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error('Update Failed', { description: error instanceof Error ? error.message : "Failed to update profile" });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <AppShell
      theme={theme}
      brandName="ACME CORP"
      pageTitle="Profile"
      leftNav={navigation}
      user={{
        id: user.id,
        email: user.email,
        name: user.name || undefined,
      }}
      showSearch={false}
    >
      <div className="container mx-auto p-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Profile</CardTitle>
                <CardDescription>
                  Manage your account information
                </CardDescription>
              </div>
              {!isEditing && (
                <Button onClick={handleEdit} variant="outline" size="sm">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              /* Edit Mode */
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                  {formErrors.name && (
                    <p className="text-sm text-destructive">{formErrors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                  {formErrors.email && (
                    <p className="text-sm text-destructive">{formErrors.email}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isLoading} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              /* View Mode */
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Name</Label>
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{user.name || "Not set"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{user.email}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Email Verification</Label>
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {user.emailVerified ? "Verified" : "Not Verified"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Account Created</Label>
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{formatDate(user.createdAt)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
