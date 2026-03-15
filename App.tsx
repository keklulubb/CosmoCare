import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from "@expo-google-fonts/fredoka";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { mockMedications } from "./src/data/mockMedications";
import {
  formatDoseForTimezone,
  getCurrentTimezone,
  getNextDose,
  getUpcomingDoses,
} from "./src/lib/schedule";
import type { MedicationSchedule } from "./src/types/medication";

const HOME_PREVIEW_COUNT = 2;
const STORAGE_KEY = "@cosmocare/reminders";
const UPCOMING_NOTIFICATION_COUNT = 3;
const WELCOME_NAME = "Traveler";
const STAR_POSITIONS = [
  { top: 54, left: 28, size: 18, opacity: 0.85, color: "#ffffff" },
  { top: 96, right: 36, size: 14, opacity: 0.65, color: "#d7c3ff" },
  { top: 150, left: 116, size: 12, opacity: 0.6, color: "#9de1ff" },
  { top: 208, right: 86, size: 16, opacity: 0.88, color: "#ffffff" },
  { top: 250, left: 314, size: 10, opacity: 0.52, color: "#d7c3ff" },
  { top: 326, left: 22, size: 20, opacity: 0.76, color: "#ffffff" },
  { top: 384, right: 30, size: 12, opacity: 0.58, color: "#9de1ff" },
  { top: 472, left: 56, size: 14, opacity: 0.72, color: "#ffffff" },
  { top: 518, right: 106, size: 18, opacity: 0.7, color: "#d7c3ff" },
  { top: 604, left: 266, size: 12, opacity: 0.62, color: "#ffffff" },
  { top: 690, left: 78, size: 16, opacity: 0.78, color: "#9de1ff" },
  { top: 764, right: 44, size: 14, opacity: 0.74, color: "#ffffff" },
];

