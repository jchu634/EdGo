import { useEffect, useRef, useState } from "react";
import { Effect, Fiber } from "effect";
import {
  type ThreadDetailData,
  type ThreadDetail,
  type UsersMap,
  readCachedThreadDetailData,
  loadFreshThreadDetailData,
} from "@/src/lib/thread-detail";
import { sendThreadViewed } from "@/src/lib/threads";
import { useThreadRow } from "@/src/hooks/useThreadRow";
import type { XmlNode } from "@/src/lib/renderXML";

const EMPTY_USERS: UsersMap = new Map();
const EMPTY_XML: Map<string, XmlNode> = new Map();

export function useThreadDetail(
  courseId: number,
  threadNumber: number,
  options?: { sendViewed?: boolean },
) {
  const sendViewed = options?.sendViewed ?? true;
  const [data, setData] = useState<ThreadDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackedKey, setTrackedKey] = useState<string | null>(null);
  const fiberRef = useRef<Fiber.Fiber<any, any> | null>(null);

  const { row: threadRow, loaded: rowLoaded } = useThreadRow(
    courseId,
    threadNumber,
  );
  const isHidden = threadRow?.isHidden ?? false;

  const cacheKey = `${courseId}:${threadNumber}`;
  if (cacheKey !== trackedKey) {
    setTrackedKey(cacheKey);
    const cached = readCachedThreadDetailData(courseId, threadNumber);
    setData(cached);
    setLoading(cached === null);
  }

  useEffect(() => {
    // Wait for the DB row lookup so we know whether the thread is hidden before
    // deciding to hit the API. A hidden thread returns nothing from the server,
    // so we serve only the cached copy.
    if (!rowLoaded) return;

    if (isHidden) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- terminal state: hidden threads skip the async load, so loading is complete
      setLoading(false);
      return;
    }

    const program = loadFreshThreadDetailData(courseId, threadNumber).pipe(
      Effect.match({
        onFailure: (err) => {
          console.error("[Thread] Failed to load thread detail:", err);
          setLoading(false);
        },
        onSuccess: (fresh) => {
          setData(fresh);
          setLoading(false);
        },
      }),
    );
    fiberRef.current = Effect.runFork(program);

    return () => {
      if (fiberRef.current) {
        Effect.runFork(Fiber.interrupt(fiberRef.current));
        fiberRef.current = null;
      }
    };
  }, [courseId, threadNumber, rowLoaded, isHidden]);

  const threadId = data?.thread.id ?? null;
  useEffect(() => {
    if (!sendViewed || threadId === null || isHidden) return;
    Effect.runFork(sendThreadViewed(threadId));
  }, [threadId, sendViewed, isHidden]);

  return {
    thread: data?.thread ?? null,
    usersMap: data?.usersMap ?? EMPTY_USERS,
    parsedXmlMap: data?.parsedXmlMap ?? EMPTY_XML,
    loading,
    isHidden,
  };
}

export type { ThreadDetailData, ThreadDetail };
