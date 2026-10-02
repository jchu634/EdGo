import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import ThreadComposerModal from "@/src/components/ThreadComposerModal";
import { draftFromThread } from "@/src/lib/thread-composer";
import type { ThreadDetail } from "@/src/lib/thread-detail";

function ComposerButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-11 items-center justify-center rounded-lg bg-purple-700 px-4 py-2"
    >
      <Text className="font-display-semibold text-white">{label}</Text>
    </Pressable>
  );
}

export function CreateThreadButton({ courseId }: { courseId: number }) {
  const router = useRouter();
  return (
    <ComposerButton
      label="New thread"
      onPress={() =>
        router.navigate({
          pathname: "/courses/[courseid]",
          params: { courseid: String(courseId), compose: "new" },
        })
      }
    />
  );
}

/** The caller keys this by course/thread so route changes close the editor. */
export function EditThreadButton({
  courseId,
  thread,
}: {
  courseId: number;
  thread: ThreadDetail;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (thread.type !== "question" && thread.type !== "post") return null;
  return (
    <>
      <ComposerButton label="Edit thread" onPress={() => setIsOpen(true)} />
      {isOpen && (
        <ThreadComposerModal
          target={{ kind: "edit", courseId, threadId: thread.id }}
          initialValue={draftFromThread(thread)}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
