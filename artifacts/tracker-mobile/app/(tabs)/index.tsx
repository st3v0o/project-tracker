import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTickets,
  useCreateTicket,
  useUpdateTicket,
  useDeleteTicket,
  setBaseUrl,
  getListTicketsQueryKey,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { TicketCard, type Ticket, type TicketStatus } from "@/components/TicketCard";
import { FilterBar } from "@/components/FilterBar";
import { StatsBar } from "@/components/StatsBar";
import { TicketForm, type TicketFormData } from "@/components/TicketForm";
import { TicketDetail } from "@/components/TicketDetail";

setBaseUrl(`https://${process.env["EXPO_PUBLIC_DOMAIN"]}`);

type FilterValue = "all" | TicketStatus | "low" | "medium" | "high" | "critical";

export default function TicketsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterValue>("all");
  const [priorityFilter, setPriorityFilter] = useState<FilterValue>("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  const { data: tickets = [], isLoading, isRefetching, refetch } = useListTickets();

  const createMutation = useCreateTicket();
  const updateMutation = useUpdateTicket();
  const deleteMutation = useDeleteTicket();

  const filtered = useMemo(() => {
    let list = tickets as Ticket[];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.submitter.toLowerCase().includes(q) ||
          t.state.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      list = list.filter((t) => t.priority === priorityFilter);
    }
    return list.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }, [tickets, search, statusFilter, priorityFilter]);

  const handleCreate = useCallback(
    async (data: TicketFormData) => {
      await createMutation.mutateAsync({
        data: {
          title: data.title,
          description: data.description,
          state: data.state,
          submitter: data.submitter,
          category: data.category,
          status: data.status,
          priority: data.priority,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    },
    [createMutation, queryClient]
  );

  const handleEdit = useCallback(
    async (data: TicketFormData) => {
      if (!editingTicket) return;
      await updateMutation.mutateAsync({
        id: editingTicket.id,
        data: {
          title: data.title,
          description: data.description,
          state: data.state,
          submitter: data.submitter,
          category: data.category,
          status: data.status,
          priority: data.priority,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setEditingTicket(null);
    },
    [editingTicket, updateMutation, queryClient]
  );

  const handleStatusChange = useCallback(
    async (ticket: Ticket, status: TicketStatus) => {
      await updateMutation.mutateAsync({
        id: ticket.id,
        data: {
          status,
          completedAt: status === "complete" ? new Date().toISOString() : null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    },
    [updateMutation, queryClient]
  );

  const handleDelete = useCallback(
    async (ticket: Ticket) => {
      await deleteMutation.mutateAsync({ id: ticket.id });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    },
    [deleteMutation, queryClient]
  );

  const handleCardPress = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket);
  }, []);

  const handleDetailEdit = useCallback((ticket: Ticket) => {
    setSelectedTicket(null);
    setEditingTicket(ticket);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Ticket }) => (
      <TicketCard
        ticket={item}
        onPress={handleCardPress}
        onStatusChange={handleStatusChange}
      />
    ),
    [handleCardPress, handleStatusChange]
  );

  const keyExtractor = useCallback((item: Ticket) => String(item.id), []);

  const headerPaddingTop = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: headerPaddingTop + 12,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Tickets
        </Text>
        <Pressable
          testID="new-ticket-btn"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowForm(true);
          }}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      <View
        style={[
          styles.searchRow,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            testID="search-input"
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search tickets..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {!isLoading && (
        <StatsBar tickets={tickets as Ticket[]} />
      )}

      <FilterBar
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        onStatusChange={setStatusFilter}
        onPriorityChange={setPriorityFilter}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Feather name="inbox" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {search || statusFilter !== "all" || priorityFilter !== "all"
              ? "No tickets match your filters"
              : "No tickets yet. Tap + to add one."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 16 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={filtered.length > 0}
        />
      )}

      <TicketForm
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
        title="New Ticket"
      />

      {editingTicket && (
        <TicketForm
          visible={!!editingTicket}
          onClose={() => setEditingTicket(null)}
          onSubmit={handleEdit}
          initialValues={editingTicket}
          title="Edit Ticket"
        />
      )}

      <TicketDetail
        ticket={selectedTicket}
        visible={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onEdit={handleDetailEdit}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
      />
    </View>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  list: {
    paddingTop: 8,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
