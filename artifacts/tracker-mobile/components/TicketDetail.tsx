import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import type { Ticket, TicketStatus, TicketPriority } from "@/components/TicketCard";

interface TicketDetailProps {
  ticket: Ticket | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (ticket: Ticket) => void;
  onDelete: (ticket: Ticket) => Promise<void>;
  onStatusChange: (ticket: Ticket, status: TicketStatus) => Promise<void>;
}

function Row({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: "#6b7280",
  medium: "#3b82f6",
  high: "#f97316",
  critical: "#ef4444",
};

const STATUS_CYCLE: TicketStatus[] = ["todo", "pending", "complete"];
const STATUS_LABELS: Record<TicketStatus, string> = {
  todo: "To Do",
  pending: "Pending",
  complete: "Complete",
};

function timeSince(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function TicketDetail({
  ticket,
  visible,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
}: TicketDetailProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  if (!ticket) return null;

  const priorityColor = PRIORITY_COLORS[ticket.priority];
  const currentStatusIdx = STATUS_CYCLE.indexOf(ticket.status);
  const nextStatus = STATUS_CYCLE[(currentStatusIdx + 1) % STATUS_CYCLE.length];

  const handleDelete = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDeleting(true);
    try {
      await onDelete(ticket);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusCycle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChangingStatus(true);
    try {
      await onStatusChange(ticket, nextStatus);
    } finally {
      setChangingStatus(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.border,
              paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
            },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <Feather name="chevron-down" size={24} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Ticket #{ticket.id}
          </Text>
          <View style={styles.headerActions}>
            <Pressable onPress={() => onEdit(ticket)} hitSlop={8} style={styles.headerBtn}>
              <Feather name="edit-2" size={18} color={colors.primary} />
            </Pressable>
            <Pressable onPress={handleDelete} disabled={deleting} hitSlop={8} style={styles.headerBtn}>
              {deleting ? (
                <ActivityIndicator size="small" color={colors.destructive} />
              ) : (
                <Feather name="trash-2" size={18} color={colors.destructive} />
              )}
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 32 },
          ]}
        >
          <View style={[styles.section, { borderColor: colors.border }]}>
            <View style={styles.titleRow}>
              <View style={[styles.priorityBadge, { backgroundColor: priorityColor + "22", borderColor: priorityColor }]}>
                <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
                <Text style={[styles.priorityLabel, { color: priorityColor }]}>
                  {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                </Text>
              </View>
              <Text style={[styles.timeSince, { color: colors.mutedForeground }]}>
                {timeSince(ticket.submittedAt)}
              </Text>
            </View>

            <Text style={[styles.title, { color: colors.foreground }]}>
              {ticket.title}
            </Text>
            {!!ticket.description && (
              <Text style={[styles.description, { color: colors.mutedForeground }]}>
                {ticket.description}
              </Text>
            )}
          </View>

          <View style={[styles.section, { borderColor: colors.border }]}>
            <Row label="State" value={ticket.state} />
            <Row label="Submitter" value={ticket.submitter} />
            <Row label="Category" value={ticket.category} />
            <Row
              label="Submitted"
              value={new Date(ticket.submittedAt).toLocaleDateString()}
            />
            {ticket.completedAt && (
              <Row
                label="Completed"
                value={new Date(ticket.completedAt).toLocaleDateString()}
              />
            )}
          </View>

          <Pressable
            testID="status-cycle-btn"
            onPress={handleStatusCycle}
            disabled={changingStatus}
            style={({ pressed }) => [
              styles.statusBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {changingStatus ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="refresh-cw" size={16} color="#fff" />
                <Text style={styles.statusBtnText}>
                  Mark as {STATUS_LABELS[nextStatus]}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  headerBtn: {
    padding: 4,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  timeSince: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    maxWidth: "60%",
    textAlign: "right",
  },
  statusBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  statusBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
