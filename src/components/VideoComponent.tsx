import { View } from "react-native";
import { WebView } from "react-native-webview";

import type { XmlElementNode } from "@/src/lib/renderXML";

interface VideoComponentProps {
  node: XmlElementNode;
}

type EmbeddedVideoSource =
  | { kind: "youtube"; uri: string }
  | { kind: "web"; uri: string };

function getEmbeddedVideoSource(src: string): EmbeddedVideoSource | null {
  let url: URL;

  try {
    url = new URL(src);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const pathParts = url.pathname.split("/").filter(Boolean);
  let youtubeId: string | null = null;

  if (hostname === "youtu.be") {
    youtubeId = pathParts[0] ?? null;
  } else if (
    hostname === "youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "music.youtube.com" ||
    hostname === "youtube-nocookie.com"
  ) {
    if (["embed", "live", "shorts"].includes(pathParts[0])) {
      youtubeId = pathParts[1] ?? null;
    } else {
      youtubeId = url.searchParams.get("v");
    }
  }

  if (youtubeId && /^[A-Za-z0-9_-]{6,64}$/.test(youtubeId)) {
    return {
      kind: "youtube",
      uri: `https://www.youtube-nocookie.com/embed/${youtubeId}?playsinline=1`,
    };
  }

  return { kind: "web", uri: url.toString() };
}

export default function VideoComponent({ node }: VideoComponentProps) {
  const src = node.attrs.src;
  if (!src) return null;

  const videoSource = getEmbeddedVideoSource(src);
  if (!videoSource) return null;

  const width = Number(node.attrs.width);
  const height = Number(node.attrs.height);
  const calculatedAspectRatio = width / height;
  const aspectRatio =
    Number.isFinite(calculatedAspectRatio) && calculatedAspectRatio > 0
      ? calculatedAspectRatio
      : 16 / 9;

  return (
    <View
      className="my-2 w-full overflow-hidden rounded-lg bg-slate-950"
      style={{ aspectRatio }}
    >
      <WebView
        source={
          videoSource.kind === "youtube"
            ? {
                uri: videoSource.uri,
                headers: {
                  Referer: "https://com.edgo",
                },
              }
            : { uri: videoSource.uri }
        }
        style={{ flex: 1, backgroundColor: "transparent" }}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        setSupportMultipleWindows={false}
      />
    </View>
  );
}
