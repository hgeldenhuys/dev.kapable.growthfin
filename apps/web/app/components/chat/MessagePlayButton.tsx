/**
 * MessagePlayButton Component
 *
 * Provides audio generation and playback controls for chat messages.
 * Shows different states: idle (speaker icon), loading (spinner), ready (play icon), error (alert icon).
 * Only renders for assistant and thinking message types.
 *
 * Part of US-AUDIO-001: On-Demand Audio Generation for Chat Messages
 */

import { useState, useEffect } from "react";
import { Speaker, Play, Loader2, AlertCircle, Volume2 } from "lucide-react";
import { Button } from "../ui/button";
import { toast } from 'sonner';
import { useMutation } from "@tanstack/react-query";
import { cn } from "../../lib/utils";
import { useAudioPlayer } from "../audio/AudioPlayerProvider";
import { useAudioSSE } from "../../hooks/useAudioSSE";

interface MessagePlayButtonProps {
	messageId: string;
	messageType: "assistant" | "thinking" | "user" | "system";
	messageContent: string;
	onPlayClick?: (audioUrl: string) => void;
	className?: string;
}

type AudioGenerationState = "idle" | "loading" | "ready" | "error";

interface AudioGenerationResponse {
	status: "ready" | "generating";
	audioUrl?: string;
	jobId?: string;
	estimatedTime?: number;
	error?: string;
	cached?: boolean;
}

