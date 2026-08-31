import { Text, View } from "react-native";

import LinkText from "@/src/components/LinkText";
import type { XmlElementNode } from "@/src/lib/renderXML";

interface FileComponentProps {
  node: XmlElementNode;
}

export default function FileComponent({ node }: FileComponentProps) {
  const url = node.attrs.url;
  const filename = node.attrs.filename || "Download file";

  if (!url) return null;

  return (
    <View className="my-2 rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
      <Text className="font-display dark:text-slate-100">
        File: <LinkText href={url}>{filename}</LinkText>
      </Text>
    </View>
  );
}
