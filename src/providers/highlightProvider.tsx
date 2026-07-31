import type { HighlighterContextType } from "@shared/contexts/highlighter/context";
import type { HighlighterCore } from "@shikijs/core";
import { HighlighterContext } from "@shared/contexts/highlighter/context";
import { createHighlighterCore } from "@shikijs/core";
import ada from "@shikijs/langs/ada";
import asm from "@shikijs/langs/asm";
import bash from "@shikijs/langs/bash";
import c from "@shikijs/langs/c";
import cpp from "@shikijs/langs/cpp";
import csharp from "@shikijs/langs/csharp";
import css from "@shikijs/langs/css";
import dart from "@shikijs/langs/dart";
import f95 from "@shikijs/langs/f95";
import go from "@shikijs/langs/go";
import haskell from "@shikijs/langs/haskell";
import html from "@shikijs/langs/html";
import java from "@shikijs/langs/java";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import jsx from "@shikijs/langs/jsx";
import julia from "@shikijs/langs/julia";
import kotlin from "@shikijs/langs/kotlin";
import latex from "@shikijs/langs/latex";
import lisp from "@shikijs/langs/lisp";
import lua from "@shikijs/langs/lua";
import matlab from "@shikijs/langs/matlab";
import mips from "@shikijs/langs/mips";
import nim from "@shikijs/langs/nim";
import ocaml from "@shikijs/langs/ocaml";
import php from "@shikijs/langs/php";
import prolog from "@shikijs/langs/prolog";
import python from "@shikijs/langs/python";
import r from "@shikijs/langs/r";
import racket from "@shikijs/langs/racket";
import ruby from "@shikijs/langs/ruby";
import rust from "@shikijs/langs/rust";
import scala from "@shikijs/langs/scala";
import sql from "@shikijs/langs/sql";
import svelte from "@shikijs/langs/svelte";
import swift from "@shikijs/langs/swift";
import typescript from "@shikijs/langs/typescript";
import vb from "@shikijs/langs/vb";
import verilog from "@shikijs/langs/verilog";
import vue from "@shikijs/langs/vue";
import yaml from "@shikijs/langs/yaml";
import aurorax from "@shikijs/themes/aurora-x";
import React from "react";
import {
  createNativeEngine,
  isNativeEngineAvailable,
} from "react-native-shiki-engine";

const SHIKI_LANGS = [
  asm,
  ada,
  mips,
  bash,
  c,
  cpp,
  csharp,
  css,
  dart,
  f95,
  go,
  html,
  haskell,
  java,
  javascript,
  jsx,
  json,
  julia,
  kotlin,
  latex,
  lisp,
  lua,
  sql,
  nim,
  ocaml,
  matlab,
  php,
  prolog,
  python,
  r,
  racket,
  ruby,
  rust,
  scala,
  svelte,
  swift,
  typescript,
  vb,
  verilog,
  vue,
  yaml,
];

/**
 * Maps EdStem language values to the shiki grammar id registered with the
 * highlighter. Values that already match a registered grammar name/alias
 * (e.g. `py` -> python) are listed explicitly for clarity, and unsupported
 * languages fall back to plain text.
 */
const LANG_TO_SHIKI: Record<string, string> = {
  // Assembly
  x86: "asm",
  aarch64: "asm",
  mips: "mipsasm",
  // Ada
  adb: "ada",
  // Shell
  sh: "shellscript",
  // C-family
  c: "c",
  cc: "cpp",
  cs: "csharp",
  // Web markup
  css: "css",
  html: "html",
  // Dart
  dart: "dart",
  // Fortran
  f95: "fortran-free-form",
  // Go
  go: "go",
  // Haskell
  hs: "haskell",
  // JVM
  java: "java",
  kt: "kotlin",
  scala: "scala",
  // JS / TS family
  js: "javascript",
  jsweb: "javascript",
  jsx: "jsx",
  ts: "typescript",
  json: "json",
  // Julia
  jl: "julia",
  // LaTeX
  tex: "latex",
  // Lisp
  lisp: "common-lisp",
  // Lua
  lua: "lua",
  // SQL (no per-dialect grammar available; fall back to generic sql)
  mysql: "sql",
  sql: "sql",
  sqlite: "sql",
  // Nim
  nim: "nim",
  // OCaml
  ml: "ocaml",
  // Octave (MATLAB-compatible)
  m: "matlab",
  // PHP
  php: "php",
  // Prolog
  pro: "prolog",
  // Python (sage is Python-based)
  py: "python",
  sage: "python",
  // R
  r: "r",
  // Racket
  rkt: "racket",
  // Ruby
  rb: "ruby",
  // Rust
  rs: "rust",
  // Svelte
  svelte: "svelte",
  // Swift
  swift: "swift",
  // Verilog
  v: "verilog",
  // Vue
  vue: "vue",
  // Visual Basic
  vb: "vb",
  // Yaml
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

let highlighterInstance: HighlighterCore | null = null;
let initializationPromise: Promise<void> | null = null;

export function HighlighterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = React.useMemo<HighlighterContextType>(
    () => ({
      initialize: async () => {
        if (!initializationPromise) {
          initializationPromise = (async () => {
            const available = isNativeEngineAvailable();
            if (!available) throw new Error("Native engine not available.");

            highlighterInstance = await createHighlighterCore({
              langs: SHIKI_LANGS,
              themes: [aurorax],
              engine: createNativeEngine(),
            });
          })();
        }

        await initializationPromise;
      },

      tokenize: (code: string, options: { lang: string; theme: string }) => {
        if (!highlighterInstance) {
          throw new Error(
            "Highlighter not initialized. Call initialize() first.",
          );
        }
        return highlighterInstance.codeToTokensBase(code, {
          ...options,
          lang: resolveShikiLang(options.lang),
        });
      },

      dispose: () => {
        if (highlighterInstance) {
          highlighterInstance.dispose();
          highlighterInstance = null;
          initializationPromise = null;
        }
      },
    }),
    [],
  );

  return <HighlighterContext value={value}>{children}</HighlighterContext>;
}
