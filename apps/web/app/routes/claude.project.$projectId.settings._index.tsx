/**
 * Project Voice Settings Page
 * Configure voice overrides for a specific project
 */

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { ArrowLeft, Save, Volume2, Settings, Play } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { useProjectVoiceSettings, useUpdateProjectVoiceSettings } from '../hooks/useProjectVoiceSettings';
import type { Voice, GlobalVoiceSettings } from '../types/voices';

const API_URL = typeof window !== 'undefined'
  ? (window as any).ENV?.API_URL || 'http://localhost:3000'
  : 'http://localhost:3000';

/**
 * Fetch voices filtered by useForSummaries=true
 */
function useAvailableVoices() {
  return useQuery({
    queryKey: ['voices', { useForSummaries: true }],
    queryFn: async () => {
      const response = await fetch(
        `${API_URL}/api/v1/voices?useForSummaries=true`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch voices');
      }
      const data = await response.json();
      return Array.isArray(data.voices) ? data.voices : [];
    },
    staleTime: 60000,
  });
}

/**
 * Fetch global voice settings for reference
 */
function useGlobalVoiceSettings() {
  return useQuery({
    queryKey: ['global-voice-settings'],
    queryFn: async () => {
      const response = await fetch(
        `${API_URL}/api/v1/voice-settings`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch global settings');
      }
      return response.json();
    },
    staleTime: 60000,
  });
}

