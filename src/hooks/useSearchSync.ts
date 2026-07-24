import { useEffect, useRef, useState } from "react";
import { Effect, Fiber } from "effect";
import { useDb } from "@/src/providers/dbProvider";
import { searchAndSyncThreads } from "@/src/lib/threads";
import { interruptFiber } from "@/src/lib/utils";

export function useSearchSync(
  courseId: number,
  params: { query: string; sort: string } | null,
) {
  console.debug("[useSearchSync] called", { courseId, params });
  const db = useDb();
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fiberRef = useRef<Fiber.Fiber<any, any> | null>(null);

  const trimmed = (params?.query ?? "").trim();
  const sort = params?.sort ?? "relevance";
  const isActive = trimmed.length > 0;

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    interruptFiber(fiberRef);

    if (!isActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Searching State will not trigger cascading render
      setIsSearching(false);
      return;
    }

    console.debug("[useSearchSync] debouncing search", { trimmed, sort });
    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      console.debug("[useSearchSync] executing search", { trimmed, sort });

      const program = searchAndSyncThreads(db, courseId, trimmed, {
        sort,
      }).pipe(
        Effect.tapError((err) =>
          Effect.logError("[useSearchSync] API search failed:", err),
        ),
        Effect.ensuring(
          Effect.sync(() => {
            setIsSearching(false);
          }),
        ),
      );
      fiberRef.current = Effect.runFork(program);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      interruptFiber(fiberRef);
    };
  }, [courseId, trimmed, sort, db, isActive]);

  console.debug("[useSearchSync] render", {
    courseId,
    query: trimmed,
    isActive,
    isSearching: isActive && isSearching,
  });

  return {
    isSearching: isActive && isSearching,
  };
}
