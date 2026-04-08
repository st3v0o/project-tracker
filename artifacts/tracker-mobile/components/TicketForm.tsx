import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import React, { useRef, useState } from "react";
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
import {
  useParseTicketImage,
  useParseTicketVoice,
} from "@workspace/api-client-react";

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
        <Text style={[styles.selectText, { color: value ? colors.foreground : colors.mutedForeground }]}>
          {value || `Select ${label}`}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)} />
        <View style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>{label}</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView>
            {options.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => { onSelect(opt); setOpen(false); }}
                style={[
                  styles.pickerItem,
                  { borderBottomColor: colors.border },
                  value === opt && { backgroundColor: colors.accent },
                ]}
              >
                <Text style={[styles.pickerItemText, { color: value === opt ? colors.primary : colors.foreground }]}>
                  {opt}
                </Text>
                {value === opt && <Feather name="check" size={16} color={colors.primary} />}
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
    return ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85, base64: true });
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Photo library access is required.");
      return { canceled: true, assets: null };
    }
    return ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, base64: true });
  }
}

type AIStatus = "idle" | "recording" | "processing";

export function TicketForm({ visible, onClose, onSubmit, initialValues, title = "New Ticket" }: TicketFormProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatus>("idle");
  const [aiLabel, setAiLabel] = useState("");
  const [parsedBanner, setParsedBanner] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);

  const [form, setForm] = useState<TicketFormData>({
    title: initialValues?.title ?? "",
    description: initialValues?.description ?? "",
    state: initialValues?.state ?? "",
    submitter: initialValues?.submitter ?? "",
    category: initialValues?.category ?? "",
    status: initialValues?.status ?? "todo",
    priority: initialValues?.priority ?? "medium",
  });

  const imageMutation = useParseTicketImage();
  const voiceMutation = useParseTicketVoice();

  const update = (key: keyof TicketFormData, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const applyParsed = (parsed: {
    title?: string | null;
    description?: string | null;
    submitter?: string | null;
    state?: string | null;
    category?: string | null;
    confidence?: string | null;
  }) => {
    setForm((f) => ({
      ...f,
      title: parsed.title ?? f.title,
      description: parsed.description ?? f.description,
      submitter: parsed.submitter ?? f.submitter,
      state: parsed.state ?? f.state,
      category: parsed.category ?? f.category,
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setParsedBanner(parsed.confidence ?? "Fields filled from AI");
  };

  // ── Photo / Screenshot AI ──────────────────────────────────────────────────

  const handleScanPhoto = () => {
    const doScan = async (source: "camera" | "library") => {
      setAiStatus("processing");
      setAiLabel("Reading photo...");
      setParsedBanner(null);
      try {
        const result = await pickImage(source);
        if (result.canceled || !result.assets?.[0]) { setAiStatus("idle"); return; }
        const { base64, mimeType } = result.assets[0];
        if (!base64) { Alert.alert("Error", "Could not read image."); setAiStatus("idle"); return; }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setAiLabel("AI parsing photo...");
        const parsed = await imageMutation.mutateAsync({ data: { imageBase64: base64, mimeType: mimeType ?? "image/jpeg" } });
        applyParsed(parsed);
      } catch {
        Alert.alert("AI Parse Failed", "Could not extract ticket info. Try a clearer screenshot.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setAiStatus("idle");
        setAiLabel("");
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Take Photo", "Upload Screenshot"], cancelButtonIndex: 0, title: "AI Photo Parsing" },
        (idx) => { if (idx === 1) doScan("camera"); if (idx === 2) doScan("library"); }
      );
    } else {
      Alert.alert("AI Photo", "Choose image source", [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: () => doScan("camera") },
        { text: "Upload Screenshot", onPress: () => doScan("library") },
      ]);
    }
  };

  // ── Voice Recording AI ─────────────────────────────────────────────────────

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Microphone access is required for voice input.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setAiStatus("recording");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Alert.alert("Recording Error", "Could not start recording. Please try again.");
    }
  };

  const stopRecordingAndParse = async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;

    setAiStatus("processing");
    setAiLabel("Transcribing voice...");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      if (!uri) { Alert.alert("Error", "No audio recorded."); setAiStatus("idle"); return; }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const mimeType = Platform.OS === "ios" ? "audio/m4a" : "audio/3gp";

      setAiLabel("AI creating ticket...");
      const parsed = await voiceMutation.mutateAsync({ data: { audioBase64: base64, mimeType } });
      applyParsed(parsed);
    } catch {
      Alert.alert("Voice Parse Failed", "Could not process the recording. Try again or speak more clearly.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAiStatus("idle");
      setAiLabel("");
    }
  };

  const handleMicPress = () => {
    if (aiStatus === "recording") {
      stopRecordingAndParse();
    } else if (aiStatus === "idle") {
      startRecording();
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

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

  const busy = aiStatus !== "idle" || saving;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.root, { backgroundColor: colors.background }]}>

        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={8} disabled={busy}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>

          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>

          <View style={styles.headerRight}>
            {/* Camera / Photo button */}
            <Pressable
              testID="scan-photo-btn"
              onPress={handleScanPhoto}
              disabled={busy}
              hitSlop={8}
              style={[
                styles.iconBtn,
                { backgroundColor: colors.accent, borderColor: colors.primary + "33" },
              ]}
            >
              <Feather name="camera" size={16} color={colors.primary} />
            </Pressable>

            {/* Mic button — pulses red while recording */}
            <Pressable
              testID="voice-btn"
              onPress={handleMicPress}
              disabled={aiStatus === "processing" || saving}
              hitSlop={8}
              style={[
                styles.iconBtn,
                {
                  backgroundColor:
                    aiStatus === "recording"
                      ? colors.destructive + "22"
                      : colors.accent,
                  borderColor:
                    aiStatus === "recording"
                      ? colors.destructive
                      : colors.primary + "33",
                },
              ]}
            >
              <Feather
                name={aiStatus === "recording" ? "square" : "mic"}
                size={16}
                color={aiStatus === "recording" ? colors.destructive : colors.primary}
              />
            </Pressable>

            {/* Save */}
            <Pressable onPress={handleSubmit} disabled={busy} hitSlop={8}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveBtn, { color: busy ? colors.mutedForeground : colors.primary }]}>
                  Save
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* AI status bar */}
        {aiStatus !== "idle" && (
          <View style={[
            styles.aiBanner,
            {
              backgroundColor: aiStatus === "recording"
                ? colors.destructive + "15"
                : colors.primary + "15",
              borderColor: aiStatus === "recording"
                ? colors.destructive + "44"
                : colors.primary + "33",
            },
          ]}>
            {aiStatus === "processing" ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={[styles.recDot, { backgroundColor: colors.destructive }]} />
            )}
            <Text style={[
              styles.aiBannerText,
              { color: aiStatus === "recording" ? colors.destructive : colors.primary },
            ]}>
              {aiStatus === "recording"
                ? "Recording... tap the stop button when done"
                : aiLabel || "Processing..."}
            </Text>
          </View>
        )}

        {/* Success banner */}
        {parsedBanner && aiStatus === "idle" && (
          <View style={[styles.aiBanner, { backgroundColor: colors.success + "1a", borderColor: colors.success + "44" }]}>
            <Feather name="check-circle" size={14} color={colors.success} />
            <Text style={[styles.aiBannerText, { color: colors.success, flex: 1 }]}>
              AI filled fields · {parsedBanner}
            </Text>
            <Pressable onPress={() => setParsedBanner(null)} hitSlop={8}>
              <Feather name="x" size={14} color={colors.success} />
            </Pressable>
          </View>
        )}

        {/* Form */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title *</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
                placeholder="Ticket title"
                placeholderTextColor={colors.mutedForeground}
                value={form.title}
                onChangeText={(v) => update("title", v)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
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
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Submitter *</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
                placeholder="Full name"
                placeholderTextColor={colors.mutedForeground}
                value={form.submitter}
                onChangeText={(v) => update("submitter", v)}
              />
            </View>

            <SelectField label="State *" value={form.state} options={US_STATES} onSelect={(v) => update("state", v)} />
            <SelectField label="Category *" value={form.category} options={CATEGORIES} onSelect={(v) => update("category", v)} />

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Priority</Text>
              <View style={styles.chipRow}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => update("priority", opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: form.priority === opt.value ? opt.color : colors.secondary,
                        borderColor: form.priority === opt.value ? opt.color : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: form.priority === opt.value ? "#fff" : colors.mutedForeground }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Status</Text>
              <View style={styles.chipRow}>
                {STATUS_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => update("status", opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: form.status === opt.value ? colors.primary : colors.secondary,
                        borderColor: form.status === opt.value ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: form.status === opt.value ? "#fff" : colors.mutedForeground }]}>
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
  root: { flex: 1 },
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
    gap: 10,
  },
  iconBtn: {
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
  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  aiBannerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  fieldGroup: { gap: 6 },
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
  textArea: { minHeight: 88, paddingTop: 12 },
  selectButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
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
  pickerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerItemText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