type Screen = "home" | "detail" | "create";
type NotificationPermission = "idle" | "granted" | "denied" | "unsupported";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function getDefaultFirstDoseUtc() {
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  return nextHour.toISOString();
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  const currentTimezone = getCurrentTimezone();
  const [screen, setScreen] = useState<Screen>("home");
  const [reminders, setReminders] =
    useState<MedicationSchedule[]>(mockMedications);
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(
    mockMedications[0]?.id ?? null,
  );
  const [showAllReminders, setShowAllReminders] = useState(false);

  const [nameInput, setNameInput] = useState("");
  const [intervalInput, setIntervalInput] = useState("8");
  const [firstDoseInput, setFirstDoseInput] = useState(getDefaultFirstDoseUtc());
  const [homeTimezoneInput, setHomeTimezoneInput] = useState(currentTimezone);
  const [notesInput, setNotesInput] = useState("");
  const [formError, setFormError] = useState("");
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>(
      Platform.OS === "web" ? "unsupported" : "idle",
    );

  const visibleReminders = showAllReminders
    ? reminders
    : reminders.slice(0, HOME_PREVIEW_COUNT);

  const selectedReminder =
    reminders.find((reminder) => reminder.id === selectedReminderId) ??
    reminders[0] ??
    null;

  useEffect(() => {
    async function loadStoredReminders() {
      try {
        const storedValue = await AsyncStorage.getItem(STORAGE_KEY);

        if (!storedValue) {
          return;
        }

        const parsedValue = JSON.parse(storedValue) as MedicationSchedule[];

        if (!Array.isArray(parsedValue)) {
          return;
        }

        setReminders(parsedValue);
        setSelectedReminderId(parsedValue[0]?.id ?? null);
      } catch (error) {
        console.warn("Unable to load reminders from storage", error);
      } finally {
        setHasHydratedStorage(true);
      }
    }

    void loadStoredReminders();
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }

    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }, [hasHydratedStorage, reminders]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    async function loadNotificationPermissions() {
      const permissions = await Notifications.getPermissionsAsync();
      setNotificationPermission(permissions.granted ? "granted" : "denied");
    }

    void loadNotificationPermissions();
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }

    if (notificationPermission !== "granted" || Platform.OS === "web") {
      return;
    }

    void syncNotifications(reminders);
  }, [currentTimezone, hasHydratedStorage, notificationPermission, reminders]);

  async function configureAndroidChannel() {
    if (Platform.OS !== "android") {
      return;
    }

    await Notifications.setNotificationChannelAsync("medication-reminders", {
      name: "Medication reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: "#9B87FF",
    });
  }

  async function requestNotificationAccess() {
    if (Platform.OS === "web") {
      setNotificationPermission("unsupported");
      return false;
    }

    await configureAndroidChannel();

    const existingPermissions = await Notifications.getPermissionsAsync();
    let granted = existingPermissions.granted;

    if (!granted) {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      granted = requestedPermissions.granted;
    }

    setNotificationPermission(granted ? "granted" : "denied");
    return granted;
  }

  async function syncNotifications(remindersToSchedule: MedicationSchedule[]) {
    if (Platform.OS === "web") {
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    const upcomingDates = remindersToSchedule.flatMap((reminder) => {
      return getUpcomingDoses(reminder, UPCOMING_NOTIFICATION_COUNT).map(
        (doseUtc) => ({
          reminder,
          doseUtc,
        }),
      );
    });

    for (const { reminder, doseUtc } of upcomingDates) {
      const triggerDate = new Date(doseUtc);

      if (Number.isNaN(triggerDate.getTime())) {
        continue;
      }

      if (triggerDate.getTime() <= Date.now() + 3000) {
        continue;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${reminder.name} is due`,
          body: `Next dose scheduled for ${formatDoseForTimezone(
            doseUtc,
            currentTimezone,
          )}`,
          data: {
            reminderId: reminder.id,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
    }
  }

  async function handleEnableReminders() {
    const granted = await requestNotificationAccess();

    if (!granted) {
      return;
    }

    await syncNotifications(reminders);
  }

  function openReminder(reminderId: string) {
    setSelectedReminderId(reminderId);
    setScreen("detail");
  }

  function resetCreateForm() {
    setNameInput("");
    setIntervalInput("8");
    setFirstDoseInput(getDefaultFirstDoseUtc());
    setHomeTimezoneInput(currentTimezone);
    setNotesInput("");
    setFormError("");
  }

  function openCreateScreen() {
    resetCreateForm();
    setScreen("create");
  }

  function handleSaveReminder() {
    const trimmedName = nameInput.trim();
    const intervalHours = Number.parseInt(intervalInput, 10);
    const parsedFirstDose = new Date(firstDoseInput);

    if (!trimmedName) {
      setFormError("Add a reminder name before saving.");
      return;
    }

    if (!Number.isFinite(intervalHours) || intervalHours <= 0) {
      setFormError("Interval hours must be a number greater than 0.");
      return;
    }

    if (Number.isNaN(parsedFirstDose.getTime())) {
      setFormError("Use a valid ISO date, like 2026-03-14T21:00:00.000Z.");
      return;
    }

    const newReminder: MedicationSchedule = {
      id: `med-${Date.now()}`,
      name: trimmedName,
      intervalHours,
      firstDoseUtc: parsedFirstDose.toISOString(),
      homeTimezone: homeTimezoneInput.trim() || currentTimezone,
      notes: notesInput.trim() || undefined,
    };

    setReminders((currentReminders) => [newReminder, ...currentReminders]);
    setSelectedReminderId(newReminder.id);
    setShowAllReminders(true);
    setScreen("detail");
    resetCreateForm();
  }

  function handleDeleteReminder() {
    if (!selectedReminderId) {
      return;
    }

    const updatedReminders = reminders.filter(
      (reminder) => reminder.id !== selectedReminderId,
    );

    setReminders(updatedReminders);
    setSelectedReminderId(updatedReminders[0]?.id ?? null);

    if (updatedReminders.length <= HOME_PREVIEW_COUNT) {
      setShowAllReminders(false);
    }

    setScreen("home");
  }

  function renderBackground() {
    return (
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <LinearGradient
          colors={["#070312", "#13082e", "#1f1a63", "#11448f"]}
          locations={[0, 0.32, 0.68, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={styles.gradientBackdrop}
        />
        <LinearGradient
          colors={["rgba(164, 132, 255, 0.72)", "rgba(164, 132, 255, 0)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.nebulaGlowOne}
        />
        <LinearGradient
          colors={["rgba(110, 210, 255, 0.55)", "rgba(110, 210, 255, 0)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.nebulaGlowTwo}
        />
        <LinearGradient
          colors={["#a586ff", "#6ccfff"]}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={styles.planetGlow}
        />
        <View style={styles.planetHalo} />
        <View style={styles.orbitRingLarge} />
        <View style={styles.orbitRingSmall} />

        {STAR_POSITIONS.map((star, index) => (
          <Text
            key={index}
            style={[
              styles.starGlyph,
              {
                color: star.color,
                fontSize: star.size,
                opacity: star.opacity,
                top: star.top,
              },
              "left" in star ? { left: star.left } : { right: star.right },
            ]}
          >
            ✦
          </Text>
        ))}
      </View>
    );
  }

  function renderHomeScreen() {
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Travel-safe medication reminders</Text>
        <Text style={styles.title}>Welcome back, {WELCOME_NAME}</Text>
        <Text style={styles.heroTagline}>Where care takes orbit.</Text>
        <Text style={styles.subtitle}>
          Your schedule stays steady across timezones, flights, and late-night
          layovers.
        </Text>

        <LinearGradient
          colors={["rgba(93, 64, 197, 0.82)", "rgba(28, 74, 167, 0.78)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryCard}
        >
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Orbit board</Text>
            <View style={styles.signalPill}>
              <Text style={styles.signalText}>Travel safe</Text>
            </View>
          </View>

          <View style={styles.summaryMetrics}>
            <View style={styles.metricCard}>
              <Text style={styles.summaryLabel}>Active reminders</Text>
              <Text style={styles.summaryValue}>{reminders.length}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.summaryLabel}>Current timezone</Text>
              <Text style={styles.summaryTimezone}>{currentTimezone}</Text>
            </View>
          </View>

          <View style={styles.notificationCard}>
            <Text style={styles.notificationTitle}>Ready for takeoff</Text>
            <Text style={styles.notificationBody}>
              {Platform.OS === "web"
                ? "Web is perfect for your demo. Local device reminders are available on iOS and Android."
                : notificationPermission === "granted"
                  ? "Local reminders are armed. CosmoCare will schedule your next doses on this device."
                  : "Enable device reminders so your next dose still reaches you after a timezone jump."}
            </Text>

            {Platform.OS !== "web" && notificationPermission !== "granted" ? (
              <Pressable
                onPress={() => void handleEnableReminders()}
                style={styles.ghostButton}
              >
                <Text style={styles.ghostButtonText}>Enable reminders</Text>
              </Pressable>
            ) : null}
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your reminders</Text>
          <Pressable onPress={openCreateScreen} style={styles.primaryButton}>
            <LinearGradient
              colors={["#d5beff", "#8be0ff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonFill}
            >
              <Text style={styles.primaryButtonText}>Schedule new</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {visibleReminders.length === 0 ? (
          <LinearGradient
            colors={["rgba(64, 35, 125, 0.88)", "rgba(17, 42, 89, 0.88)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyCard}
          >
            <Text style={styles.emptyTitle}>No reminders in orbit yet</Text>
            <Text style={styles.emptyBody}>
              Schedule your first travel-safe reminder to get started.
            </Text>
          </LinearGradient>
        ) : null}

        {visibleReminders.map((reminder) => {
          const nextDoseUtc = getNextDose(reminder);
          const nextDoseLocal = formatDoseForTimezone(
            nextDoseUtc,
            currentTimezone,
          );

          return (
            <Pressable
              key={reminder.id}
              onPress={() => openReminder(reminder.id)}
              style={styles.reminderPressable}
            >
              <LinearGradient
                colors={["rgba(63, 32, 121, 0.9)", "rgba(17, 44, 94, 0.88)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.reminderCard}
              >
                <View style={styles.cardOrbit} />
                <Text style={styles.reminderName}>{reminder.name}</Text>
                <Text style={styles.reminderMeta}>
                  Every {reminder.intervalHours} hours
                </Text>
                <Text style={styles.cardLabel}>Next dose here</Text>
                <Text style={styles.nextDoseText}>{nextDoseLocal}</Text>
              </LinearGradient>
            </Pressable>
          );
        })}

        {reminders.length > HOME_PREVIEW_COUNT ? (
          <Pressable
            onPress={() => setShowAllReminders((currentValue) => !currentValue)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {showAllReminders ? "Show less" : "Show more"}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    );
  }

  function renderDetailScreen() {
    if (!selectedReminder) {
      return renderHomeScreen();
    }

    const nextDoseUtc = getNextDose(selectedReminder);
    const nextDoseLocal = formatDoseForTimezone(nextDoseUtc, currentTimezone);
    const upcomingDoses = getUpcomingDoses(selectedReminder, 3);

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => setScreen("home")} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to reminders</Text>
        </Pressable>

        <Text style={styles.title}>{selectedReminder.name}</Text>
        <Text style={styles.subtitle}>
          A full orbit overview for this reminder while you travel.
        </Text>

        <LinearGradient
          colors={["rgba(63, 32, 121, 0.9)", "rgba(17, 44, 94, 0.88)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.detailCard}
        >
          <Text style={styles.cardLabel}>Next dose here</Text>
          <Text style={styles.heroValue}>{nextDoseLocal}</Text>

          <Text style={styles.cardLabel}>Next dose (UTC)</Text>
          <Text style={styles.cardValue}>{nextDoseUtc}</Text>

          <Text style={styles.cardLabel}>Interval</Text>
          <Text style={styles.cardValue}>
            Every {selectedReminder.intervalHours} hours
          </Text>

          <Text style={styles.cardLabel}>First dose (UTC)</Text>
          <Text style={styles.cardValue}>{selectedReminder.firstDoseUtc}</Text>

          <Text style={styles.cardLabel}>Home timezone</Text>
          <Text style={styles.cardValue}>{selectedReminder.homeTimezone}</Text>

          {selectedReminder.notes ? (
            <>
              <Text style={styles.cardLabel}>Notes</Text>
              <Text style={styles.cardValue}>{selectedReminder.notes}</Text>
            </>
          ) : null}

          <Text style={styles.cardLabel}>Upcoming doses</Text>
          {upcomingDoses.map((doseUtc, index) => (
            <Text key={`${doseUtc}-${index}`} style={styles.upcomingDose}>
              {index + 1}. {formatDoseForTimezone(doseUtc, currentTimezone)}
            </Text>
          ))}
        </LinearGradient>

        <Pressable onPress={openCreateScreen} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Schedule another</Text>
        </Pressable>

        <Pressable onPress={handleDeleteReminder} style={styles.dangerButton}>
          <Text style={styles.dangerButtonText}>Delete reminder</Text>
        </Pressable>
      </ScrollView>
    );
  }

  function renderCreateScreen() {
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => setScreen("home")} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to reminders</Text>
        </Pressable>

        <Text style={styles.title}>Schedule new</Text>
        <Text style={styles.subtitle}>
          Build a new reminder and keep it steady across timezone changes.
        </Text>

        <LinearGradient
          colors={["rgba(63, 32, 121, 0.9)", "rgba(17, 44, 94, 0.88)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.detailCard}
        >
          <Text style={styles.inputLabel}>Reminder name</Text>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="Amoxicillin"
            placeholderTextColor="#b9aef2"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>Interval hours</Text>
          <TextInput
            value={intervalInput}
            onChangeText={setIntervalInput}
            placeholder="8"
            placeholderTextColor="#b9aef2"
            keyboardType="number-pad"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>First dose (UTC ISO)</Text>
          <TextInput
            value={firstDoseInput}
            onChangeText={setFirstDoseInput}
            placeholder="2026-03-14T21:00:00.000Z"
            placeholderTextColor="#b9aef2"
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.helperText}>
            For the hackathon version, use a full UTC time ending in Z.
          </Text>

          <Text style={styles.inputLabel}>Home timezone</Text>
          <TextInput
            value={homeTimezoneInput}
            onChangeText={setHomeTimezoneInput}
            placeholder="Europe/Amsterdam"
            placeholderTextColor="#b9aef2"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>Notes</Text>
          <TextInput
            value={notesInput}
            onChangeText={setNotesInput}
            placeholder="Take after food"
            placeholderTextColor="#b9aef2"
            multiline
            style={[styles.input, styles.notesInput]}
          />

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <Pressable onPress={handleSaveReminder} style={styles.primaryButton}>
            <LinearGradient
              colors={["#d5beff", "#8be0ff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonFill}
            >
              <Text style={styles.primaryButtonText}>Save reminder</Text>
            </LinearGradient>
          </Pressable>
        </LinearGradient>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {renderBackground()}
      {fontsLoaded ? (
        <>
          {screen === "home" ? renderHomeScreen() : null}
          {screen === "detail" ? renderDetailScreen() : null}
          {screen === "create" ? renderCreateScreen() : null}
        </>
      ) : null}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070312",
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  gradientBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  nebulaGlowOne: {
    borderRadius: 260,
    height: 520,
    left: -120,
    position: "absolute",
    top: -80,
    width: 520,
  },
  nebulaGlowTwo: {
    borderRadius: 220,
    height: 440,
    position: "absolute",
    right: -110,
    top: 250,
    width: 440,
  },
  planetGlow: {
    borderRadius: 110,
    height: 220,
    position: "absolute",
    right: -26,
    top: 94,
    width: 220,
  },
  planetHalo: {
    borderColor: "rgba(233, 226, 255, 0.28)",
    borderRadius: 150,
    borderWidth: 1.5,
    height: 280,
    position: "absolute",
    right: -56,
    top: 58,
    width: 280,
  },
  orbitRingLarge: {
    borderColor: "rgba(167, 214, 255, 0.16)",
    borderRadius: 260,
    borderWidth: 1.25,
    height: 520,
    left: -170,
    position: "absolute",
    top: 430,
    width: 520,
  },
  orbitRingSmall: {
    borderColor: "rgba(215, 195, 255, 0.18)",
    borderRadius: 170,
    borderWidth: 1.25,
    height: 340,
    position: "absolute",
    right: -90,
    top: 520,
    width: 340,
  },
  starGlyph: {
    position: "absolute",
    textShadowColor: "rgba(255, 255, 255, 0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 72,
    paddingHorizontal: 24,
    paddingTop: 78,
  },
  eyebrow: {
    color: "#8be0ff",
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 13,
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    color: "#ffffff",
    fontFamily: "Fredoka_700Bold",
    fontSize: 36,
    lineHeight: 40,
  },
  heroTagline: {
    color: "#ead9ff",
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 20,
    marginTop: 8,
  },
  subtitle: {
    color: "#d7cdf5",
    fontFamily: "Fredoka_500Medium",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
    maxWidth: 320,
  },
  summaryCard: {
    borderColor: "rgba(221, 210, 255, 0.18)",
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 28,
    overflow: "hidden",
    padding: 18,
  },
  summaryHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryTitle: {
    color: "#ffffff",
    fontFamily: "Fredoka_700Bold",
    fontSize: 22,
  },
  signalPill: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  signalText: {
    color: "#ffffff",
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  summaryMetrics: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  metricCard: {
    backgroundColor: "rgba(11, 10, 38, 0.42)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    minHeight: 102,
    padding: 14,
  },
  summaryLabel: {
    color: "#d9d2ff",
    fontFamily: "Fredoka_500Medium",
    fontSize: 14,
  },
  summaryValue: {
    color: "#ffffff",
    fontFamily: "Fredoka_700Bold",
    fontSize: 28,
    marginTop: 10,
  },
  summaryTimezone: {
    color: "#ffffff",
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 15,
    lineHeight: 20,
    marginTop: 10,
  },
  notificationCard: {
    backgroundColor: "rgba(11, 10, 38, 0.32)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  notificationTitle: {
    color: "#ffffff",
    fontFamily: "Fredoka_700Bold",
    fontSize: 16,
  },
  notificationBody: {
    color: "#e5ddff",
    fontFamily: "Fredoka_500Medium",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  ghostButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ghostButtonText: {
    color: "#ffffff",
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 14,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 28,
  },
  sectionTitle: {
    color: "#ffffff",
    fontFamily: "Fredoka_700Bold",
    fontSize: 24,
  },
  primaryButton: {
    borderRadius: 999,
    overflow: "hidden",
  },
  primaryButtonFill: {
    borderRadius: 999,
    minWidth: 136,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#1c1344",
    fontFamily: "Fredoka_700Bold",
    fontSize: 15,
    textAlign: "center",
  },
  reminderPressable: {
    marginTop: 14,
  },
  reminderCard: {
    borderColor: "rgba(227, 215, 255, 0.16)",
    borderRadius: 26,
    borderWidth: 1,
    minHeight: 156,
    overflow: "hidden",
    padding: 20,
    position: "relative",
  },
  cardOrbit: {
    borderColor: "rgba(194, 230, 255, 0.22)",
    borderRadius: 120,
    borderWidth: 1.5,
    height: 200,
    position: "absolute",
    right: -72,
    top: -40,
    width: 200,
  },
  reminderName: {
    color: "#ffffff",
    fontFamily: "Fredoka_700Bold",
    fontSize: 24,
  },
  reminderMeta: {
    color: "#ded8ff",
    fontFamily: "Fredoka_500Medium",
    fontSize: 15,
    marginTop: 8,
  },
  cardLabel: {
    color: "#9ce4ff",
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.2,
    marginTop: 16,
  },
  nextDoseText: {
    color: "#ffffff",
    fontFamily: "Fredoka_700Bold",
    fontSize: 18,
    lineHeight: 24,
    marginTop: 6,
    maxWidth: 240,
  },
  emptyCard: {
    borderColor: "rgba(227, 215, 255, 0.16)",
    borderRadius: 26,
    borderWidth: 1,
    marginTop: 14,
    overflow: "hidden",
    padding: 20,
  },
  emptyTitle: {
    color: "#ffffff",
    fontFamily: "Fredoka_700Bold",
    fontSize: 22,
  },
  emptyBody: {
    color: "#dfd8ff",
    fontFamily: "Fredoka_500Medium",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  backButtonText: {
    color: "#9ce4ff",
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 15,
  },
  detailCard: {
    borderColor: "rgba(227, 215, 255, 0.16)",
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 24,
    overflow: "hidden",
    padding: 20,
  },
  heroValue: {
    color: "#ffffff",
    fontFamily: "Fredoka_700Bold",
    fontSize: 27,
    lineHeight: 34,
    marginTop: 8,
  },
  cardValue: {
    color: "#f4efff",
    fontFamily: "Fredoka_500Medium",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 6,
  },
  upcomingDose: {
    color: "#ffffff",
    fontFamily: "Fredoka_500Medium",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  secondaryButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 15,
  },
  dangerButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 117, 173, 0.16)",
    borderColor: "rgba(255, 154, 196, 0.28)",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 12,
  },
  dangerButtonText: {
    color: "#ffd6e7",
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 15,
  },
  inputLabel: {
    color: "#ffffff",
    fontFamily: "Fredoka_600SemiBold",
    fontSize: 15,
    marginTop: 16,
  },
  input: {
    backgroundColor: "rgba(11, 10, 38, 0.34)",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 20,
    borderWidth: 1,
    color: "#ffffff",
    fontFamily: "Fredoka_500Medium",
    fontSize: 15,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  helperText: {
    color: "#d4c7ff",
    fontFamily: "Fredoka_500Medium",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  errorText: {
    color: "#ffb9d7",
    fontFamily: "Fredoka_500Medium",
    fontSize: 14,
    marginTop: 16,
  },
});
