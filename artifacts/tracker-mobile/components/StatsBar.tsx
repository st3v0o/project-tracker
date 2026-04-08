import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { Ticket } from "@/components/TicketCard";

interface StatsBarProps {
  tickets: Ticket[];
}

export function StatsBar({ tickets }: StatsBarProps) {
  const colors = useColors();

  const todo = tickets.filter((t) => t.status === "todo").length;
  const pending = tickets.filter((t) => t.status === "pending").length;
  const complete = tickets.filter((t) => t.status === "complete").length;
  const critical = tickets.filter((t) => t.priority === "critical").length;

  const stats = [
    { label: "To Do", value: todo, color: colors.primary },
    { label: "Pending", value: pending, color: colors.warning },
    { label: "Done", value: complete, color: colors.success },
    { label: "Critical", value: critical, color: colors.destructive },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      {stats.map((s) => (
        <View key={s.label} style={styles.stat}>
          <Text style={[styles.value, { color: s.color }]}>{s.value}</Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  value: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
