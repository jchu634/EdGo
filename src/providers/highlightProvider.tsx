import type { HighlighterCore, ThemedToken } from "@shikijs/core";
import { createHighlighterCore } from "@shikijs/core";
import type { LanguageRegistration } from "@shikijs/types";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Effect } from "effect";
import {
  createNativeEngine,
  isNativeEngineAvailable,
} from "react-native-shiki-engine";

export type HighlightTheme = "github-light" | "github-dark";

interface HighlighterContextValue {
  ready: boolean;
  error: Error | null;
  /**
   * Tokenize code for the given language and theme.
   * Dynamically loads the language grammar on first use, so the first call
   * for a new language resolves after the grammar is registered.
   * Returns null when not ready, on init error, or if the resolved language
   * grammar is unavailable (caller should fall back to plain text).
   */
  tokenize: (
    code: string,
    lang: string,
    theme: HighlightTheme,
  ) => Promise<ThemedToken[][] | null>;
}

const HighlighterContext = createContext<HighlighterContextValue | null>(null);

/**
 * Lazy Load Shiki Grammars (Defaults to plain text)
 */
const SHIKI_LANG_MODULES: Record<
  string,
  () => Promise<{ default: LanguageRegistration[] }>
> = {
  asm: () => import("@shikijs/langs/asm"),
  mipsasm: () => import("@shikijs/langs/mipsasm"),
  ada: () => import("@shikijs/langs/ada"),
  shellscript: () => import("@shikijs/langs/bash"),
  c: () => import("@shikijs/langs/c"),
  cpp: () => import("@shikijs/langs/cpp"),
  csharp: () => import("@shikijs/langs/csharp"),
  css: () => import("@shikijs/langs/css"),
  html: () => import("@shikijs/langs/html"),
  dart: () => import("@shikijs/langs/dart"),
  "fortran-free-form": () => import("@shikijs/langs/f95"),
  go: () => import("@shikijs/langs/go"),
  haskell: () => import("@shikijs/langs/haskell"),
  java: () => import("@shikijs/langs/java"),
  javascript: () => import("@shikijs/langs/javascript"),
  jsx: () => import("@shikijs/langs/jsx"),
  typescript: () => import("@shikijs/langs/typescript"),
  json: () => import("@shikijs/langs/json"),
  julia: () => import("@shikijs/langs/julia"),
  kotlin: () => import("@shikijs/langs/kotlin"),
  latex: () => import("@shikijs/langs/latex"),
  "common-lisp": () => import("@shikijs/langs/common-lisp"),
  lua: () => import("@shikijs/langs/lua"),
  sql: () => import("@shikijs/langs/sql"),
  nim: () => import("@shikijs/langs/nim"),
  ocaml: () => import("@shikijs/langs/ocaml"),
  matlab: () => import("@shikijs/langs/matlab"),
  php: () => import("@shikijs/langs/php"),
  prolog: () => import("@shikijs/langs/prolog"),
  python: () => import("@shikijs/langs/python"),
  r: () => import("@shikijs/langs/r"),
  racket: () => import("@shikijs/langs/racket"),
  ruby: () => import("@shikijs/langs/ruby"),
  rust: () => import("@shikijs/langs/rust"),
  scala: () => import("@shikijs/langs/scala"),
  svelte: () => import("@shikijs/langs/svelte"),
  swift: () => import("@shikijs/langs/swift"),
  verilog: () => import("@shikijs/langs/verilog"),
  vue: () => import("@shikijs/langs/vue"),
  vb: () => import("@shikijs/langs/vb"),
  yaml: () => import("@shikijs/langs/yaml"),
};

const LANG_TO_SHIKI: Record<string, string> = {
  // Assembly
  x86: "asm",
  aarch64: "asm",
  mips: "mipsasm",
  adb: "ada",
  sh: "shellscript",
  // C-family
  c: "c",
  cc: "cpp",
  cs: "csharp",
  css: "css",
  html: "html",
  dart: "dart",
  f95: "fortran-free-form",
  go: "go",
  hs: "haskell",
  java: "java",
  kt: "kotlin",
  scala: "scala",
  js: "javascript",
  jsweb: "javascript",
  jsx: "jsx",
  ts: "typescript",
  json: "json",
  jl: "julia",
  tex: "latex",
  lisp: "common-lisp",
  lua: "lua",
  // SQL (no per-dialect grammar available; fall back to generic sql)
  mysql: "sql",
  sql: "sql",
  sqlite: "sql",
  nim: "nim",
  ml: "ocaml",
  m: "matlab",
  php: "php",
  pro: "prolog",
  // Python (sage is Python-based)
  py: "python",
  sage: "python",
  r: "r",
  rkt: "racket",
  rb: "ruby",
  rs: "rust",
  svelte: "svelte",
  swift: "swift",
  v: "verilog",
  vue: "vue",
  vb: "vb",
  yaml: "yaml",
  // Plain text / no shiki grammar available
  txt: "text",
  karel: "text",
  arr: "text",
  dl: "text",
};

