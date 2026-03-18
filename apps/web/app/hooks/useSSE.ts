import { useEffect, useRef, useState } from "react";

export interface UseSSEOptions<T = unknown> {
	enabled?: boolean;
	onError?: (error: Event) => void;
	onOpen?: () => void;
	reconnectInterval?: number;
	maxReconnectAttempts?: number;
}

export interface UseSSEResult<T> {
	data: T | null;
	error: Event | null;
	isConnected: boolean;
}

/**
 * Hook for subscribing to Server-Sent Events with automatic reconnection
 * Automatically manages connection lifecycle and parses JSON data
 */
export function useSSE<T = unknown>(
	url: string,
	options: UseSSEOptions<T> = {}
): UseSSEResult<T> {
	const {
		enabled = true,
		onError,
		onOpen,
		reconnectInterval = 5000,
		maxReconnectAttempts = 5,
	} = options;

	const [data, setData] = useState<T | null>(null);
	const [error, setError] = useState<Event | null>(null);
	const [isConnected, setIsConnected] = useState(false);

	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const reconnectAttemptsRef = useRef(0);

	useEffect(() => {
		if (!enabled) {
			// Clean up existing connection if disabled
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = null;
			}
			setIsConnected(false);
			return;
		}

		const connect = () => {
			// Don't reconnect if we already have a connection
			if (eventSourceRef.current?.readyState === EventSource.OPEN) {
				return;
			}

			// Clean up any existing connection
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}

			try {
				const eventSource = new EventSource(url);
				eventSourceRef.current = eventSource;

				eventSource.onopen = () => {
					setIsConnected(true);
					setError(null);
					reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
					onOpen?.();
				};

				eventSource.onmessage = (event: MessageEvent) => {
					try {
						const parsed = JSON.parse(event.data) as T;
						setData(parsed);
					} catch (err) {
						console.error("Failed to parse SSE data:", err);
					}
				};

				eventSource.onerror = (err: Event) => {
					setIsConnected(false);
					setError(err);
					onError?.(err);

					// Only log error if it's not a normal closure
					if (eventSource.readyState !== EventSource.CLOSED) {
						console.error("SSE Error:", err);
					}

					// Attempt to reconnect if within limits
					if (
						reconnectAttemptsRef.current < maxReconnectAttempts &&
						eventSource.readyState !== EventSource.CONNECTING
					) {
						reconnectAttemptsRef.current += 1;
						console.log(
							`SSE disconnected, attempting reconnect ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${reconnectInterval}ms...`
						);

						// Clear any existing timeout
						if (reconnectTimeoutRef.current) {
							clearTimeout(reconnectTimeoutRef.current);
						}

						// Schedule reconnection
						reconnectTimeoutRef.current = setTimeout(() => {
							connect();
						}, reconnectInterval);
					} else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
						console.error("Max reconnection attempts reached, giving up");
					}
				};

				// Add heartbeat listener to detect stale connections
				// Some SSE servers send periodic heartbeats
				eventSource.addEventListener('heartbeat', () => {
					// Reset error state on heartbeat
					if (error) {
						setError(null);
					}
				});

			} catch (err) {
				console.error("Failed to create EventSource:", err);
				setError(err as Event);
				setIsConnected(false);
			}
		};

		// Initial connection
		connect();

		// Cleanup on unmount
		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = null;
			}
			setIsConnected(false);
		};
	}, [url, enabled, onError, onOpen, reconnectInterval, maxReconnectAttempts, error]);

	return { data, error, isConnected };
}