import { useState } from "react";
import { Modal, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ThreadComposer from "@/src/components/ThreadComposer";
import {
  getThreadComposerDraft,
  saveThreadComposerDraft,
} from "@/src/lib/storage";
import {
  EMPTY_THREAD_DRAFT,
  type ThreadDraft,
  type ThreadDraftTarget,
} from "@/src/lib/thread-composer";

export default function ThreadComposerModal({
  target,
  initialValue = EMPTY_THREAD_DRAFT,
  onClose,
}: {
  target: ThreadDraftTarget;
  initialValue?: ThreadDraft;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width - insets.left - insets.right >= 720;
  const [initialDraft] = useState(
    () => getThreadComposerDraft(target) ?? initialValue,
  );

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 items-center justify-center bg-black/40"
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left + (isWide ? 24 : 0),
          paddingRight: insets.right + (isWide ? 24 : 0),
        }}
      >
        <View
          className="w-full flex-1 overflow-hidden bg-white dark:bg-black"
          style={{
            maxWidth: 960,
            marginVertical: isWide ? 24 : 0,
            borderRadius: isWide ? 16 : 0,
          }}
        >
          <Text
            accessibilityRole="text"
            className="font-display border-b border-gray-200 p-4 text-sm text-gray-600 dark:border-neutral-700 dark:text-slate-300"
          >
            Drafts are saved on this device. Saving a draft does not publish it
            to Ed.
          </Text>
          <ThreadComposer
            mode={target.kind}
            initialValue={initialDraft}
            submitLabel="Save draft"
            cancelLabel="Close"
            onDraftChange={(draft) => saveThreadComposerDraft(target, draft)}
            onSubmit={async (draft) => {
              saveThreadComposerDraft(target, draft);
              onClose();
            }}
            onCancel={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}
