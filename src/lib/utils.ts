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
  if (!fiberRef.current) return;
  Effect.runFork(Fiber.interrupt(fiberRef.current));
  fiberRef.current = null;
}
