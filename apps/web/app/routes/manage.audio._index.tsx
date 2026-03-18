/**
 * Audio Narration Management Page
 * Manage TTS voices and global voice settings
 */

import React, { useState, useEffect } from 'react';
import { Mic, Speaker, RotateCw } from 'lucide-react';
import { useLoaderData, type LoaderFunction } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { FormattedDate } from '../components/FormattedDate';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import type { Voice, GlobalVoiceSettings, Model } from '../types/voices';
import { AudioPreviewButton } from '../components/audio/AudioPreviewButton';

const API_URL = (typeof process !== 'undefined' && process.env?.['API_URL']) || 'http://localhost:3000';

export const loader: LoaderFunction = async () => {
  try {
    const [voicesRes, settingsRes, modelsRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/voices`),
      fetch(`${API_URL}/api/v1/voice-settings`),
      fetch(`${API_URL}/api/v1/models`),
    ]);

    const voicesData = voicesRes.ok ? await voicesRes.json() : { voices: [] };
    const settingsData = settingsRes.ok ? await settingsRes.json() : { settings: null };
    const modelsData = modelsRes.ok ? await modelsRes.json() : { models: [] };

    return {
      voices: Array.isArray(voicesData.voices) ? voicesData.voices : [],
      globalSettings: settingsData.settings || null,
      models: Array.isArray(modelsData.models) ? modelsData.models : [],
    };
  } catch (error) {
    console.error('Error loading audio data:', error);
    return { voices: [], globalSettings: null, models: [] };
  }
};

export default function AudioManagementPage() {
  const { voices: initialVoices, globalSettings: initialSettings, models: initialModels } = useLoaderData<{
    voices: Voice[];
    globalSettings: GlobalVoiceSettings | null;
    models: Model[];
  }>();

  const [voices, setVoices] = useState<Voice[]>(initialVoices);
  const [models, setModels] = useState<Model[]>(initialModels);
  const [globalSettings, setGlobalSettings] = useState<GlobalVoiceSettings | null>(initialSettings);
  const [syncLoading, setSyncLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsFormData, setSettingsFormData] = useState({
    userVoiceId: initialSettings?.userVoiceId || '',
    assistantVoiceId: initialSettings?.assistantVoiceId || '',
    modelId: initialSettings?.modelId || '',
  });

  // Sync form data when loader data changes (e.g., after page reload)
  useEffect(() => {
    if (initialSettings) {
      setSettingsFormData({
        userVoiceId: initialSettings.userVoiceId || '',
        assistantVoiceId: initialSettings.assistantVoiceId || '',
        modelId: initialSettings.modelId || '',
      });
    }
  }, [initialSettings]);

  const fetchVoices = async () => {
    try {
      const response = await fetch(`/api/v1/voices`);
      if (response.ok) {
        const data = await response.json();
        setVoices(Array.isArray(data.voices) ? data.voices : []);
      }
    } catch (error) {
      console.error('Failed to fetch voices:', error);
    }
  };

  const fetchGlobalSettings = async () => {
    try {
      const response = await fetch(`/api/v1/voice-settings`);
      if (response.ok) {
        const data = await response.json();
        setGlobalSettings(data.settings || null);
        setSettingsFormData({
          userVoiceId: data.settings?.userVoiceId || '',
          assistantVoiceId: data.settings?.assistantVoiceId || '',
          modelId: data.settings?.modelId || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await fetch(`/api/v1/models`);
      if (response.ok) {
        const data = await response.json();
        setModels(Array.isArray(data.models) ? data.models : []);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      // Backend will use ELEVENLABS_API_KEY from environment
      const response = await fetch(`/api/v1/voices/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'elevenlabs',
          syncEntities: ['voices', 'models', 'dictionaries', 'usage'],
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Build toast description
        const syncResults = [];
        if (data.voices?.synced) syncResults.push(`${data.voices.count} voices`);
        if (data.models?.synced) syncResults.push(`${data.models.count} models`);
        if (data.dictionaries?.synced) syncResults.push(`${data.dictionaries.count} dictionaries`);

        let description = `Synced: ${syncResults.join(', ')}`;
        if (data.usage) {
          description += `. Usage: ${data.usage.charactersUsed}/${data.usage.characterLimit} characters`;
        }

        toast.success('Sync Successful');

        // Refresh voices and models
        await Promise.all([fetchVoices(), fetchModels()]);
      } else {
        const error = await response.json();
        toast.error('Sync Failed', { description: error.error || 'Failed to sync' });
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Sync Error', { description: 'An error occurred while syncing' });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleToggleSummary = async (voiceId: string, voiceName: string, currentValue: boolean) => {
    try {
      const response = await fetch(`/api/v1/voices/${voiceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ useForSummaries: !currentValue }),
      });

      if (response.ok) {
        toast.success('Voice Updated', { description: `${voiceName} summary flag ${!currentValue ? 'enabled' : 'disabled'}` });
        await fetchVoices();
      } else {
        const error = await response.json();
        toast.error('Update Failed', { description: error.error || 'Failed to update voice' });
      }
    } catch (error) {
      console.error('Error updating voice:', error);
      toast.error('Update Error', { description: 'An error occurred while updating the voice' });
    }
  };

  const handleSettingsSave = async () => {
    setSettingsSaving(true);
    try {
      // Validation
      if (!settingsFormData.userVoiceId || !settingsFormData.assistantVoiceId || !settingsFormData.modelId) {
        toast.error('Validation Error', { description: 'User voice, assistant voice, and model must all be selected' });
        setSettingsSaving(false);
        return;
      }

      const response = await fetch(`/api/v1/voice-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsFormData),
      });

      if (response.ok) {
        const data = await response.json();
        setGlobalSettings(data.settings || null);
        toast.success('Settings Saved', { description: 'Global voice settings have been updated' });
      } else {
        const error = await response.json();
        toast.error('Save Failed', { description: error.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Save Error', { description: 'An error occurred while saving settings' });
    } finally {
      setSettingsSaving(false);
    }
  };

  // Stats calculations
  const totalVoices = voices.length;
  const maleVoices = voices.filter((v) => v.gender === 'male').length;
  const femaleVoices = voices.filter((v) => v.gender === 'female').length;
  const summaryReadyVoices = voices.filter((v) => v.useForSummaries).length;

  // Filter voices for summary use
  const summaryVoices = voices.filter((v) => v.useForSummaries);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Audio Narration Management</h1>
          <p className="text-muted-foreground">
            Manage TTS voices and configure default voice settings
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncLoading}>
          <RotateCw className={`mr-2 h-4 w-4 ${syncLoading ? 'animate-spin' : ''}`} />
          {syncLoading ? 'Syncing...' : 'Sync'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Voices</CardTitle>
            <Mic className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVoices}</div>
            <p className="text-xs text-muted-foreground">Available voices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Male Voices</CardTitle>
            <Mic className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{maleVoices}</div>
            <p className="text-xs text-muted-foreground">Male speakers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Female Voices</CardTitle>
            <Mic className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{femaleVoices}</div>
            <p className="text-xs text-muted-foreground">Female speakers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Summary-Ready</CardTitle>
            <Speaker className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryReadyVoices}</div>
            <p className="text-xs text-muted-foreground">Enabled for summaries</p>
          </CardContent>
        </Card>
      </div>

      {/* Voices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Voices</CardTitle>
        </CardHeader>
        <CardContent>
          {voices.length === 0 ? (
            <div className="text-center py-8">
              <Mic className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No voices available</p>
              <Button onClick={handleSync} disabled={syncLoading}>
                <RotateCw className="mr-2 h-4 w-4" />
                Sync from ElevenLabs
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Summary Ready</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {voices.map((voice) => (
                  <TableRow key={voice.id}>
                    <TableCell className="font-medium">
                      <AudioPreviewButton
                        voiceName={voice.name}
                        previewUrl={voice.metadata?.previewUrl}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {voice.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{voice.gender}</TableCell>
                    <TableCell>
                      <Switch
                        checked={voice.useForSummaries}
                        onCheckedChange={() => handleToggleSummary(voice.id, voice.name, voice.useForSummaries)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <FormattedDate date={voice.createdAt} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Global Voice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Speaker className="h-5 w-5" />
            Global Voice Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="userVoice">Default User Voice</Label>
              <Select
                value={settingsFormData.userVoiceId}
                onValueChange={(value) =>
                  setSettingsFormData({ ...settingsFormData, userVoiceId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user voice" />
                </SelectTrigger>
                <SelectContent>
                  {summaryVoices.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No voices available for summaries
                    </SelectItem>
                  ) : (
                    summaryVoices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name} ({voice.gender})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Voice to use for user messages in audio narration
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assistantVoice">Default Assistant Voice</Label>
              <Select
                value={settingsFormData.assistantVoiceId}
                onValueChange={(value) =>
                  setSettingsFormData({ ...settingsFormData, assistantVoiceId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assistant voice" />
                </SelectTrigger>
                <SelectContent>
                  {summaryVoices.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No voices available for summaries
                    </SelectItem>
                  ) : (
                    summaryVoices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name} ({voice.gender})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Voice to use for assistant messages in audio narration
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="model">Default TTS Model</Label>
              <Select
                value={settingsFormData.modelId}
                onValueChange={(value) =>
                  setSettingsFormData({ ...settingsFormData, modelId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select TTS model" />
                </SelectTrigger>
                <SelectContent>
                  {models.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No models available - click Sync
                    </SelectItem>
                  ) : (
                    models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}{model.description ? ` - ${model.description}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Model to use for audio generation
              </p>
            </div>

            <Button
              onClick={handleSettingsSave}
              disabled={
                settingsSaving ||
                !settingsFormData.userVoiceId ||
                !settingsFormData.assistantVoiceId ||
                !settingsFormData.modelId
              }
              className="w-full"
            >
              {settingsSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
