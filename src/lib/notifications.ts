import * as Notifications from "expo-notifications";
import {
  getNotificationSettings,
  getLastNotifiedTimestamp,
  setLastNotifiedTimestamp,
} from "@/src/lib/storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export function isInSleepHours(): boolean {
  const s = getNotificationSettings();
  if (!s.sleepHoursEnabled) return false;

  const hour = new Date().getHours();
  const { sleepHoursStart, sleepHoursEnd } = s;

  if (sleepHoursStart === sleepHoursEnd) return false;
  if (sleepHoursStart > sleepHoursEnd) {
    return hour >= sleepHoursStart || hour < sleepHoursEnd;
  }
  return hour >= sleepHoursStart && hour < sleepHoursEnd;
}

export function shouldSendNotification(): boolean {
  const s = getNotificationSettings();
  if (!s.enabled) return false;

  const now = Date.now();
  const last = getLastNotifiedTimestamp();

  switch (s.frequency) {
    case "hourly":
      return now - last >= 3_600_000;
    case "every_4_hours":
      return now - last >= 14_400_000;
    case "daily_6pm": {
      const h = new Date().getHours();
      if (h < 17 || h >= 19) return false;
      if (last > 0) {
        const d1 = new Date(last);
        const d2 = new Date();
        if (
          d1.getFullYear() === d2.getFullYear() &&
          d1.getMonth() === d2.getMonth() &&
          d1.getDate() === d2.getDate()
        )
          return false;
      }
      return true;
    }
    default:
      return false;
  }
}

export async function sendNewThreadNotification(
  courseCode: string,
  count: number,
  courseId: number,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: `course-${courseId}`,
    content: {
      title: `New threads in ${courseCode}`,
      body: `${count} new discussion thread${count > 1 ? "s" : ""}`,
      data: { courseId, type: "new_threads" },
    },
    trigger: null,
  });
  setLastNotifiedTimestamp(Date.now());
}

export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "EdGo Test",
      body: "This is a test notification from EdGo.",
      data: { type: "test" },
    },
    trigger: null,
  });
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
