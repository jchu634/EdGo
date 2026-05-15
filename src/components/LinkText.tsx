import React from "react";
import { Text } from "react-native";

import { useLinkTextContext } from "@/src/providers/modalProvider";

interface LinkTextProps {
  href: string;
  children: React.ReactNode;
}

export default function LinkText({ href, children }: LinkTextProps) {
  const { openLink, showMenu } = useLinkTextContext();

  /*
   * href is currently bugged as somehow href is passed as a child instead of a node attr, hence temp workaround with children as string
   */
  return (
    <Text
      className="text-blue-700 underline"
      onPress={() => openLink(children as string)}
      onLongPress={() => showMenu(children as string)}
      selectable={false}
    >
      {children}
    </Text>
  );
}
