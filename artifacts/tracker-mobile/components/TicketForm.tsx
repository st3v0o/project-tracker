import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useParseTicketImage } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import type { TicketStatus, TicketPriority } from "@/components/TicketCard";

export interface TicketFormData {
  title: string;
  description: string;
  state: string;
  submitter: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
}

interface TicketFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: TicketFormData) => Promise<void>;
  initialValues?: Partial<TicketFormData>;
  title?: string;
}

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina",
  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];

const CATEGORIES = [
  "Power Automate","ArcGIS","CRM","Dashboard","Database","Excel","SharePoint",
  "Teams","Power BI","Python","JavaScript","General IT","Other",
];

interface SelectFieldProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}

function SelectField({ label, value, options, onSelect }: SelectFieldProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.selectButton,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <Text
          style={[
            styles.selectText,
            { color: value ? colors.foreground : colors.mutedForeground },
          ]}
        >
          {value || `Select ${label}`}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)} />
        <View
          style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>
              {label}
            </Text>
            <Pressable onPress={() => setOpen(false)}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView>
            {options.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
                style={[
                  styles.pickerItem,
                  { borderBottomColor: colors.border },
                  value === opt && { backgroundColor: colors.accent },
                ]}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    { color: value === opt ? colors.primary : colors.foreground },
                  ]}
                >
                  {opt}
                </Text>
                {value === opt && (
                  <Feather name="check" size={16} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const PRIORITY_OPTIONS: { label: string; value: TicketPriority; color: string }[] = [
  { label: "Low", value: "low", color: "#6b7280" },
  { label: "Medium", value: "medium", color: "#3b82f6" },
  { label: "High", value: "high", color: "#f97316" },
  { label: "Critical", value: "critical", color: "#ef4444" },
];

const STATUS_OPTIONS: { label: string; value: TicketStatus }[] = [
  { label: "To Do", value: "todo" },
  { label: "Pending", value: "pending" },
  { label: "Complete", value: "complete" },
];

async function pickImage(source: "camera" | "library"): Promise<ImagePicker.ImagePickerResult> {
  if (source === "camera") {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to take photos.");
      return { canceled: true, assets: null };
    }
    return ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      base64: true,
      allowsEditing: false,
    });
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Photo library access is required to upload screenshots.");
      return { canceled: true, assets: null };
    }
    return ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      base64: true,
      allowsEditing: false,
    });
  }
}

