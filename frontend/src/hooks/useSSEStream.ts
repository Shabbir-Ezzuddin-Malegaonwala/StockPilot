/**
 * useSSEStream Hook — HAND-WRITTEN (Assignment Requirement)
 *
 * Consumes a Server-Sent Events stream from the backend.
 * Returns accumulated text data, streaming status, error state,
 * and controls to start/stop the stream.
 *
 * Uses fetch with ReadableStream instead of EventSource because:
 * 1. EventSource doesn't support sending credentials (cookies)
 * 2. EventSource doesn't support POST requests
 * 3. fetch gives us more control over abort and error handling
 *
 * Cleans up on component unmount to prevent memory leaks.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface SSEStreamReturn {
  data: string;
  isStreaming: boolean;
  error: string | null;
  startStream: () => void;
  stopStream: () => void;
}

export function useSSEStream(url: string): SSEStreamReturn {
  const [data, setData] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // AbortController ref — used to cancel the fetch request
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup function — aborts any in-progress stream
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Stop the stream
  const stopStream = useCallback(() => {
    cleanup();
    setIsStreaming(false);
  }, [cleanup]);

  // Start the stream
  const startStream = useCallback(() => {
    // Abort any existing stream before starting a new one
    cleanup();

    // Reset state for new stream
    setData("");
    setError(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    fetch(url, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? "You do not have permission to generate reports"
              : response.status === 401
              ? "Please log in to generate reports"
              : `Server error (${response.status})`
          );
        }

        if (!response.body) {
          throw new Error("No response body received");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Read chunks from the stream
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode the chunk to text
          const text = decoder.decode(value, { stream: true });

          // SSE format: each event is "data: {...}\n\n"
          // Split by double newline to get individual events
          const lines = text.split("\n");

          for (const line of lines) {
            const trimmed = line.trim();

            // Skip empty lines and non-data lines
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            // Extract JSON after "data: "
            const jsonStr = trimmed.slice(6);

            try {
              const parsed = JSON.parse(jsonStr);

              // Check if stream is complete
              if (parsed.done === true) {
                setIsStreaming(false);
                return;
              }

              // Append content to accumulated data
              if (parsed.content) {
                setData((prev) => prev + parsed.content);
              }
            } catch {
              // Skip malformed JSON chunks — the stream might split
              // a JSON object across two chunks, which is normal
            }
          }
        }

        // Stream ended naturally without a done flag
        setIsStreaming(false);
      })
      .catch((err) => {
        // AbortError means the user stopped the stream — not an error
        if (err instanceof Error && err.name === "AbortError") {
          setIsStreaming(false);
          return;
        }

        const message =
          err instanceof Error ? err.message : "Stream connection failed";
        setError(message);
        setIsStreaming(false);
      });
  }, [url, cleanup]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { data, isStreaming, error, startStream, stopStream };
}
