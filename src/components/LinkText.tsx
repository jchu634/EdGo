import React from "react";
import { Text } from "react-native";

import { useLinkTextContext } from "@/src/providers/modalProvider";

interface LinkTextProps {
  href: string;
  children: React.ReactNode;
}

export default function LinkText({ href, children }: LinkTextProps) {
  const { openLink, showMenu } = useLinkTextContext();

  return (
    <Text
      className="text-blue-700 underline dark:text-blue-500"
      onPress={() => openLink(href)}
      onLongPress={() => showMenu(href)}
      selectable={false}
    >
      {children}
    </Text>
  );
}
