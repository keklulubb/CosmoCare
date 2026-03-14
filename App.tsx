import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { mockMedication } from "./src/data/mockMedication";

import {
  formatDoseForTimezone,
  getCurrentTimezone,
  getNextDose,
} from "./src/lib/schedule";


export default function App() {
  const currentTimezone = getCurrentTimezone();
  const nextDoseUtc = getNextDose(mockMedication);
  const nextDoseLocal = formatDoseForTimezone(nextDoseUtc, currentTimezone);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CosmoCare</Text>

      <Text style={styles.label}>Current timezone</Text>
      <Text style={styles.value}>{currentTimezone}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Medication</Text>
        <Text style={styles.value}>{mockMedication.name}</Text>

        <Text style={styles.label}>Interval</Text>
        <Text style={styles.value}>{mockMedication.intervalHours} hours</Text>

        <Text style={styles.label}>Next dose here</Text>
        <Text style={styles.value}>{nextDoseLocal}</Text>

        <Text style={styles.label}>Next dose (UTC)</Text>
        <Text style={styles.value}>{nextDoseUtc}</Text>

        <Text style={styles.label}>First dose (UTC)</Text>
        <Text style={styles.value}>{mockMedication.firstDoseUtc}</Text>

        <Text style={styles.label}>Home timezone</Text>
        <Text style={styles.value}>{mockMedication.homeTimezone}</Text>

        {mockMedication.notes ? (
          <>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.value}>{mockMedication.notes}</Text>
          </>
        ) : null}
      </View>

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1020",
    paddingHorizontal: 24,
    paddingTop: 90,
  },
  title: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#151b31",
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
  },
  label: {
    color: "#9aa4c7",
    fontSize: 14,
    marginTop: 10,
  },
  value: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 4,
  },
});