import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";

import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { Effect } from "effect";
import { useUniwind } from "uniwind";

import { useApiKey } from "@/src/providers/keyProvider";
import { RegionResponse, UserResponse } from "@/src/lib/schema";
import { settings } from "@/src/lib/storage";
import { EyeClosedIcon, EyeIcon } from "phosphor-react-native";
import LinkText from "@/src/components/LinkText";

import "@/app/global.css";

export default function ApiKeyScreen() {
  const { setApiKey, isLoading } = useApiKey();
  const [inputKey, setInputKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(true);
  const { theme } = useUniwind();

  const validateApiKey = (apiKey: string) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;

      const request = HttpClientRequest.get(`https://edstem.org/api/user`).pipe(
        HttpClientRequest.bearerToken(apiKey),
        HttpClientRequest.acceptJson,
      );

      const response = yield* client.execute(request);
      if (response.status !== 200) {
        return false;
      } else {
        const user =
          yield* HttpClientResponse.schemaBodyJson(UserResponse)(response);
        settings!.set("user.name", user.user.name);
        settings!.set("user.email", user.user.email);
        if (!settings!.contains("user.developer_settings")) {
          settings!.set("user.developer_settings", false);
        }
        return true;
      }
    }).pipe(Effect.provide(FetchHttpClient.layer));

  const fetchRegion = () =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;

      const request = HttpClientRequest.get(
        `https://edstem.org/api/region`,
      ).pipe(HttpClientRequest.acceptJson);

      const regionResponse = yield* client.execute(request);

      const region =
        yield* HttpClientResponse.schemaBodyJson(RegionResponse)(
          regionResponse,
        );

      yield* Effect.sync(() => {
        settings!.set("user.default_region", region.default_region);
        settings!.set("user.country_code", region.country_code);
      });
    }).pipe(
      Effect.matchEffect({
        onSuccess: () => Effect.void,
        onFailure: (error) =>
          Effect.sync(() => {
            console.warn("Failed to fetch region, falling back to US:", error);
            settings!.set("user.default_region", "US");
            settings!.set("user.country_code", "US");
          }),
      }),
      Effect.provide(FetchHttpClient.layer),
    );

  const handleSave = async () => {
    const trimmed = inputKey.trim();
    if (!trimmed) {
      Alert.alert("Missing API Key", "Please enter your EdSTEM API key.");
      return;
    }

    setSaving(true);
    try {
      const isValid = await Effect.runPromise(validateApiKey(trimmed));
      if (!isValid) {
        Alert.alert("Invalid API Key", "The key could not be verified.");
        setSaving(false);

        return;
      }
    } catch (error) {
      Alert.alert(
        "Validation Error",
        "Could not verify the API key. Please check your network connection.",
      );
      console.error("Failed to validate API key:", error);
      setSaving(false);
      return;
    }
    Effect.runFork(fetchRegion());
    try {
      await setApiKey(trimmed);
      // KeyProvider will auto-redirect to "/" once apiKey is set
    } catch (error) {
      Alert.alert("Save Error", "Failed to save API key. Please try again.");
      console.error("Failed to save API key:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white p-6 dark:bg-slate-950">
      <View className="w-full max-w-md">
        <Image
          source={require("@/assets/images/icon.png")}
          contentFit="cover"
          transition={1000}
          style={{ width: 200, height: 200, alignSelf: "center" }}
        />

        <Text className="font-display-black mb-2 text-center text-5xl dark:text-neutral-50">
          Welcome to EdGo
        </Text>
        <Text className="font-display-medium mb-2 text-center text-black dark:text-neutral-50">
          Enter your EdSTEM API key to get started. {"\n"}
          You can find your API key at this link below.
        </Text>
        <LinkText href="https://edstem.org/us/settings/api-tokens">
          <Text className="text-md mb-8 text-center font-mono text-blue-500">
            https://edstem.org/us/settings/api-tokens
          </Text>
        </LinkText>

        <View className="mb-4 flex flex-row items-center">
          <View className="relative flex flex-row items-center gap-x-4">
            <TextInput
              className="w-100 rounded-xl border border-gray-300 p-4 font-mono text-base dark:text-white"
              placeholder="Enter your API key here"
              value={inputKey}
              onChangeText={setInputKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={showKey}
              editable={!saving && !isLoading}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>
          <TouchableOpacity
            onPress={() => setShowKey(!showKey)}
            className="size-12 items-center justify-center rounded-lg"
          >
            {showKey ? (
              <EyeClosedIcon color={theme === "dark" ? "white" : "black"} />
            ) : (
              <EyeIcon color={theme === "dark" ? "white" : "black"} />
            )}
          </TouchableOpacity>
        </View>

        <Pressable
          className={`items-center rounded-xl p-4 ${
            saving || isLoading
              ? "bg-blue-400"
              : "bg-[#71059f] active:bg-blue-700"
          }`}
          onPress={handleSave}
          disabled={saving || isLoading}
        >
          <Text className="font-display-semibold text-lg text-white">
            {saving ? "Saving..." : "Continue"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