export function MessagePlayButton({
	messageId,
	messageType,
	messageContent,
	onPlayClick,
	className,
}: MessagePlayButtonProps) {
	const [state, setState] = useState<AudioGenerationState>("idle");
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const { addToQueue, currentTrack, playbackState, togglePanel, queue } = useAudioPlayer();

	// Check if this message is currently playing
	const isPlaying = currentTrack?.messageId === messageId && playbackState === 'playing';

	// Check if this message is in the queue
	const isInQueue = queue.some(item => item.messageId === messageId);

	// SSE: Listen for audio generation completion (only when loading)
	const { events: audioEvents } = useAudioSSE({
		messageIds: state === "loading" ? [messageId] : [], // Only connect when loading
		enabled: state === "loading", // Only enabled when waiting for generation
	});

	// Only show for assistant and thinking messages
	if (messageType !== "assistant" && messageType !== "thinking") {
		return null;
	}

	// Warn about long messages
	const isLongMessage = messageContent.length > 5000;

	// SSE: Auto-update when audio generation completes
	useEffect(() => {
		const event = audioEvents.find(e => e.messageId === messageId);
		if (event && event.type === 'generation_complete') {
			console.log('[MessagePlayButton] Audio generation complete via SSE:', event);

			// Fix audio URL: backend returns /cdn/audio/... but we need /api/cdn/audio/... for React Router proxy
			const proxyAudioUrl = event.audioUrl.startsWith('/cdn/')
				? `/api${event.audioUrl}`
				: event.audioUrl;

			setState("ready");
			setAudioUrl(proxyAudioUrl);

			// Auto-add to queue
			const messagePreview = messageContent.slice(0, 100) + (messageContent.length > 100 ? '...' : '');
			addToQueue({
				messageId,
				messagePreview,
				audioUrl: proxyAudioUrl,
			});

			// Open player panel
			togglePanel();

			toast.success('Audio ready', { description: 'Audio generated and added to queue' });
		}
	}, [audioEvents, messageId, messageContent, addToQueue, togglePanel]);

	// Reset button state when this message finishes playing
	useEffect(() => {
		// If we were ready/playing and now the message is no longer playing or in queue, reset to idle
		if (state === "ready" && !isPlaying && !isInQueue && audioUrl) {
			// Message finished playing and is not in queue anymore
			// Keep the ready state so user can replay
			// State stays as "ready" - user can click to queue again
		}
	}, [isPlaying, isInQueue, state, audioUrl]);

	// API mutation for audio generation
	const generateAudioMutation = useMutation({
		mutationFn: async (): Promise<AudioGenerationResponse> => {
			// Set loading state when mutation actually starts
			setState("loading");

			const url = `/api/v1/audio/messages/${messageId}/generate`;

			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					messageId,
					content: messageContent,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error("Audio generation API error:", errorData);
				throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			return data;
		},
		onSuccess: (data) => {
			if (data.status === "ready" && data.audioUrl) {
				// Audio already exists - ready to play
				// Fix audio URL: backend returns /cdn/audio/... but we need /api/cdn/audio/... for React Router proxy
				const proxyAudioUrl = data.audioUrl.startsWith('/cdn/')
					? `/api${data.audioUrl}`
					: data.audioUrl;

				setState("ready");
				setAudioUrl(proxyAudioUrl);

				// Add to queue ONLY on first generation (when button was in idle state)
				// Don't add here - let the click handler manage queueing
				const messagePreview = messageContent.slice(0, 100) + (messageContent.length > 100 ? '...' : '');
				addToQueue({
					messageId,
					messagePreview,
					audioUrl: proxyAudioUrl,
				});

				// Open player panel
				togglePanel();

				toast.success('Audio ready', { description: 'Click the Play button in the audio player to start' });
			} else if (data.status === "generating") {
				// Audio is being generated - keep loading state and wait for SSE
				// SSE will auto-update to "ready" when generation completes
				setState("loading");
				const estimatedSeconds = data.estimatedTime ? Math.ceil(data.estimatedTime / 1000) : 5;
				toast.success('Audio generation started', { description: `Generating audio... Estimated time: ${estimatedSeconds}s. You'll be notified when ready.`, duration: 5000 });
			}
		},
		onError: (error: Error) => {
			setState("error");
			toast.error('Audio generation failed', { description: error.message });
		},
	});

	const handleClick = () => {
		if (isPlaying) {
			// If playing, open the player panel
			togglePanel();
			return;
		}

		if (state === "error") {
			// Retry on error
			setState("idle");
			setAudioUrl(null);
			return; // Exit early, let user click again
		}

		if (state === "ready" && audioUrl) {
			// When button is already in ready state and user clicks:
			// Check if we need to re-queue (when audio finished playing)
			if (!isInQueue && !isPlaying) {
				// User wants to replay - re-add to queue
				const messagePreview = messageContent.slice(0, 100) + (messageContent.length > 100 ? '...' : '');
				addToQueue({
					messageId,
					messagePreview,
					audioUrl,
				});

				toast.success('Added to queue', { description: 'Message re-added to playback queue' });
			} else if (isInQueue || isPlaying) {
				// Already queued or playing, just notify user
				toast.success('Already in queue', { description: isPlaying ? "This message is currently playing" : "This message is already in the playback queue" });
			}

			// Always open panel when clicking ready button
			togglePanel();

			// Call optional callback (currently just logs, doesn't add to queue)
			if (onPlayClick) {
				onPlayClick(audioUrl);
			}
		} else if (state === "idle" && !generateAudioMutation.isPending) {
			// Start generation - only if not already pending
			if (isLongMessage) {
				// Warn about long messages
				toast.success('Long message detected', { description: `This message is ${messageContent.length} characters. Generation may take longer.` });
			}
			// DON'T set state to loading here - let the mutation handle it
			generateAudioMutation.mutate();
		}
	};

	// Render appropriate icon based on state
	const renderIcon = () => {
		if (isPlaying) {
			return <Volume2 className="h-4 w-4 animate-pulse" />;
		}

		// Show loading spinner if mutation is pending OR state is loading
		if (state === "loading" || generateAudioMutation.isPending) {
			return <Loader2 className="h-4 w-4 animate-spin" />;
		}

		switch (state) {
			case "ready":
				return <Play className="h-4 w-4" />;
			case "error":
				return <AlertCircle className="h-4 w-4" />;
			case "idle":
			default:
				return <Speaker className="h-4 w-4" />;
		}
	};

	// Button variant based on state
	const getButtonVariant = () => {
		if (isPlaying) return "default";
		if (state === "error") return "destructive";
		if (state === "ready") return "default";
		return "ghost";
	};

	// Tooltip/title based on state
	const getTitle = () => {
		if (isPlaying) {
			return "Currently playing - click to open player";
		}

		switch (state) {
			case "loading":
				return "Generating audio...";
			case "ready":
				if (isInQueue) {
					return "In queue - click to open player";
				}
				return "Play audio (add to queue)";
			case "error":
				return "Generation failed - click to retry";
			case "idle":
			default:
				return "Generate audio";
		}
	};

	return (
		<Button
			variant={getButtonVariant()}
			size="icon"
			onClick={handleClick}
			disabled={(state === "loading" || generateAudioMutation.isPending) && !isPlaying}
			title={getTitle()}
			className={cn(
				"shrink-0",
				state === "error" && "animate-pulse",
				isPlaying && "ring-2 ring-primary ring-offset-2",
				className
			)}
		>
			{renderIcon()}
		</Button>
	);
}
