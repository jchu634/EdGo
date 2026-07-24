import { Effect, Fiber } from "effect";
import type { MutableRefObject } from "react";

export { cn } from "cnfast";
export function absoluteUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL}${path}`;
}

export function escapeLike(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function interruptFiber(
  fiberRef: MutableRefObject<Fiber.Fiber<any, any> | null>,
) {
  const fiber = fiberRef.current;
  if (!fiber) return;
  Effect.runFork(
    Fiber.interrupt(fiber).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          if (fiberRef.current === fiber) {
            fiberRef.current = null;
          }
        }),
      ),
    ),
  );
}
