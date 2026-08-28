import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useNetwork } from "@/src/providers/networkProvider";

export default function OfflineBanner() {
  const { isOnline } = useNetwork();

  if (isOnline) return null;

  return (
    <View
      className="flex-row items-center justify-center gap-x-2 px-4 py-2"
      style={{ backgroundColor: "#f59e0b" }}
    >
      <Ionicons name="cloud-offline" size={14} color="white" />
      <Text className="font-display-semibold text-center text-xs text-white">
        You are offline
      </Text>
    </View>
  );
}
