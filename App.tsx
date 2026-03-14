import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
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
const WELCOME_NAME = "Traveler";

type Screen = "home" | "detail" | "create";

function getDefaultFirstDoseUtc() {
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  return nextHour.toISOString();
}

export default function App() {
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

  const visibleReminders = showAllReminders
    ? reminders
    : reminders.slice(0, HOME_PREVIEW_COUNT);

  const selectedReminder =
    reminders.find((reminder) => reminder.id === selectedReminderId) ??
    reminders[0] ??
    null;

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

  function renderHomeScreen() {
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <Text style={styles.eyebrow}>Travel-safe medication reminders</Text>
        <Text style={styles.title}>Welcome back, {WELCOME_NAME}</Text>
        <Text style={styles.subtitle}>
          Your reminders stay aligned while your timezone changes.
        </Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Active reminders</Text>
            <Text style={styles.summaryValue}>{reminders.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Current timezone</Text>
            <Text style={styles.summaryTimezone}>{currentTimezone}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your reminders</Text>
          <Pressable onPress={openCreateScreen} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Schedule new</Text>
          </Pressable>
        </View>

        {visibleReminders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No reminders in orbit yet</Text>
            <Text style={styles.emptyBody}>
              Schedule your first travel-safe reminder to get started.
            </Text>
          </View>
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
              style={styles.reminderCard}
            >
              <Text style={styles.reminderName}>{reminder.name}</Text>
              <Text style={styles.reminderMeta}>
                Every {reminder.intervalHours} hours
              </Text>
              <Text style={styles.cardLabel}>Next dose here</Text>
              <Text style={styles.nextDoseText}>{nextDoseLocal}</Text>
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
      >
        <Pressable onPress={() => setScreen("home")} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to reminders</Text>
        </Pressable>

        <Text style={styles.title}>{selectedReminder.name}</Text>
        <Text style={styles.subtitle}>
          Full overview for this reminder while traveling.
        </Text>

        <View style={styles.detailCard}>
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
        </View>

        <Pressable onPress={openCreateScreen} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Schedule another</Text>
        </Pressable>

        <Pressable onPress={handleDeleteReminder} style={styles.dangerButton}>
          <Text style={styles.dangerButtonText}>Remove reminder</Text>
        </Pressable>
      </ScrollView>
    );
  }

  function renderCreateScreen() {
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Pressable onPress={() => setScreen("home")} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to reminders</Text>
        </Pressable>

        <Text style={styles.title}>Schedule new</Text>
        <Text style={styles.subtitle}>
          Add a reminder and keep its schedule anchored while you travel.
        </Text>

        <View style={styles.detailCard}>
          <Text style={styles.inputLabel}>Reminder name</Text>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="Amoxicillin"
            placeholderTextColor="#6f7a9c"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>Interval hours</Text>
          <TextInput
            value={intervalInput}
            onChangeText={setIntervalInput}
            placeholder="8"
            placeholderTextColor="#6f7a9c"
            keyboardType="number-pad"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>First dose (UTC ISO)</Text>
          <TextInput
            value={firstDoseInput}
            onChangeText={setFirstDoseInput}
            placeholder="2026-03-14T21:00:00.000Z"
            placeholderTextColor="#6f7a9c"
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.helperText}>
            Use a full UTC time ending in Z for this hackathon version.
          </Text>

          <Text style={styles.inputLabel}>Home timezone</Text>
          <TextInput
            value={homeTimezoneInput}
            onChangeText={setHomeTimezoneInput}
            placeholder="Europe/Amsterdam"
            placeholderTextColor="#6f7a9c"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>Notes</Text>
          <TextInput
            value={notesInput}
            onChangeText={setNotesInput}
            placeholder="Take after food"
            placeholderTextColor="#6f7a9c"
            multiline
            style={[styles.input, styles.notesInput]}
          />

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <Pressable onPress={handleSaveReminder} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Save reminder</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {screen === "home" ? renderHomeScreen() : null}
      {screen === "detail" ? renderDetailScreen() : null}
      {screen === "create" ? renderCreateScreen() : null}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1020",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 84,
    paddingBottom: 40,
  },
  eyebrow: {
    color: "#87c6ff",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "700",
  },
  subtitle: {
    color: "#9aa4c7",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  summaryCard: {
    backgroundColor: "#12182d",
    borderColor: "#1f2a4d",
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 24,
    padding: 18,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  summaryLabel: {
    color: "#9aa4c7",
    fontSize: 14,
  },
  summaryValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  summaryTimezone: {
    color: "#d4dcf8",
    fontSize: 15,
    fontWeight: "600",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  reminderCard: {
    backgroundColor: "#151b31",
    borderColor: "#212b4f",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    padding: 18,
  },
  emptyCard: {
    backgroundColor: "#151b31",
    borderColor: "#212b4f",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    padding: 18,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyBody: {
    color: "#9aa4c7",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  reminderName: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  reminderMeta: {
    color: "#8f99bc",
    fontSize: 15,
    marginTop: 6,
  },
  cardLabel: {
    color: "#8ca0d4",
    fontSize: 13,
    marginTop: 14,
  },
  nextDoseText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 6,
  },
  detailCard: {
    backgroundColor: "#12182d",
    borderColor: "#1f2a4d",
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 24,
    padding: 20,
  },
  heroValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 6,
  },
  cardValue: {
    color: "#e8edff",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 6,
  },
  upcomingDose: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  backButtonText: {
    color: "#87c6ff",
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#87c6ff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#07111f",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#2a355d",
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#d6defb",
    fontSize: 15,
    fontWeight: "600",
  },
  dangerButton: {
    alignItems: "center",
    backgroundColor: "#2a1218",
    borderColor: "#5a2530",
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 12,
  },
  dangerButtonText: {
    color: "#ffb7c3",
    fontSize: 15,
    fontWeight: "700",
  },
  inputLabel: {
    color: "#d6defb",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 16,
  },
  input: {
    backgroundColor: "#0d1325",
    borderColor: "#263157",
    borderRadius: 14,
    borderWidth: 1,
    color: "#ffffff",
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
    color: "#8590b2",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  errorText: {
    color: "#ff9090",
    fontSize: 14,
    marginTop: 16,
  },
});
