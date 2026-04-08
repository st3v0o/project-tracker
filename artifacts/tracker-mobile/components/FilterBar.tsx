import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import type { TicketStatus, TicketPriority } from "@/components/TicketCard";

type FilterValue = "all" | TicketStatus | TicketPriority;

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  accent?: string;
}

function FilterChip({ label, active, onPress, accent }: FilterChipProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? (accent ?? colors.primary) : colors.secondary,
          borderColor: active ? (accent ?? colors.primary) : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? "#fff" : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface FilterBarProps {
  statusFilter: FilterValue;
  priorityFilter: FilterValue;
  onStatusChange: (v: FilterValue) => void;
  onPriorityChange: (v: FilterValue) => void;
}

const STATUS_OPTIONS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "To Do", value: "todo" },
  { label: "Pending", value: "pending" },
  { label: "Done", value: "complete" },
];

const PRIORITY_OPTIONS: { label: string; value: FilterValue; color: string }[] = [
  { label: "Low", value: "low", color: "#6b7280" },
  { label: "Medium", value: "medium", color: "#3b82f6" },
  { label: "High", value: "high", color: "#f97316" },
  { label: "Critical", value: "critical", color: "#ef4444" },
];

export function FilterBar({
  statusFilter,
  priorityFilter,
  onStatusChange,
  onPriorityChange,
}: FilterBarProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {STATUS_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            active={statusFilter === opt.value}
            onPress={() => onStatusChange(opt.value)}
          />
        ))}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        {PRIORITY_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            active={priorityFilter === opt.value}
            accent={opt.color}
            onPress={() =>
              onPriorityChange(
                priorityFilter === opt.value ? "all" : opt.value
              )
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
});
