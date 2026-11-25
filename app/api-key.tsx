import { Effect } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";
import { Image } from "expo-image";
import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  BellRingingIcon,
  CaretDownIcon,
  CaretUpIcon,
  CheckIcon,
  DeviceMobileIcon,
  EyeClosedIcon,
  EyeIcon,
  GlobeIcon,
  MoonIcon,
  SunIcon,
} from "phosphor-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Uniwind, useUniwind } from "uniwind";
import LinkText from "@/src/components/LinkText";
import RecentThreadCard from "@/src/components/RecentThreadCard";
import { requestNotificationPermissions } from "@/src/lib/notifications";
import { RegionResponse, UserResponse } from "@/src/lib/schema";
import {
  getThemePreference,
  setNotificationSetting,
  setThemePreference,
  settings,
  type ThemePreference,
} from "@/src/lib/storage";
import { useApiKey } from "@/src/providers/keyProvider";

import "@/global.css";

type OnboardingStep = 1 | 2 | 3;

type EdRegion = "us" | "au" | "eu";
type RegionOptionId = "us" | "ca" | "au" | "eu" | "uk";

const REGIONS: {
  id: RegionOptionId;
  code: EdRegion;
  label: string;
  domainLabel: string;
}[] = [
  {
    id: "us",
    code: "us",
    label: "United States",
    domainLabel: "edstem.org/us",
  },
  { id: "ca", code: "us", label: "Canada", domainLabel: "edstem.org/us" },
  { id: "au", code: "au", label: "Australia", domainLabel: "edstem.org/au" },
  { id: "eu", code: "eu", label: "Europe", domainLabel: "edstem.org/eu" },
  {
    id: "uk",
    code: "eu",
    label: "United Kingdom",
    domainLabel: "edstem.org/eu",
  },
];

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
}[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function isSupportedRegion(value: string): value is EdRegion {
  return value === "us" || value === "au" || value === "eu";
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { setApiKey, isLoading } = useApiKey();
  const { theme } = useUniwind();
  const isDark = theme === "dark";

  const [step, setStep] = useState<OnboardingStep>(1);

  // Step 1: API Key & Region
  const [regionOption, setRegionOption] = useState<RegionOptionId>("us");
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [validatedKey, setValidatedKey] = useState<string | null>(null);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 2: UI Preferences
  const [themePref, setThemePref] =
    useState<ThemePreference>(getThemePreference);
  const [largerCards = false, setLargerCards] = useMMKVBoolean(
    "ui.larger_cards",
    settings ?? undefined,
  );

  // Step 3: Notifications
  const [finishing, setFinishing] = useState(false);

  // Handle Android hardware back button within onboarding flow
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step > 1) {
        setStep((s) => (s > 1 ? ((s - 1) as OnboardingStep) : s));
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  // Auto-detect user's region on mount
  useEffect(() => {
    let cancelled = false;
    const detectRegion = Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const request = HttpClientRequest.get(
        "https://edstem.org/api/region",
      ).pipe(HttpClientRequest.acceptJson);
      const response = yield* client.execute(request);
      return yield* HttpClientResponse.schemaBodyJson(RegionResponse)(response);
    }).pipe(Effect.provide(FetchHttpClient.layer));

    Effect.runPromise(detectRegion)
      .then((res) => {
        if (cancelled) return;
        const country = res.country_code.toUpperCase();
        const normalized = res.default_region.toLowerCase();
        if (country === "CA") {
          setRegionOption("ca");
        } else if (country === "GB" || country === "UK") {
          setRegionOption("uk");
        } else if (isSupportedRegion(normalized)) {
          setRegionOption(normalized);
        }
        settings?.set("user.country_code", res.country_code);
      })
      .catch(() => {
        // Silent fallback to default "us"
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRegionInfo =
    REGIONS.find((r) => r.id === regionOption) ?? REGIONS[0];
  const region = selectedRegionInfo.code;
  const tokenUrl = `https://edstem.org/${region}/settings/api-tokens`;

  const validateApiKey = (apiKey: string) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const request = HttpClientRequest.get("https://edstem.org/api/user").pipe(
        HttpClientRequest.bearerToken(apiKey),
        HttpClientRequest.acceptJson,
      );
      const response = yield* client.execute(request);
      if (response.status !== 200) {
        return null;
      }
      const user =
        yield* HttpClientResponse.schemaBodyJson(UserResponse)(response);
      settings?.set("user.name", user.user.name);
      settings?.set("user.email", user.user.email);
      settings?.set("user.default_region", region);
      if (settings && !settings.contains("user.country_code")) {
        settings.set("user.country_code", region.toUpperCase());
      }
      if (settings && !settings.contains("user.developer_settings")) {
        settings.set("user.developer_settings", false);
      }
      return user.user.name;
    }).pipe(Effect.provide(FetchHttpClient.layer));

  const handleVerifyKey = async () => {
    const trimmed = inputKey.trim();
    if (!trimmed) {
      setErrorMessage("Please enter your EdSTEM API key.");
      return;
    }

    setErrorMessage(null);
    setVerifying(true);
    try {
      const name = await Effect.runPromise(validateApiKey(trimmed));
      if (!name) {
        setErrorMessage(
          "That API key could not be verified. Double-check it and try again.",
        );
        return;
      }
      setValidatedKey(trimmed);
      setVerifiedName(name);
      setStep(2);
    } catch (error) {
      console.error("Failed to validate API key:", error);
      setErrorMessage(
        "Could not reach EdSTEM. Please check your internet connection.",
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleThemeSelect = (next: ThemePreference) => {
    setThemePref(next);
    setThemePreference(next);
    Uniwind.setTheme(next);
  };

  const handleFinish = async (enableNotifications: boolean) => {
    if (!validatedKey || finishing) return;
    setFinishing(true);
    try {
      if (enableNotifications) {
        const granted = await requestNotificationPermissions();
        setNotificationSetting("enabled", granted);
      } else {
        setNotificationSetting("enabled", false);
      }
      await setApiKey(validatedKey);
    } catch (error) {
      console.error("Failed to finish onboarding:", error);
      setErrorMessage(
        "Something went wrong saving your setup. Please try again.",
      );
      setFinishing(false);
    }
  };

  const iconColor = isDark ? "#ffffff" : "#000000";
  const mutedIconColor = isDark ? "#a3a3a3" : "#525252";

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-black"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Top Left Back Button & Progress Bar */}
      <View className="w-full px-4 pt-3 pb-2">
        <View className="mb-3 min-h-10 flex-row items-center">
          {step > 1 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() =>
                setStep((s) => (s > 1 ? ((s - 1) as OnboardingStep) : s))
              }
              className="flex-row items-center gap-x-1.5 rounded-xl border border-neutral-300 bg-white px-3 py-2 active:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:active:bg-neutral-800"
            >
              <ArrowLeftIcon size={16} color={iconColor} />
              <Text className="font-display-medium text-sm text-neutral-900 dark:text-neutral-100">
                Back
              </Text>
            </Pressable>
          )}
        </View>
        <View className="mx-auto w-full max-w-md flex-row gap-x-2 px-2">
          {([1, 2, 3] as OnboardingStep[]).map((idx) => (
            <View
              key={idx}
              className={`h-1.5 flex-1 rounded-full ${
                idx <= step
                  ? "bg-[#71059f]"
                  : "bg-neutral-200 dark:bg-neutral-800"
              }`}
            />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-md self-center">
          {/* STEP 1: API KEY & REGION */}
          {step === 1 && (
            <View className="gap-y-5">
              <View className="items-center">
                <Image
                  source={require("@/assets/images/icon.png")}
                  contentFit="cover"
                  transition={400}
                  style={{ width: 96, height: 96, borderRadius: 24 }}
                />
                <Text className="font-display-black mt-4 text-center text-4xl text-black dark:text-white">
                  Welcome to EdGo
                </Text>
                <Text className="font-display-medium mt-1.5 text-center text-base text-neutral-600 dark:text-neutral-400">
                  Connect your EdSTEM account with an API token to get started.
                </Text>
              </View>

              {/* Region Dropdown */}
              <View className="gap-y-1.5">
                <Text className="font-display-semibold text-sm text-neutral-700 dark:text-neutral-300">
                  Region
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Select EdSTEM region"
                  onPress={() => setRegionMenuOpen((open) => !open)}
                  className="flex-row items-center justify-between rounded-xl border border-neutral-300 bg-neutral-100 px-4 py-3.5 dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <View className="flex-row items-center gap-x-2.5">
                    <GlobeIcon size={20} color="#71059f" />
                    <Text className="font-display-semibold text-base text-black dark:text-white">
                      {selectedRegionInfo.label}
                    </Text>
                    <Text className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                      ({selectedRegionInfo.code.toUpperCase()})
                    </Text>
                  </View>
                  {regionMenuOpen ? (
                    <CaretUpIcon size={18} color={mutedIconColor} />
                  ) : (
                    <CaretDownIcon size={18} color={mutedIconColor} />
                  )}
                </Pressable>

                {regionMenuOpen && (
                  <View className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
                    {REGIONS.map((item, idx) => {
                      const isSelected = item.id === regionOption;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => {
                            setRegionOption(item.id);
                            setRegionMenuOpen(false);
                          }}
                          className={`flex-row items-center justify-between px-4 py-3 ${
                            idx > 0
                              ? "border-t border-neutral-200 dark:border-neutral-800"
                              : ""
                          } ${
                            isSelected
                              ? "bg-purple-50 dark:bg-purple-950/40"
                              : ""
                          }`}
                        >
                          <View>
                            <Text className="font-display-semibold text-base text-black dark:text-white">
                              {item.label}
                            </Text>
                            <Text className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                              {item.domainLabel} ({item.code.toUpperCase()})
                            </Text>
                          </View>
                          {isSelected && (
                            <CheckIcon
                              size={18}
                              color="#71059f"
                              weight="bold"
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Dynamic Region Link */}
              <View className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 p-3.5 dark:border-neutral-800 dark:bg-neutral-900">
                <Text className="font-display-medium mb-1 text-xs text-neutral-600 dark:text-neutral-400">
                  Get your API token from here:
                </Text>
                <LinkText href={tokenUrl}>
                  <View className="w-full flex-row items-center gap-x-1.5">
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="middle"
                      className="min-w-0 flex-1 font-mono text-xs text-purple-700 underline dark:text-purple-400"
                    >
                      {tokenUrl}
                    </Text>
                    <View className="shrink-0">
                      <ArrowSquareOutIcon
                        size={14}
                        color={isDark ? "#c084fc" : "#7e22ce"}
                      />
                    </View>
                  </View>
                </LinkText>
              </View>

              {/* API Key Input */}
              <View className="gap-y-1.5">
                <Text className="font-display-semibold text-sm text-neutral-700 dark:text-neutral-300">
                  API Key
                </Text>
                <View className="flex-row items-center rounded-xl border border-neutral-300 bg-white pr-2 dark:border-neutral-700 dark:bg-neutral-900">
                  <TextInput
                    className="h-12 flex-1 px-4 py-0 font-mono text-sm text-black dark:text-white"
                    placeholder="Paste your EdSTEM API key"
                    placeholderTextColor={isDark ? "#737373" : "#a3a3a3"}
                    value={inputKey}
                    onChangeText={(text) => {
                      setInputKey(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    textAlignVertical="center"
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showKey}
                    editable={!verifying && !isLoading}
                    returnKeyType="done"
                    onSubmitEditing={handleVerifyKey}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={
                      showKey ? "Hide API key" : "Show API key"
                    }
                    onPress={() => setShowKey((prev) => !prev)}
                    className="size-10 items-center justify-center rounded-lg"
                  >
                    {showKey ? (
                      <EyeIcon size={20} color={mutedIconColor} />
                    ) : (
                      <EyeClosedIcon size={20} color={mutedIconColor} />
                    )}
                  </TouchableOpacity>
                </View>

                {errorMessage && (
                  <Text className="font-display-medium text-sm text-red-600 dark:text-red-400">
                    {errorMessage}
                  </Text>
                )}
              </View>

              <Pressable
                className={`mt-1 flex-row items-center justify-center gap-x-2 rounded-xl p-4 ${
                  verifying || isLoading
                    ? "bg-purple-400"
                    : "bg-[#71059f] active:bg-purple-900"
                }`}
                onPress={handleVerifyKey}
                disabled={verifying || isLoading}
              >
                {verifying && <ActivityIndicator size="small" color="white" />}
                <Text className="font-display-semibold text-lg text-white">
                  {verifying ? "Verifying..." : "Verify & Continue"}
                </Text>
              </Pressable>
            </View>
          )}

          {/* STEP 2: UI CHOICES (THEME & COMPACT CARDS) */}
          {step === 2 && (
            <View className="gap-y-6">
              <View>
                <Text className="font-display-black text-3xl text-black dark:text-white">
                  {verifiedName
                    ? `Hi, ${verifiedName.split(" ")[0]}!`
                    : "Make it yours"}
                </Text>
                <Text className="font-display-medium mt-1 text-base text-neutral-600 dark:text-neutral-400">
                  Choose how EdGo looks. You can change these anytime in
                  Settings.
                </Text>
              </View>

              {/* Theme Override (Icon-only buttons) */}
              <View className="gap-y-2.5">
                <Text className="font-display-semibold text-base text-black dark:text-white">
                  Appearance
                </Text>
                <View className="flex-row gap-x-2.5">
                  {THEME_OPTIONS.map((opt) => {
                    const selected = themePref === opt.value;
                    const optIconColor = selected ? "#ffffff" : iconColor;
                    return (
                      <Pressable
                        key={opt.value}
                        accessibilityRole="button"
                        accessibilityLabel={opt.label}
                        accessibilityState={{ selected }}
                        onPress={() => handleThemeSelect(opt.value)}
                        className={`flex-1 items-center justify-center rounded-xl border py-4 ${
                          selected
                            ? "border-[#71059f] bg-[#71059f]"
                            : "border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
                        }`}
                      >
                        {opt.value === "system" && (
                          <DeviceMobileIcon size={24} color={optIconColor} />
                        )}
                        {opt.value === "light" && (
                          <SunIcon size={24} color={optIconColor} />
                        )}
                        {opt.value === "dark" && (
                          <MoonIcon size={24} color={optIconColor} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Card Density */}
              <View className="gap-y-2.5">
                <Text className="font-display-semibold text-base text-black dark:text-white">
                  Card Layout
                </Text>
                <View className="flex-row gap-x-2.5">
                  <Pressable
                    onPress={() => setLargerCards(false)}
                    className={`flex-1 items-center rounded-xl border py-3.5 ${
                      !largerCards
                        ? "border-[#71059f] bg-[#71059f]"
                        : "border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
                    }`}
                  >
                    <Text
                      className={`font-display-semibold text-sm ${
                        !largerCards
                          ? "text-white"
                          : "text-black dark:text-white"
                      }`}
                    >
                      Compact
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setLargerCards(true)}
                    className={`flex-1 items-center rounded-xl border py-3.5 ${
                      largerCards
                        ? "border-[#71059f] bg-[#71059f]"
                        : "border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
                    }`}
                  >
                    <Text
                      className={`font-display-semibold text-sm ${
                        largerCards
                          ? "text-white"
                          : "text-black dark:text-white"
                      }`}
                    >
                      Comfortable
                    </Text>
                  </Pressable>
                </View>

                {/* Live Preview using actual RecentThreadCard */}
                <View className="mt-1 rounded-2xl border border-neutral-200 bg-neutral-100 pt-3 pb-1 px-2 dark:border-neutral-800 dark:bg-neutral-900">
                  <Text className="font-display-medium mb-2 px-1.5 text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Preview
                  </Text>
                  <RecentThreadCard
                    title="Assignment 2 clarification on recursion"
                    courseCode="CS101"
                    colour="#16DB93"
                    replyCount={12}
                    viewCount={84}
                    voteCount={9}
                    largerCards={largerCards}
                  />
                  <RecentThreadCard
                    title="Lecture 8 notes and practice problems"
                    courseCode="MATH204"
                    colour="#F72585"
                    replyCount={4}
                    viewCount={51}
                    voteCount={6}
                    largerCards={largerCards}
                  />
                </View>
              </View>

              <Pressable
                className="items-center rounded-xl bg-[#71059f] p-4 active:bg-purple-900"
                onPress={() => setStep(3)}
              >
                <Text className="font-display-semibold text-lg text-white">
                  Continue
                </Text>
              </Pressable>
            </View>
          )}

          {/* STEP 3: NOTIFICATIONS */}
          {step === 3 && (
            <View className="items-center gap-y-6">
              <View className="size-24 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950/60">
                <BellRingingIcon
                  size={44}
                  color={isDark ? "#c084fc" : "#71059f"}
                  weight="duotone"
                />
              </View>

              <View className="items-center gap-y-2">
                <Text className="font-display-black text-center text-3xl text-black dark:text-white">
                  Notifications
                </Text>
                <Text className="font-display-medium text-center text-base text-neutral-600 dark:text-neutral-400">
                  Get notified when new discussion threads are posted in your
                  courses. You can customize sync frequency and sleep hours
                  anytime in Settings.
                </Text>
              </View>

              <View className="w-full flex-row gap-x-3 pt-2">
                <Pressable
                  className="flex-1 flex-row items-center justify-center gap-x-2 rounded-xl border border-neutral-300 bg-neutral-100 p-4 active:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:active:bg-neutral-800"
                  onPress={() => handleFinish(false)}
                  disabled={finishing}
                >
                  <Text className="font-display-semibold text-base text-black dark:text-white">
                    Disabled
                  </Text>
                </Pressable>

                <Pressable
                  className="flex-1 flex-row items-center justify-center gap-x-2 rounded-xl border border-neutral-300 bg-neutral-100 p-4 active:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:active:bg-neutral-800"
                  onPress={() => handleFinish(true)}
                  disabled={finishing}
                >
                  {finishing && (
                    <ActivityIndicator size="small" color={iconColor} />
                  )}
                  <Text className="font-display-semibold text-base text-black dark:text-white">
                    Enabled
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