function resolveShikiLang(lang: string): string {
  return LANG_TO_SHIKI[lang] ?? lang;
}

// Module-level singleton.
// These live outside the component so they survive remounts, StrictMode double-invocation, and hot reloads.
let highlighterInstance: HighlighterCore | null = null;
let initializationPromise: Promise<HighlighterCore> | null = null;
let initializationError: Error | null = null;

// Loaded/loading grammar tracking, shared across the app lifetime alongside the singleton so a grammar is compiled at most once.
const loadedLangs = new Set<string>();
const loadingLangPromises = new Map<string, Promise<void>>();

// Build the highlighter core. No grammars are loaded upfront; registered on
// first use via ensureLangLoaded. Themes are cheap and needed to resolve token
// colors, so they are registered eagerly.
const createHighlighter: Effect.Effect<HighlighterCore, Error> = Effect.gen(
  function* () {
    if (!isNativeEngineAvailable()) {
      yield* Effect.fail(
        new Error("react-native-shiki-engine native module is unavailable."),
      );
    }
    return yield* Effect.tryPromise({
      try: () =>
        createHighlighterCore({
          langs: [],
          themes: [githubLight, githubDark],
          engine: createNativeEngine(),
        }),
      catch: (error) =>
        error instanceof Error ? error : new Error(String(error)),
    });
  },
);

function getOrCreateInitPromise(): Promise<HighlighterCore> {
  if (!initializationPromise) {
    initializationPromise = Effect.runPromise(
      createHighlighter.pipe(
        Effect.tapError((err) =>
          Effect.sync(() => {
            initializationError = err;
          }),
        ),
      ),
    );
  }
  return initializationPromise;
}

function ensureLangLoaded(shikiLang: string): Promise<void> {
  if (loadedLangs.has(shikiLang)) return Promise.resolve();
  const existing = loadingLangPromises.get(shikiLang);
  if (existing) return existing;

  const loader = SHIKI_LANG_MODULES[shikiLang];
  // No loader means plain text or unsupported — nothing to register.
  if (!loader || !highlighterInstance) return Promise.resolve();

  const promise = Effect.runPromise(
    Effect.gen(function* () {
      const mod = yield* Effect.tryPromise({
        try: () => loader(),
        catch: (error) =>
          error instanceof Error ? error : new Error(String(error)),
      });
      yield* Effect.tryPromise({
        try: () => highlighterInstance!.loadLanguage(mod.default),
        catch: (error) =>
          error instanceof Error ? error : new Error(String(error)),
      });
      loadedLangs.add(shikiLang);
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          loadingLangPromises.delete(shikiLang);
        }),
      ),
    ),
  );
  loadingLangPromises.set(shikiLang, promise);
  return promise;
}

export function useHighlighter(): HighlighterContextValue {
  const ctx = useContext(HighlighterContext);
  if (!ctx) {
    throw new Error("useHighlighter must be used within HighlighterProvider");
  }
  return ctx;
}

export function HighlighterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(initializationError);

  useEffect(() => {
    let mounted = true;
    getOrCreateInitPromise()
      .then((instance) => {
        if (!mounted) return;
        highlighterInstance = instance;
        setReady(true);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      mounted = false;
    };
  }, []);

  const value: HighlighterContextValue = {
    ready,
    error,
    tokenize: async (code, lang, theme) => {
      try {
        if (!highlighterInstance) return null;
        const shikiLang = resolveShikiLang(lang);
        await ensureLangLoaded(shikiLang);
        if (!highlighterInstance) return null;
        return highlighterInstance.codeToTokensBase(code, {
          lang: shikiLang,
          theme,
        });
      } catch {
        return null;
      }
    },
  };

  return (
    <HighlighterContext.Provider value={value}>
      {children}
    </HighlighterContext.Provider>
  );
}