export function TicketForm({
  visible,
  onClose,
  onSubmit,
  initialValues,
  title = "New Ticket",
}: TicketFormProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedBanner, setParsedBanner] = useState<string | null>(null);

  const [form, setForm] = useState<TicketFormData>({
    title: initialValues?.title ?? "",
    description: initialValues?.description ?? "",
    state: initialValues?.state ?? "",
    submitter: initialValues?.submitter ?? "",
    category: initialValues?.category ?? "",
    status: initialValues?.status ?? "todo",
    priority: initialValues?.priority ?? "medium",
  });

  const parseMutation = useParseTicketImage();

  const update = (key: keyof TicketFormData, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleScanPhoto = () => {
    const doScan = async (source: "camera" | "library") => {
      setParsing(true);
      setParsedBanner(null);
      try {
        const result = await pickImage(source);
        if (result.canceled || !result.assets?.[0]) return;

        const asset = result.assets[0];
        const base64 = asset.base64;
        if (!base64) {
          Alert.alert("Error", "Could not read image data.");
          return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const parsed = await parseMutation.mutateAsync({
          data: {
            imageBase64: base64,
            mimeType: asset.mimeType ?? "image/jpeg",
          },
        });

        setForm((f) => ({
          ...f,
          title: parsed.title ?? f.title,
          description: parsed.description ?? f.description,
          submitter: parsed.submitter ?? f.submitter,
          state: parsed.state ?? f.state,
          category: parsed.category ?? f.category,
        }));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setParsedBanner(parsed.confidence ?? "Fields filled from photo");
      } catch {
        Alert.alert("AI Parse Failed", "Could not extract ticket info from that image. Try a clearer screenshot.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setParsing(false);
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Upload Screenshot"],
          cancelButtonIndex: 0,
          title: "Add Photo for AI Parsing",
        },
        (idx) => {
          if (idx === 1) doScan("camera");
          if (idx === 2) doScan("library");
        }
      );
    } else {
      Alert.alert("Add Photo", "Choose a source for AI ticket parsing", [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: () => doScan("camera") },
        { text: "Upload Screenshot", onPress: () => doScan("library") },
      ]);
    }
  };

  const handleSubmit = async () => {
    if (!form.title || !form.state || !form.submitter || !form.category) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Missing fields", "Title, State, Submitter, and Category are required.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setParsedBanner(null);
      onClose();
    } finally {
      setSaving(false);
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
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {title}
          </Text>
          <View style={styles.headerRight}>
            <Pressable
              testID="scan-photo-btn"
              onPress={handleScanPhoto}
              disabled={parsing || saving}
              hitSlop={8}
              style={[
                styles.scanBtn,
                { backgroundColor: colors.accent, borderColor: colors.primary + "33" },
              ]}
            >
              {parsing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="camera" size={17} color={colors.primary} />
              )}
            </Pressable>
            <Pressable onPress={handleSubmit} disabled={saving || parsing} hitSlop={8}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveBtn, { color: colors.primary }]}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>

        {parsedBanner && (
          <View style={[styles.banner, { backgroundColor: colors.success + "1a", borderColor: colors.success + "44" }]}>
            <Feather name="check-circle" size={14} color={colors.success} />
            <Text style={[styles.bannerText, { color: colors.success }]}>
              AI filled fields · {parsedBanner}
            </Text>
            <Pressable onPress={() => setParsedBanner(null)} hitSlop={8}>
              <Feather name="x" size={14} color={colors.success} />
            </Pressable>
          </View>
        )}

        {parsing && (
          <View style={[styles.parsingOverlay, { backgroundColor: colors.primary + "11" }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.parsingText, { color: colors.primary }]}>
              AI is reading your photo...
            </Text>
          </View>
        )}

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 32 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Title *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground },
                ]}
                placeholder="Ticket title"
                placeholderTextColor={colors.mutedForeground}
                value={form.title}
                onChangeText={(v) => update("title", v)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Description
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground },
                ]}
                placeholder="Describe the request..."
                placeholderTextColor={colors.mutedForeground}
                value={form.description}
                onChangeText={(v) => update("description", v)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Submitter *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground },
                ]}
                placeholder="Full name"
                placeholderTextColor={colors.mutedForeground}
                value={form.submitter}
                onChangeText={(v) => update("submitter", v)}
              />
            </View>

            <SelectField
              label="State *"
              value={form.state}
              options={US_STATES}
              onSelect={(v) => update("state", v)}
            />

            <SelectField
              label="Category *"
              value={form.category}
              options={CATEGORIES}
              onSelect={(v) => update("category", v)}
            />

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Priority
              </Text>
              <View style={styles.chipRow}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => update("priority", opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor:
                          form.priority === opt.value ? opt.color : colors.secondary,
                        borderColor:
                          form.priority === opt.value ? opt.color : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color:
                            form.priority === opt.value ? "#fff" : colors.mutedForeground,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Status
              </Text>
              <View style={styles.chipRow}>
                {STATUS_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => update("status", opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor:
                          form.status === opt.value ? colors.primary : colors.secondary,
                        borderColor:
                          form.status === opt.value ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color:
                            form.status === opt.value ? "#fff" : colors.mutedForeground,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scanBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  parsingOverlay: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 12,
  },
  parsingText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    minHeight: 88,
    paddingTop: 12,
  },
  selectButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  picker: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    maxHeight: "70%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerItemText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
