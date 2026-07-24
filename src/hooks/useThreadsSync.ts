import { useEffect, useRef, useState } from "react";
import { Effect, Fiber } from "effect";
import { useDb } from "@/src/providers/dbProvider";
import { syncPageProgram } from "@/src/lib/threads";
import { interruptFiber } from "@/src/lib/utils";

type SyncMode = "initial" | "refresh" | "page";

export function useThreadsSync(courseId: number, category?: string) {
  console.debug("[useThreadsSync] called", { courseId, category });
  const db = useDb();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const offsetRef = useRef(0);
  const [endOfPages, setEndOfPages] = useState(false);
  const fiberRef = useRef<Fiber.Fiber<any, any> | null>(null);

  function fetchAndSync(mode: SyncMode, offset?: number) {
    console.debug("[useThreadsSync] fetchAndSync", { mode, offset });

    interruptFiber(fiberRef);

    if (mode === "refresh") {
      offsetRef.current = 0;
      setEndOfPages(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const actualOffset = offset ?? offsetRef.current;

    const program = syncPageProgram(db, courseId, category, actualOffset).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          if (result.endOfPages) {
            setEndOfPages(true);
          } else {
            offsetRef.current = result.nextOffset;
          }
        }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          setLoading(false);
          setRefreshing(false);
        }),
      ),
    );

    fiberRef.current = Effect.runFork(program);
  }

  useEffect(() => {
    console.debug("[useThreadsSync] initial fetch effect");
    offsetRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- It is only run on initial mount
    fetchAndSync("initial", 0);
    return () => interruptFiber(fiberRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- It is meant to only run on initial mount
  }, []);

  function refresh() {
    console.debug("[useThreadsSync] refresh");
    fetchAndSync("refresh", 0);
  }

  function fetchMore() {
    console.debug("[useThreadsSync] fetchMore", {
      offset: offsetRef.current,
      endOfPages,
      loading,
      refreshing,
    });
    if (endOfPages || loading || refreshing) return;
    fetchAndSync("page");
  }

  console.debug("[useThreadsSync] render", {
    courseId,
    loading,
    refreshing,
    endOfPages,
  });

  return {
    loading,
    refreshing,
    fetchMore,
    refresh,
    endOfPages,
  };
}
