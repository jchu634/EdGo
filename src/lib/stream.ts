// ─── Types ──────────────────────────────────────────────────────────────────

export type StreamMessageType = "thread.unreadCounts" | "pong";

export interface StreamMessage {
  id: number;
  type: StreamMessageType;
}

export interface UnreadCountEntry {
  unread: number;
}

export interface UnreadCountsResponse {
  id: number;
  type: "thread.unreadCounts";
  data: Record<string, UnreadCountEntry>;
}

// ─── Low-level helpers ──────────────────────────────────────────────────────

/**
 * Open a WebSocket, wait for it to become ready, and return it.
 * Rejects if the connection fails before `open`.
 */
function connect(
  url: string,
  headers?: Record<string, string>,
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    // console.log("[stream] new WebSocket(", url, "headers:", !!headers, ")");

    // React Native's WebSocket accepts a third `options` arg with `headers`,
    // but the type definitions only allow 1–2 args. Cast to bypass.
    const Ws = WebSocket as unknown as new (
      url: string,
      protocols: string[],
      options: { headers?: Record<string, string> },
    ) => WebSocket;
    const ws = new Ws(url, [], { headers });

    ws.onopen = () => {
      // console.log("[stream] open — readyState:", ws.readyState);
      resolve(ws);
    };

    ws.onerror = (event: Event) => {
      console.error(
        "[stream] onerror — readyState:",
        ws.readyState,
        "event:",
        event,
      );
      reject(
        new Error(
          `WebSocket connection failed: ${url.replace(/_token=[^&]+/, "_token=***")}`,
        ),
      );
    };

    ws.onclose = (event: CloseEvent) => {
      // console.log(
      //   "[stream] onclose — code:",
      //   event.code,
      //   "reason:",
      //   event.reason,
      //   "wasClean:",
      //   event.wasClean,
      // );
    };
  });
}

/**
 * Wait for the **next** message that matches `filter`.
 * Returns the parsed JSON object.
 */
function waitForMessage<T>(
  ws: WebSocket,
  filter?: (msg: MessageEvent) => boolean,
  timeoutMs = 15_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("[stream] Timed out waiting for a matching message"));
    }, timeoutMs);

    // Save previous handlers so we can restore them after
    const prevOnMessage = ws.onmessage;
    const prevOnError = ws.onerror;

    ws.onmessage = (event: MessageEvent) => {
      console.log("[stream] onmessage — data:", event.data);
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        // Not JSON – skip
        return;
      }

      if (filter && !filter(event)) return;

      clearTimeout(timer);
      cleanup();
      resolve(parsed as T);
    };

    ws.onerror = (event: Event) => {
      console.error("[stream] waitForMessage onerror:", event);
      clearTimeout(timer);
      cleanup();
      reject(new Error("[stream] WebSocket error while waiting for message"));
    };

    function cleanup() {
      ws.onmessage = prevOnMessage;
      ws.onerror = prevOnError;
    }
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Connect to the EdStem stream WebSocket, send a message, wait for a single
 * matching response, then close the connection.
 *
 * @param message  The message object to send (will be JSON-stringified).
 * @param options.filter  Optional predicate to identify the response you care about.
 * @param options.timeoutMs  How long to wait before giving up (default 15 s).
 */
export async function streamRequest<T = unknown>(
  message: StreamMessage,
  options?: {
    filter?: (msg: MessageEvent) => boolean;
    timeoutMs?: number;
  },
): Promise<T> {
  const token = process.env.EXPO_PUBLIC_EDSTEM_API_KEY;
  if (!token) throw new Error("Missing EXPO_PUBLIC_EDSTEM_API_KEY");

  const url = "wss://edstem.org/api/stream";
  console.log("[stream] Connecting to", url, "(Bearer token in header)");

  const ws = await connect(url, { Authorization: `Bearer ${token}` });

  try {
    ws.send(JSON.stringify(message));
    return await waitForMessage<T>(ws, options?.filter, options?.timeoutMs);
  } finally {
    if (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    ) {
      ws.close(1000, "Done");
    }
  }
}

/**
 * Convenience: fetch unread thread counts from EdStem.
 *
 * @example
 * ```ts
 * const counts = await getUnreadCounts();
 * // counts.data is Record<string, { unread: number }>
 * ```
 */
export function getUnreadCounts(): Promise<UnreadCountsResponse> {
  return streamRequest<UnreadCountsResponse>(
    { id: 1, type: "thread.unreadCounts" },
    {
      filter: (event) => {
        try {
          const parsed = JSON.parse(event.data);
          return parsed.type === "thread.unreadCounts";
        } catch {
          return false;
        }
      },
    },
  );
}
