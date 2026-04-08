import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export type TicketStatus = "todo" | "pending" | "complete";
export type TicketPriority = "low" | "medium" | "high" | "critical";

export interface Ticket {
  id: number;
  title: string;
  description: string;
  state: string;
  submitter: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  pendingDate?: string | null;
  completedAt?: string | null;
}

interface TicketCardProps {
  ticket: Ticket;
  onPress: (ticket: Ticket) => void;
  onStatusChange?: (ticket: Ticket, status: TicketStatus) => void;
}

function timeSince(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const colors = useColors();
  const config: Record<TicketStatus, { label: string; bg: string; text: string }> = {
    todo: { label: "To Do", bg: colors.accent, text: colors.primary },
    pending: { label: "Pending", bg: "#fff3cd", text: "#b45309" },
    complete: { label: "Done", bg: "#dcfce7", text: "#166534" },
  };
  const c = config[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

function PriorityDot({ priority }: { priority: TicketPriority }) {
  const colors = useColors();
  const colorMap: Record<TicketPriority, string> = {
    low: colors.priorityLow,
    medium: colors.priorityMedium,
    high: colors.priorityHigh,
    critical: colors.priorityCritical,
  };
  return (
    <View
      style={[
        styles.priorityDot,
        { backgroundColor: colorMap[priority] },
      ]}
    />
  );
}

export function TicketCard({ ticket, onPress, onStatusChange }: TicketCardProps) {
  const colors = useColors();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(ticket);
  }, [ticket, onPress]);

  const nextStatus: Record<TicketStatus, TicketStatus> = {
    todo: "pending",
    pending: "complete",
    complete: "todo",
  };

  const handleStatusPress = useCallback(() => {
    if (!onStatusChange) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStatusChange(ticket, nextStatus[ticket.status]);
  }, [ticket, onStatusChange]);

  return (
    <Pressable
      testID={`ticket-card-${ticket.id}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <PriorityDot priority={ticket.priority} />
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {ticket.title}
        </Text>
        <Pressable
          testID={`status-toggle-${ticket.id}`}
          onPress={handleStatusPress}
          hitSlop={8}
        >
          <StatusBadge status={ticket.status} />
        </Pressable>
      </View>

      <Text
        style={[styles.description, { color: colors.mutedForeground }]}
        numberOfLines={2}
      >
        {ticket.description}
      </Text>

      <View style={styles.cardFooter}>
        <View style={styles.metaItem}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {ticket.state}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Feather name="tag" size={12} color={colors.mutedForeground} />
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {ticket.category}
          </Text>
        </View>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {timeSince(ticket.submittedAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  description: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  meta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
