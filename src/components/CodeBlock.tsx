import React, { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  useColorScheme,
  type TextStyle,
} from "react-native";
import type { ThemedToken } from "@shikijs/core";
import { cn } from "cnfast";
import { useHighlighter } from "@/src/providers/highlightProvider";

interface CodeBlockProps {
  code: string;
  lang?: string;
}

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

function renderLine(line: ThemedToken[], lineKey: string): React.ReactNode {
  if (line.length === 0) {
    // Preserve blank lines so line spacing stays correct.
    return <Text key={lineKey}> </Text>;
  }
  return (
    <Text key={lineKey} selectable>
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

export default function CodeBlock({ code, lang }: CodeBlockProps) {
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

  if (error || !tokens) {
    return (
      <View className="my-2 rounded-lg bg-gray-200 p-3 dark:bg-gray-800">
        <Text
          className="font-mono text-sm text-gray-800 dark:text-gray-100"
          selectable
        >
          {code}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={cn(
        "my-2 rounded-lg p-3",
        theme === "github-dark" ? "bg-gray-900" : "bg-gray-50",
      )}
    >
      <View>
        <Text className="font-mono text-sm text-gray-800 dark:text-gray-100">
          {tokens.map((line, i) => renderLine(line, `cb-line-${i}`))}
        </Text>
      </View>
    </ScrollView>
  );
}