export default function ProjectVoiceSettingsPage() {
  const { projectId } = useParams();
  const { data: projectSettings, isLoading: settingsLoading } = useProjectVoiceSettings(projectId || null);
  const { data: globalSettings, isLoading: globalSettingsLoading } = useGlobalVoiceSettings();
  const { data: voices = [], isLoading: voicesLoading } = useAvailableVoices();
  const updateSettings = useUpdateProjectVoiceSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Form state
  const [userVoiceId, setUserVoiceId] = useState<string | null>(null);
  const [assistantVoiceId, setAssistantVoiceId] = useState<string | null>(null);
  const [inheritUserVoice, setInheritUserVoice] = useState(true);
  const [inheritAssistantVoice, setInheritAssistantVoice] = useState(true);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Initialize form when data loads
  useEffect(() => {
    if (projectSettings?.settings) {
      const { userVoiceId: pvUserVoice, assistantVoiceId: pvAssistantVoice } = projectSettings.settings;
      setUserVoiceId(pvUserVoice);
      setAssistantVoiceId(pvAssistantVoice);
      setInheritUserVoice(!pvUserVoice);
      setInheritAssistantVoice(!pvAssistantVoice);
    }
  }, [projectSettings]);

  const isLoading = settingsLoading || globalSettingsLoading || voicesLoading;

  const getVoiceName = (voiceId: string | null): string => {
    if (!voiceId) return 'Not set';
    const voice = voices.find((v) => v.id === voiceId);
    return voice ? `${voice.name}` : 'Unknown';
  };

  const getGlobalVoiceName = (voiceId: string | null): string => {
    if (!voiceId) return 'Not set';
    const voice = voices.find((v) => v.id === voiceId);
    return voice ? `${voice.name}` : 'Unknown';
  };

  const handleUserVoiceChange = (value: string) => {
    if (value === 'inherit') {
      setUserVoiceId(null);
      setInheritUserVoice(true);
    } else {
      setUserVoiceId(value);
      setInheritUserVoice(false);
    }
  };

  const handleAssistantVoiceChange = (value: string) => {
    if (value === 'inherit') {
      setAssistantVoiceId(null);
      setInheritAssistantVoice(true);
    } else {
      setAssistantVoiceId(value);
      setInheritAssistantVoice(false);
    }
  };

  const handlePreviewVoice = (voiceId: string) => {
    const voice = voices.find((v) => v.id === voiceId);
    const previewUrl = voice?.metadata?.previewUrl;

    if (!previewUrl) {
      console.warn('No preview URL for voice:', voiceId);
      return;
    }

    // Stop currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Create new audio element and play
    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    setPlayingVoiceId(voiceId);

    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => {
      console.error('Failed to play preview');
      setPlayingVoiceId(null);
    };

    audio.play();
  };

  const handleSave = async () => {
    if (!projectId) return;

    updateSettings.mutate({
      projectId,
      userVoiceId: inheritUserVoice ? null : userVoiceId,
      assistantVoiceId: inheritAssistantVoice ? null : assistantVoiceId,
    });
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Project ID not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          to="/claude/projects"
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="Back to projects"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Project Voice Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure voice overrides for project {projectId.slice(0, 12)}...
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Global Defaults Reference */}
          {globalSettings && (
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-base">Global Defaults</CardTitle>
                <CardDescription>
                  These are the default voice settings used if not overridden
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Default User Voice
                    </Label>
                    <p className="text-sm font-mono mt-1">
                      {getGlobalVoiceName(globalSettings.settings?.userVoiceId)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Default Assistant Voice
                    </Label>
                    <p className="text-sm font-mono mt-1">
                      {getGlobalVoiceName(globalSettings.settings?.assistantVoiceId)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Settings Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Voice Configuration
              </CardTitle>
              <CardDescription>
                Override global voice settings for this project. Leave unchecked to inherit from global settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* User Voice */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">User Voice</Label>
                  <Badge
                    variant={inheritUserVoice ? 'secondary' : 'default'}
                    className="text-xs"
                  >
                    {inheritUserVoice ? 'Inherited' : 'Override'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inheritUserVoice}
                      onChange={(e) => {
                        setInheritUserVoice(e.target.checked);
                        if (e.target.checked) {
                          setUserVoiceId(null);
                        }
                      }}
                      className="rounded border-input"
                    />
                    <span className="text-sm text-muted-foreground">
                      Inherit from Global Settings
                    </span>
                  </label>
                </div>

                {!inheritUserVoice && (
                  <div className="flex gap-2">
                    <Select value={userVoiceId || ''} onValueChange={handleUserVoiceChange}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] overflow-y-auto">
                        <SelectItem value="inherit">Inherit from Global</SelectItem>
                        {voices.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} ({voice.gender})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {userVoiceId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handlePreviewVoice(userVoiceId)}
                        disabled={playingVoiceId === userVoiceId}
                        title="Preview voice"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}

                {inheritUserVoice && globalSettings?.settings?.userVoiceId && (
                  <p className="text-xs text-muted-foreground">
                    Will use: {getGlobalVoiceName(globalSettings.settings.userVoiceId)}
                  </p>
                )}
              </div>

              {/* Assistant Voice */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Assistant Voice</Label>
                  <Badge
                    variant={inheritAssistantVoice ? 'secondary' : 'default'}
                    className="text-xs"
                  >
                    {inheritAssistantVoice ? 'Inherited' : 'Override'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inheritAssistantVoice}
                      onChange={(e) => {
                        setInheritAssistantVoice(e.target.checked);
                        if (e.target.checked) {
                          setAssistantVoiceId(null);
                        }
                      }}
                      className="rounded border-input"
                    />
                    <span className="text-sm text-muted-foreground">
                      Inherit from Global Settings
                    </span>
                  </label>
                </div>

                {!inheritAssistantVoice && (
                  <div className="flex gap-2">
                    <Select value={assistantVoiceId || ''} onValueChange={handleAssistantVoiceChange}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] overflow-y-auto">
                        <SelectItem value="inherit">Inherit from Global</SelectItem>
                        {voices.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} ({voice.gender})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {assistantVoiceId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handlePreviewVoice(assistantVoiceId)}
                        disabled={playingVoiceId === assistantVoiceId}
                        title="Preview voice"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}

                {inheritAssistantVoice && globalSettings?.settings?.assistantVoiceId && (
                  <p className="text-xs text-muted-foreground">
                    Will use: {getGlobalVoiceName(globalSettings.settings.assistantVoiceId)}
                  </p>
                )}
              </div>

              {/* Save Button */}
              <div className="pt-6 border-t">
                <Button
                  onClick={handleSave}
                  disabled={updateSettings.isPending}
                  className="flex items-center gap-2"
                >
                  {updateSettings.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
