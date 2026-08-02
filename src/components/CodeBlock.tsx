import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme,
  type TextStyle,
} from "react-native";
import { PlayIcon } from "phosphor-react-native";
import type { ThemedToken } from "@shikijs/core";
import { cn } from "cnfast";
import { useHighlighter } from "@/src/providers/highlightProvider";

interface CodeBlockProps {
  code: string;
  lang?: string;
  lineNumbers?: boolean;
  /** When true, renders a "Run" button beneath the code. */
  runnable?: boolean;
}

const LANG_TO_READABLE_LANG: Record<string, string> = {
  x86: "x86",
  aarch64: "AArch64",
  adb: "Ada",
  mips: "MIPS",
  sh: "Bash",
  c: "C",
  cc: "C++",
  cs: "C#",
  css: "CSS",
  dart: "Dart",
  f95: "Fortran",
  go: "Go",
  html: "HTML",
  hs: "Haskell",
  java: "Java",
  js: "JavaScript (Node)",
  jsweb: "JavaScript (Web)",
  jsx: "JSX",
  json: "JSON",
  jl: "Julia",
  karel: "Karel",
  kt: "Kotlin",
  tex: "LaTeX",
  lisp: "Lisp",
  lua: "Lua",
  mysql: "MySQL",
  nim: "Nim",
  ml: "OCaml",
  m: "Octave",
  php: "PHP",
  sql: "Postgres",
  pro: "Prolog",
  py: "Python",
  arr: "Pyret",
  r: "R",
  rkt: "Racket",
  rb: "Ruby",
  rs: "Rust",
  sage: "Sage",
  scala: "Scala",
  dl: "Soufflé",
  sqlite: "SQLite",
  svelte: "Svelte",
  swift: "Swift",
  txt: "Text",
  ts: "Typescript",
  vb: "VB",
  v: "Verilog",
  vue: "Vue",
  yaml: "Yaml",
};

// FontStyle bitmask values from vscode-textmate.
const FONT_ITALIC = 1;
const FONT_BOLD = 2;
const FONT_UNDERLINE = 4;
const FONT_STRIKETHROUGH = 8;

function decodeFontStyle(fontStyle?: number): TextStyle {
  const style: TextStyle = {};
  if (!fontStyle || fontStyle <= 0) return style;
  if (fontStyle & FONT_BOLD) style.fontWeight = "bold";
  if (fontStyle & FONT_ITALIC) style.fontStyle = "italic";
  const decorations: ("underline" | "line-through")[] = [];
  if (fontStyle & FONT_UNDERLINE) decorations.push("underline");
  if (fontStyle & FONT_STRIKETHROUGH) decorations.push("line-through");
  if (decorations.length > 0) {
    style.textDecorationLine = decorations.join(
      " ",
    ) as TextStyle["textDecorationLine"];
  }
  return style;
}

// Shared style code lines as each line is a sibling <Text>.
const CODE_LINE_CLASSNAME =
  "font-mono text-sm text-gray-800 dark:text-gray-100";

function renderLine(
  line: ThemedToken[],
  lineKey: string,
  lineNumbers: boolean,
): React.ReactNode {
  const gutter = lineNumbers ? (
    <Text className="text-gray-400 dark:text-gray-500">
      {`${parseInt(lineKey) + 1}`.padStart(3, " ") + " "}
    </Text>
  ) : null;
  if (line.length === 0) {
    // Preserve blank lines so vertical spacing stays correct.
    return (
      <Text key={lineKey} className={CODE_LINE_CLASSNAME} selectable>
        {gutter}{" "}
      </Text>
    );
  }
  return (
    <Text key={lineKey} className={CODE_LINE_CLASSNAME} selectable>
      {gutter}
      {line.map((token, i) => (
        <Text
          key={`${lineKey}-${i}`}
          style={{
            ...(token.color ? { color: token.color } : {}),
            ...decodeFontStyle(token.fontStyle),
          }}
        >
          {token.content}
        </Text>
      ))}
    </Text>
  );
}

export default function CodeBlock({
  code,
  lang,
  lineNumbers,
  runnable,
}: CodeBlockProps) {
  const { ready, error, tokenize } = useHighlighter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? "github-dark" : "github-light";
  const resolvedLang = lang ?? "text";

  // The effect only mutates state from the async callback (never synchronously),
  // so staleness is detected during render by comparing the stored inputs.
  const [result, setResult] = useState<{
    code: string;
    lang: string;
    theme: string;
    tokens: ThemedToken[][] | null;
  } | null>(null);

  useEffect(() => {
    if (!ready || error) return;
    let cancelled = false;
    tokenize(code, resolvedLang, theme).then((tokenResult) => {
      if (!cancelled) {
        setResult({ code, lang: resolvedLang, theme, tokens: tokenResult });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code, resolvedLang, theme, ready, error, tokenize]);

  const tokens =
    result &&
    result.code === code &&
    result.lang === resolvedLang &&
    result.theme === theme
      ? result.tokens
      : null;

  const handleRun = () => {
    // TODO: invoke the EdStem code-run API and render the result.
  };
  console.log("LineNumbers", lineNumbers);
  return (
    <View className="my-2">
      <View
        className={cn(
          "flex w-full flex-row justify-between rounded-t-lg p-3",
          theme === "github-dark" ? "bg-gray-900" : "bg-gray-50",
        )}
      >
        <Text className="font-mono-bold text-sm text-gray-800 dark:text-gray-100">
          {lang ? LANG_TO_READABLE_LANG[lang] : "Unknown Language"}
        </Text>
        {runnable && (
          <Pressable
            onPress={handleRun}
            className="flex-row items-center gap-x-1 self-start rounded-lg bg-[#70069f] px-3 py-1.5"
          >
            <Text className="text-sm font-semibold text-white">Run</Text>
            <PlayIcon size={14} color="white" weight="fill" />
          </Pressable>
        )}
      </View>

      {tokens ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className={cn(
            "rounded-b-lg p-3",
            theme === "github-dark" ? "bg-gray-900" : "bg-gray-50",
          )}
        >
          <View>
            {tokens.map((line, i) => renderLine(line, `${i}`, lineNumbers))}
          </View>
        </ScrollView>
      ) : (
        <View className="rounded-lg bg-gray-200 p-3 dark:bg-gray-800">
          <Text
            className="font-mono text-sm text-gray-800 dark:text-gray-100"
            selectable
          >
            {code}
          </Text>
        </View>
      )}
    </View>
  );
}
