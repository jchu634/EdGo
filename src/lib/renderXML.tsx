import { View, Text, ScrollView, ActivityIndicator, Image } from "react-native";
import React from "react";
import LinkText from "@/src/components/LinkText";

const experimental_renderXMLNode = (node: XmlNode): React.ReactNode => {
  return <></>;
};

interface XmlTextNode {
  type: "text";
  value: string;
}

interface XmlElementNode {
  type: "element" | "document";
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  selfClosing?: boolean;
}

export type XmlNode = XmlTextNode | XmlElementNode;

export function isXmlNode(val: unknown): val is XmlNode {
  if (!val || typeof val !== "object") return false;
  const obj = val as Record<string, unknown>;
  if (obj.type === "text" && typeof obj.value === "string") return true;
  if (
    (obj.type === "element" || obj.type === "document") &&
    typeof obj.tag === "string" &&
    Array.isArray(obj.children)
  )
    return true;
  return false;
}

export function renderXmlNode(
  node: XmlNode,
  keyPrefix = "node",
): React.ReactNode {
  if (node.type === "text") {
    return <Text key={keyPrefix}>{node.value} </Text>;
  }

  if (node.type === "element" || node.type === "document") {
    const children = () =>
      node.children.map((child, i) =>
        renderXmlNode(child, `${keyPrefix}-${node.tag}-${i}`),
      );

    if (node.selfClosing && node.children.length === 0) {
      if (node.tag === "break" || node.tag === "br") {
        return <Text key={keyPrefix}>{"\n"}</Text>;
      }
      return null;
    }

    switch (node.tag) {
      case "document":
        return <React.Fragment key={keyPrefix}>{children()}</React.Fragment>;
      case "paragraph":
      case "p":
        return (
          <Text key={keyPrefix} className="font-display mb-2">
            {children()}{" "}
          </Text>
        );
      case "bold":
      case "b":
        return (
          <Text key={keyPrefix} className="font-display-bold">
            {children()}
          </Text>
        );
      case "italic":
      case "i":
        return (
          <Text key={keyPrefix} className="font-display italic">
            {children()}
          </Text>
        );
      case "code":
        return (
          <Text
            key={keyPrefix}
            className="font-display rounded bg-gray-200 px-1 font-mono"
          >
            {children()}
          </Text>
        );
      case "pre":
      case "codeblock":
        return (
          <View key={keyPrefix} className="my-2 rounded-lg bg-gray-200 p-3">
            <Text className="font-mono text-sm">{children()}</Text>
          </View>
        );
      case "list":
        return (
          <View key={keyPrefix} className="mb-2 ml-2">
            {children()}
          </View>
        );
      case "li":
      case "listitem":
        return (
          <View key={keyPrefix} className="mb-1 ml-2 flex-row">
            <Text className="font-display">• </Text>
            <View className="flex-1">{children()}</View>
          </View>
        );
      case "heading":
        return (
          <Text key={keyPrefix} className="font-display-bold mb-1 text-lg">
            {children()}
          </Text>
        );
      case "image": {
        const src = node.attrs.src || node.attrs.url;
        if (src) {
          return (
            <Image
              key={keyPrefix}
              source={{ uri: src }}
              className="my-2 h-40 w-full rounded-lg"
              resizeMode="contain"
            />
          );
        }
        return null;
      }
      case "link": {
        return (
          <LinkText key={keyPrefix} href={node.attrs.href}>
            {children()}
          </LinkText>
        );
      }
      default:
        return <React.Fragment key={keyPrefix}>{children()}</React.Fragment>;
    }
  }

  return null;
}
