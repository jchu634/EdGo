import type React from "react";
import { Text } from "react-native";

import { useLinkTextContext } from "@/src/providers/modalProvider";

interface LinkTextProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

export default function LinkText({ href, className, children }: LinkTextProps) {
  const { openLink, showMenu } = useLinkTextContext();

  return (
    <Text
      className={`${className ? `${className} ` : ""}text-blue-700 underline dark:text-blue-500`}
      style={{ textDecorationLine: "underline" }}
      onPress={() => openLink(href)}
      onLongPress={() => showMenu(href)}
      selectable={false}
    >
      {children}
    </Text>
  );
}
