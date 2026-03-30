import React, { useEffect, useState, useRef, useCallback, useMemo } from "react"
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  LayoutChangeEvent,
  AppState,
  AppStateStatus,
  Linking,
  Platform,
} from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { SymbolView } from "expo-symbols"
import * as Haptics from "expo-haptics"
import { useAudioPlayer } from "expo-audio"
import { initWhisper, releaseAllWhisper, type WhisperContext } from "whisper.rn"
import { RealtimeTranscriber, type RealtimeTranscribeEvent } from "whisper.rn/src/realtime-transcription"
import { AudioPcmStreamAdapter } from "whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter"
import { AudioManager } from "react-native-audio-api"
import * as Notifications from "expo-notifications"
import * as FileSystem from "expo-file-system/legacy"
import Constants from "expo-constants"
import { fetch as expoFetch } from "expo/fetch"
import {
  classifyMonitorEvent,
  extractSessionID,
  formatMonitorEventLabel,
  type OpenCodeEvent,
  type MonitorEventType,
} from "@/lib/opencode-events"
import { parseSSEStream } from "@/lib/sse"
import { registerRelayDevice, unregisterRelayDevice } from "@/lib/relay-client"
import {
  ensureNotificationPermissions,
  getDevicePushToken,
  onPushTokenChange,
} from "@/notifications/monitoring-notifications"

const CONTROL_HEIGHT = 86
const SEND_SETTLE_MS = 240
const WAVEFORM_ROWS = 5
const WAVEFORM_CELL_SIZE = 8
const WAVEFORM_CELL_GAP = 2
const DROPDOWN_VISIBLE_ROWS = 6
// If the press duration is shorter than this, treat it as a tap (toggle)
const TAP_THRESHOLD_MS = 300
const DEFAULT_RELAY_URL = "https://apn.dev.opencode.ai"
const SERVER_STATE_FILE = `${FileSystem.documentDirectory}mobile-voice-servers.json`
const WHISPER_SETTINGS_FILE = `${FileSystem.documentDirectory}mobile-voice-whisper-settings.json`
const ONBOARDING_STATE_FILE = `${FileSystem.documentDirectory}mobile-voice-onboarding.json`
const WHISPER_MODELS_DIR = `${FileSystem.documentDirectory}whisper-models`
const WHISPER_REPO = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main"
const WHISPER_MODELS = [
  "ggml-tiny.en-q5_1.bin",
  "ggml-tiny.en-q8_0.bin",
  "ggml-tiny.en.bin",
  "ggml-tiny-q5_1.bin",
  "ggml-tiny-q8_0.bin",
  "ggml-tiny.bin",
  "ggml-base.en-q5_1.bin",
  "ggml-base.en-q8_0.bin",
  "ggml-base.en.bin",
  "ggml-base-q5_1.bin",
  "ggml-base-q8_0.bin",
  "ggml-base.bin",
  "ggml-small.en-q5_1.bin",
  "ggml-small.en-q8_0.bin",
  "ggml-small.en.bin",
  "ggml-small-q5_1.bin",
  "ggml-small-q8_0.bin",
  "ggml-small.bin",
  "ggml-medium.en-q5_0.bin",
  "ggml-medium.en-q8_0.bin",
  "ggml-medium.en.bin",
  "ggml-medium-q5_0.bin",
  "ggml-medium-q8_0.bin",
  "ggml-medium.bin",
  "ggml-large-v1.bin",
  "ggml-large-v2-q5_0.bin",
  "ggml-large-v2-q8_0.bin",
  "ggml-large-v2.bin",
  "ggml-large-v3-q5_0.bin",
  "ggml-large-v3-turbo-q5_0.bin",
  "ggml-large-v3-turbo-q8_0.bin",
  "ggml-large-v3-turbo.bin",
  "ggml-large-v3.bin",
] as const

type WhisperModelID = (typeof WHISPER_MODELS)[number]
type TranscriptionMode = "bulk" | "realtime"
type PermissionPromptState = "idle" | "pending" | "granted" | "denied"
const DEFAULT_WHISPER_MODEL: WhisperModelID = "ggml-small-q8_0.bin"
const DEFAULT_TRANSCRIPTION_MODE: TranscriptionMode = "bulk"

const WHISPER_MODEL_LABELS: Record<WhisperModelID, string> = {
  "ggml-tiny.en-q5_1.bin": "tiny.en q5_1",
  "ggml-tiny.en-q8_0.bin": "tiny.en q8_0",
  "ggml-tiny.en.bin": "tiny.en",
  "ggml-tiny-q5_1.bin": "tiny q5_1",
  "ggml-tiny-q8_0.bin": "tiny q8_0",
  "ggml-tiny.bin": "tiny",
  "ggml-base.en-q5_1.bin": "base.en q5_1",
  "ggml-base.en-q8_0.bin": "base.en q8_0",
  "ggml-base.en.bin": "base.en",
  "ggml-base-q5_1.bin": "base q5_1",
  "ggml-base-q8_0.bin": "base q8_0",
  "ggml-base.bin": "base",
  "ggml-small.en-q5_1.bin": "small.en q5_1",
  "ggml-small.en-q8_0.bin": "small.en q8_0",
  "ggml-small.en.bin": "small.en",
  "ggml-small-q5_1.bin": "small q5_1",
  "ggml-small-q8_0.bin": "small q8_0",
  "ggml-small.bin": "small",
  "ggml-medium.en-q5_0.bin": "medium.en q5_0",
  "ggml-medium.en-q8_0.bin": "medium.en q8_0",
  "ggml-medium.en.bin": "medium.en",
  "ggml-medium-q5_0.bin": "medium q5_0",
  "ggml-medium-q8_0.bin": "medium q8_0",
  "ggml-medium.bin": "medium",
  "ggml-large-v1.bin": "large-v1",
  "ggml-large-v2-q5_0.bin": "large-v2 q5_0",
  "ggml-large-v2-q8_0.bin": "large-v2 q8_0",
  "ggml-large-v2.bin": "large-v2",
  "ggml-large-v3-q5_0.bin": "large-v3 q5_0",
  "ggml-large-v3-turbo-q5_0.bin": "large-v3 turbo q5_0",
  "ggml-large-v3-turbo-q8_0.bin": "large-v3 turbo q8_0",
  "ggml-large-v3-turbo.bin": "large-v3 turbo",
  "ggml-large-v3.bin": "large-v3",
}

const WHISPER_MODEL_SIZES: Record<WhisperModelID, number> = {
  "ggml-tiny.en-q5_1.bin": 32166155,
  "ggml-tiny.en-q8_0.bin": 43550795,
  "ggml-tiny.en.bin": 77704715,
  "ggml-tiny-q5_1.bin": 32152673,
  "ggml-tiny-q8_0.bin": 43537433,
  "ggml-tiny.bin": 77691713,
  "ggml-base.en-q5_1.bin": 59721011,
  "ggml-base.en-q8_0.bin": 81781811,
  "ggml-base.en.bin": 147964211,
  "ggml-base-q5_1.bin": 59707625,
  "ggml-base-q8_0.bin": 81768585,
  "ggml-base.bin": 147951465,
  "ggml-small.en-q5_1.bin": 190098681,
  "ggml-small.en-q8_0.bin": 264477561,
  "ggml-small.en.bin": 487614201,
  "ggml-small-q5_1.bin": 190085487,
  "ggml-small-q8_0.bin": 264464607,
  "ggml-small.bin": 487601967,
  "ggml-medium.en-q5_0.bin": 539225533,
  "ggml-medium.en-q8_0.bin": 823382461,
  "ggml-medium.en.bin": 1533774781,
  "ggml-medium-q5_0.bin": 539212467,
  "ggml-medium-q8_0.bin": 823369779,
  "ggml-medium.bin": 1533763059,
  "ggml-large-v1.bin": 3094623691,
  "ggml-large-v2-q5_0.bin": 1080732091,
  "ggml-large-v2-q8_0.bin": 1656129691,
  "ggml-large-v2.bin": 3094623691,
  "ggml-large-v3-q5_0.bin": 1081140203,
  "ggml-large-v3-turbo-q5_0.bin": 574041195,
  "ggml-large-v3-turbo-q8_0.bin": 874188075,
  "ggml-large-v3-turbo.bin": 1624555275,
  "ggml-large-v3.bin": 3095033483,
}

function isWhisperModelID(value: unknown): value is WhisperModelID {
  return typeof value === "string" && (WHISPER_MODELS as readonly string[]).includes(value)
}

function isEnglishOnlyWhisperModel(modelID: WhisperModelID): boolean {
  return modelID.includes(".en")
}

function isTranscriptionMode(value: unknown): value is TranscriptionMode {
  return value === "bulk" || value === "realtime"
}

function formatWhisperModelSize(bytes: number): string {
  const mib = bytes / (1024 * 1024)
  if (mib >= 1024) {
    return `${(mib / 1024).toFixed(1)} GB`
  }

  return `${Math.round(mib)} MB`
}

function cleanTranscriptText(text: string): string {
  return text.replace(/[ \t]+$/gm, "").trimEnd()
}

function cleanSessionText(text: string): string {
  return cleanTranscriptText(text).trimStart()
}

function normalizeTranscriptSessions(text: string): string {
  const cleaned = cleanTranscriptText(text)
  if (!cleaned) {
    return ""
  }

  return cleaned
    .split(/\n\n+/)
    .map((session) => cleanSessionText(session))
    .filter((session) => session.length > 0)
    .join("\n\n")
}

function mergeTranscriptChunk(previous: string, chunk: string): string {
  const cleanPrevious = cleanTranscriptText(previous)
  const cleanChunk = cleanSessionText(chunk)

  if (!cleanChunk) {
    return cleanPrevious
  }

  if (!cleanPrevious) {
    return cleanChunk
  }

  const normalizedChunk = cleanChunk
  if (!normalizedChunk) {
    return cleanPrevious
  }

  if (/^[,.;:!?)]/.test(normalizedChunk)) {
    return `${cleanPrevious}${normalizedChunk}`
  }

  return `${cleanPrevious} ${normalizedChunk}`
}

type SessionMessageInfo = {
  role?: unknown
  time?: unknown
}

type SessionMessagePart = {
  type?: unknown
  text?: unknown
}

type SessionMessagePayload = {
  info?: unknown
  parts?: unknown
}

function findLatestAssistantCompletionText(payload: unknown): string {
  if (!Array.isArray(payload)) return ""

  for (let index = payload.length - 1; index >= 0; index -= 1) {
    const candidate = payload[index] as SessionMessagePayload
    if (!candidate || typeof candidate !== "object") continue

    const info = candidate.info as SessionMessageInfo
    if (!info || typeof info !== "object") continue
    if (info.role !== "assistant") continue

    const time = info.time as { completed?: unknown } | undefined
    if (!time || typeof time !== "object") continue
    if (typeof time.completed !== "number") continue

    const parts = Array.isArray(candidate.parts) ? (candidate.parts as SessionMessagePart[]) : []
    const text = parts
      .filter((part) => part && part.type === "text" && typeof part.text === "string")
      .map((part) => cleanSessionText(part.text as string))
      .filter((part) => part.length > 0)
      .join("\n\n")

    if (text.length > 0) {
      return text
    }
  }

  return ""
}

type SessionItem = {
  id: string
  title: string
  updated: number
}

type ServerSessionPayload = {
  id?: unknown
  title?: unknown
  time?: {
    updated?: unknown
  }
}

function parseSessionItems(payload: unknown): SessionItem[] {
  if (!Array.isArray(payload)) return []

  return payload
    .filter((item): item is ServerSessionPayload => !!item && typeof item === "object")
    .map((item) => ({
      id: String(item.id ?? ""),
      title: String(item.title ?? item.id ?? "Untitled session"),
      updated: Number(item.time?.updated ?? 0),
    }))
    .filter((item) => item.id.length > 0)
    .sort((a, b) => b.updated - a.updated)
}

type ServerItem = {
  id: string
  name: string
  url: string
  serverID: string | null
  relayURL: string
  relaySecret: string
  status: "checking" | "online" | "offline"
  sessions: SessionItem[]
  sessionsLoading: boolean
}

type MonitorJob = {
  id: string
  sessionID: string
  opencodeBaseURL: string
  startedAt: number
}

function formatSessionUpdated(updatedMs: number): string {
  if (!updatedMs) return ""

  const now = Date.now()
  const deltaMs = Math.max(0, now - updatedMs)
  const deltaMin = Math.floor(deltaMs / 60000)

  if (deltaMin < 60) {
    return `${Math.max(1, deltaMin)} min`
  }

  const date = new Date(updatedMs)
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date)
  } catch {
    return date.toLocaleTimeString()
  }
}

type DropdownMode = "none" | "server" | "session"

type Pair = {
  v: 1
  serverID?: string
  relayURL: string
  relaySecret: string
  hosts: string[]
}

type Scan = {
  data: string
}

type SavedServer = {
  id: string
  name: string
  url: string
  serverID: string | null
  relayURL: string
  relaySecret: string
}

type SavedState = {
  servers: SavedServer[]
  activeServerId: string | null
  activeSessionId: string | null
}

type WhisperSavedState = {
  defaultModel: WhisperModelID
  mode: TranscriptionMode
}

type OnboardingSavedState = {
  completed: boolean
}

type SessionRuntimeStatus = "idle" | "busy" | "retry"

type NotificationPayload = {
  serverID: string | null
  eventType: MonitorEventType | null
  sessionID: string | null
}

function parseMonitorEventType(value: unknown): MonitorEventType | null {
  if (value === "complete" || value === "permission" || value === "error") {
    return value
  }

  return null
}

function parseNotificationPayload(data: unknown): NotificationPayload | null {
  if (!data || typeof data !== "object") return null

  const serverIDRaw = (data as { serverID?: unknown }).serverID
  const serverID = typeof serverIDRaw === "string" && serverIDRaw.length > 0 ? serverIDRaw : null

  const eventType = parseMonitorEventType((data as { eventType?: unknown }).eventType)
  const sessionIDRaw = (data as { sessionID?: unknown }).sessionID
  const sessionID = typeof sessionIDRaw === "string" && sessionIDRaw.length > 0 ? sessionIDRaw : null

  if (!eventType && !sessionID && !serverID) return null

  return {
    serverID,
    eventType,
    sessionID,
  }
}

type Cam = {
  CameraView: (typeof import("expo-camera"))["CameraView"]
  requestCameraPermissionsAsync: () => Promise<{ granted: boolean }>
}

function parsePairShape(data: unknown): Pair | undefined {
  if (!data || typeof data !== "object") return
  if ((data as { v?: unknown }).v !== 1) return
  if (typeof (data as { relayURL?: unknown }).relayURL !== "string") return
  if (typeof (data as { relaySecret?: unknown }).relaySecret !== "string") return
  if (!Array.isArray((data as { hosts?: unknown }).hosts)) return
  const hosts = (data as { hosts: unknown[] }).hosts.filter((item): item is string => typeof item === "string")
  if (!hosts.length) return
  const serverIDRaw = (data as { serverID?: unknown }).serverID
  const serverID = typeof serverIDRaw === "string" && serverIDRaw.length > 0 ? serverIDRaw : undefined
  return {
    v: 1,
    serverID,
    relayURL: (data as { relayURL: string }).relayURL,
    relaySecret: (data as { relaySecret: string }).relaySecret,
    hosts,
  }
}

function parsePair(input: string): Pair | undefined {
  const raw = input.trim()
  if (!raw) return

  const candidates: string[] = [raw]

  try {
    const url = new URL(raw)
    const query = url.searchParams.get("pair") ?? url.searchParams.get("payload")
    if (query) {
      candidates.unshift(query)
    }
  } catch {
    // Raw JSON payload is still supported.
  }

  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue
    seen.add(candidate)

    try {
      const parsed = JSON.parse(candidate)
      const pair = parsePairShape(parsed)
      if (pair) {
        return pair
      }
    } catch {
      // keep trying fallbacks
    }
  }
}

function isLoopback(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "0.0.0.0" || hostname === "::1"
}

function isCarrierGradeNat(hostname: string): boolean {
  const match = /^100\.(\d{1,3})\./.exec(hostname)
  if (!match) return false
  const octet = Number(match[1])
  return octet >= 64 && octet <= 127
}

/**
 * Probe all non-loopback hosts in parallel by hitting /health, then
 * choose the first reachable host based on the original ordering.
 * This preserves server-side preference (e.g. tailnet before LAN).
 */
async function pickHost(list: string[]): Promise<string | undefined> {
  const candidates = list.filter((item) => {
    try {
      return !isLoopback(new URL(item).hostname)
    } catch {
      return false
    }
  })

  if (!candidates.length) return list[0]

  const probes = candidates.map(async (host) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    try {
      const res = await fetch(`${host.replace(/\/+$/, "")}/health`, {
        method: "GET",
        signal: controller.signal,
      })
      return res.ok
    } catch {
      return false
    } finally {
      clearTimeout(timeout)
    }
  })

  for (let index = 0; index < candidates.length; index += 1) {
    const reachable = await probes[index]
    if (reachable) {
      return candidates[index]
    }
  }

  // none reachable — keep first candidate as deterministic fallback
  try {
    return candidates[0]
  } catch {
    return list[0]
  }
}

function serverBases(input: string) {
  const base = input.replace(/\/+$/, "")
  const list = [base]
  try {
    const url = new URL(base)
    const local = looksLikeLocalHost(url.hostname)
    const tailnet = url.hostname.endsWith(".ts.net")
    const secure = `https://${url.host}`
    const insecure = `http://${url.host}`
    if (url.protocol === "http:" && !local) {
      if (tailnet) {
        list.unshift(secure)
      } else {
        list.push(secure)
      }
    } else if (url.protocol === "https:" && tailnet) {
      list.push(insecure)
    }
  } catch {
    // Keep original base only.
  }
  return [...new Set(list)]
}

function looksLikeLocalHost(hostname: string): boolean {
  return (
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    isCarrierGradeNat(hostname)
  )
}

function toSaved(servers: ServerItem[], activeServerId: string | null, activeSessionId: string | null): SavedState {
  return {
    servers: servers.map((item) => ({
      id: item.id,
      name: item.name,
      url: item.url,
      serverID: item.serverID,
      relayURL: item.relayURL,
      relaySecret: item.relaySecret,
    })),
    activeServerId,
    activeSessionId,
  }
}

function fromSaved(input: SavedState): {
  servers: ServerItem[]
  activeServerId: string | null
  activeSessionId: string | null
} {
  const servers = input.servers.map((item) => ({
    id: item.id,
    name: item.name,
    url: item.url,
    serverID: item.serverID ?? null,
    relayURL: item.relayURL,
    relaySecret: item.relaySecret,
    status: "checking" as const,
    sessions: [] as SessionItem[],
    sessionsLoading: false,
  }))
  const hasActive = input.activeServerId && servers.some((item) => item.id === input.activeServerId)
  const activeServerId = hasActive ? input.activeServerId : (servers[0]?.id ?? null)
  return {
    servers,
    activeServerId,
    activeSessionId: hasActive ? input.activeSessionId : null,
  }
}

export default function DictationScreen() {
  const insets = useSafeAreaInsets()
  const [camera, setCamera] = useState<Cam | null>(null)
  const [defaultWhisperModel, setDefaultWhisperModel] = useState<WhisperModelID>(DEFAULT_WHISPER_MODEL)
  const [onboardingReady, setOnboardingReady] = useState(false)
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [microphonePermissionState, setMicrophonePermissionState] = useState<PermissionPromptState>("idle")
  const [notificationPermissionState, setNotificationPermissionState] = useState<PermissionPromptState>("idle")
  const [localNetworkPermissionState, setLocalNetworkPermissionState] = useState<PermissionPromptState>("idle")
  const [activeWhisperModel, setActiveWhisperModel] = useState<WhisperModelID | null>(null)
  const [installedWhisperModels, setInstalledWhisperModels] = useState<WhisperModelID[]>([])
  const [whisperSettingsOpen, setWhisperSettingsOpen] = useState(false)
  const [downloadingModelID, setDownloadingModelID] = useState<WhisperModelID | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isPreparingWhisperModel, setIsPreparingWhisperModel] = useState(true)
  const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionMode>(DEFAULT_TRANSCRIPTION_MODE)
  const [isTranscribingBulk, setIsTranscribingBulk] = useState(false)
  const [whisperError, setWhisperError] = useState("")
  const [transcribedText, setTranscribedText] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [controlsWidth, setControlsWidth] = useState(0)
  const [hasCompletedSession, setHasCompletedSession] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [monitorJob, setMonitorJob] = useState<MonitorJob | null>(null)
  const [monitorStatus, setMonitorStatus] = useState<string>("")
  const [latestAssistantResponse, setLatestAssistantResponse] = useState("")
  const [agentStateDismissed, setAgentStateDismissed] = useState(false)
  const [devicePushToken, setDevicePushToken] = useState<string | null>(null)
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState)
  const [dropdownMode, setDropdownMode] = useState<DropdownMode>("none")
  const [dropdownRenderMode, setDropdownRenderMode] = useState<Exclude<DropdownMode, "none">>("server")
  const [scanOpen, setScanOpen] = useState(false)
  const [camGranted, setCamGranted] = useState(false)
  const [servers, setServers] = useState<ServerItem[]>([])
  const [activeServerId, setActiveServerId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [waveformLevels, setWaveformLevels] = useState<number[]>(Array.from({ length: 24 }, () => 0))
  const [waveformTick, setWaveformTick] = useState(0)
  const waveformLevelsRef = useRef<number[]>(Array.from({ length: 24 }, () => 0))
  const serversRef = useRef<ServerItem[]>([])
  const lastWaveformCommitRef = useRef(0)
  const sendPlayer = useAudioPlayer(require("../../assets/sounds/send-whoosh.mp3"))
  const completePlayer = useAudioPlayer(require("../../assets/sounds/complete.wav"))

  const isRecordingRef = useRef(false)
  const isStartingRef = useRef(false)
  const activeSessionRef = useRef(0)
  const scrollViewRef = useRef<ScrollView>(null)
  const isHoldingRef = useRef(false)
  const pressInTimeRef = useRef(0)
  const accumulatedRef = useRef("")
  const baseTextRef = useRef("")
  const whisperContextRef = useRef<WhisperContext | null>(null)
  const whisperContextModelRef = useRef<WhisperModelID | null>(null)
  const whisperTranscriberRef = useRef<RealtimeTranscriber | null>(null)
  const bulkAudioStreamRef = useRef<AudioPcmStreamAdapter | null>(null)
  const bulkAudioChunksRef = useRef<Uint8Array[]>([])
  const bulkTranscriptionJobRef = useRef(0)
  const downloadProgressRef = useRef(0)
  const waveformPulseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sendSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const foregroundMonitorAbortRef = useRef<AbortController | null>(null)
  const monitorJobRef = useRef<MonitorJob | null>(null)
  const pendingNotificationEventsRef = useRef<{ payload: NotificationPayload; source: "received" | "response" }[]>([])
  const notificationHandlerRef = useRef<(payload: NotificationPayload, source: "received" | "response") => void>(
    (payload, source) => {
      pendingNotificationEventsRef.current.push({ payload, source })
    },
  )
  const previousPushTokenRef = useRef<string | null>(null)
  const previousAppStateRef = useRef<AppStateStatus>(AppState.currentState)
  const scanLockRef = useRef(false)
  const restoredRef = useRef(false)
  const whisperRestoredRef = useRef(false)
  const refreshSeqRef = useRef<Record<string, number>>({})
  const activeServerIdRef = useRef<string | null>(null)
  const activeSessionIdRef = useRef<string | null>(null)
  const latestAssistantRequestRef = useRef(0)

  useEffect(() => {
    serversRef.current = servers
  }, [servers])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const data = await FileSystem.readAsStringAsync(SERVER_STATE_FILE)
        if (!mounted || !data) return
        const parsed = JSON.parse(data) as SavedState
        const next = fromSaved(parsed)
        setServers(next.servers)
        setActiveServerId(next.activeServerId)
        setActiveSessionId(next.activeSessionId)
        console.log("[Server] restore", {
          count: next.servers.length,
          activeServerId: next.activeServerId,
        })
      } catch {
        // No saved servers yet.
      } finally {
        restoredRef.current = true
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    void (async () => {
      let complete = false

      try {
        const data = await FileSystem.readAsStringAsync(ONBOARDING_STATE_FILE)
        if (data) {
          const parsed = JSON.parse(data) as Partial<OnboardingSavedState>
          complete = Boolean(parsed.completed)
        }
      } catch {
        // No onboarding state file yet.
      }

      if (!complete) {
        try {
          const [serverInfo, whisperInfo] = await Promise.all([
            FileSystem.getInfoAsync(SERVER_STATE_FILE),
            FileSystem.getInfoAsync(WHISPER_SETTINGS_FILE),
          ])

          if (serverInfo.exists || whisperInfo.exists) {
            complete = true
          }
        } catch {
          // Keep first-install behavior if metadata check fails.
        }

        if (complete) {
          void FileSystem.writeAsStringAsync(ONBOARDING_STATE_FILE, JSON.stringify({ completed: true })).catch(() => {})
        }
      }

      if (mounted) {
        setOnboardingComplete(complete)
        setOnboardingReady(true)
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!restoredRef.current) return
    const payload = toSaved(servers, activeServerId, activeSessionId)
    void FileSystem.writeAsStringAsync(SERVER_STATE_FILE, JSON.stringify(payload)).catch(() => {})
  }, [activeServerId, activeSessionId, servers])

  useEffect(() => {
    monitorJobRef.current = monitorJob
  }, [monitorJob])

  useEffect(() => {
    activeServerIdRef.current = activeServerId
  }, [activeServerId])

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])

  const modelPath = useCallback((modelID: WhisperModelID) => `${WHISPER_MODELS_DIR}/${modelID}`, [])

  const refreshInstalledWhisperModels = useCallback(async () => {
    const next: WhisperModelID[] = []

    for (const modelID of WHISPER_MODELS) {
      try {
        const info = await FileSystem.getInfoAsync(modelPath(modelID))
        if (info.exists) {
          next.push(modelID)
        }
      } catch {
        // Ignore model metadata read errors.
      }
    }

    setInstalledWhisperModels(next)
    return next
  }, [modelPath])

  const stopWaveformPulse = useCallback(() => {
    if (waveformPulseIntervalRef.current) {
      clearInterval(waveformPulseIntervalRef.current)
      waveformPulseIntervalRef.current = null
    }
  }, [])

  const clearWaveform = useCallback(() => {
    const cleared = new Array(waveformLevelsRef.current.length).fill(0)
    waveformLevelsRef.current = cleared
    setWaveformLevels(cleared)
    setWaveformTick(Date.now())
  }, [])

  useEffect(() => {
    return () => {
      if (sendSettleTimeoutRef.current) {
        clearTimeout(sendSettleTimeoutRef.current)
      }
      stopWaveformPulse()
    }
  }, [stopWaveformPulse])

  const ensureAudioInputRoute = useCallback(async () => {
    try {
      const devices = await AudioManager.getDevicesInfo()
      if (devices.currentInputs.length === 0 && devices.availableInputs.length > 0) {
        const pick = devices.availableInputs[0]
        await AudioManager.setInputDevice(pick.id)
      }
    } catch {
      // Input route setup is best-effort.
    }
  }, [])

  // Set up audio session and check microphone permissions on mount.
  useEffect(() => {
    void (async () => {
      try {
        AudioManager.setAudioSessionOptions({
          iosCategory: "playAndRecord",
          iosMode: "spokenAudio",
          iosOptions: ["allowBluetoothHFP", "defaultToSpeaker"],
        })

        await AudioManager.setAudioSessionActivity(true)

        const permission = await AudioManager.checkRecordingPermissions()
        const granted = permission === "Granted"
        setPermissionGranted(granted)
        setMicrophonePermissionState(granted ? "granted" : permission === "Denied" ? "denied" : "idle")

        if (granted) {
          await ensureAudioInputRoute()
        }
      } catch (e) {
        console.error("Failed to set up audio session:", e)
      }
    })()
  }, [ensureAudioInputRoute])

  const loadWhisperContext = useCallback(
    async (modelID: WhisperModelID) => {
      if (whisperContextRef.current && whisperContextModelRef.current === modelID) {
        setActiveWhisperModel(modelID)
        return whisperContextRef.current
      }

      setIsPreparingWhisperModel(true)
      setWhisperError("")

      try {
        const existing = whisperContextRef.current
        whisperContextRef.current = null
        whisperContextModelRef.current = null
        if (existing) {
          await existing.release().catch(() => {})
        }

        const context = await initWhisper({
          filePath: modelPath(modelID),
          useGpu: Platform.OS === "ios",
        })

        whisperContextRef.current = context
        whisperContextModelRef.current = modelID
        setActiveWhisperModel(modelID)
        return context
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load Whisper model"
        setWhisperError(message)
        throw error
      } finally {
        setIsPreparingWhisperModel(false)
      }
    },
    [modelPath],
  )

  const downloadWhisperModel = useCallback(
    async (modelID: WhisperModelID) => {
      if (downloadingModelID && downloadingModelID !== modelID) {
        return false
      }

      setDownloadingModelID(modelID)
      downloadProgressRef.current = 0
      setDownloadProgress(0)
      setWhisperError("")

      try {
        await FileSystem.makeDirectoryAsync(WHISPER_MODELS_DIR, { intermediates: true }).catch(() => {})

        const targetPath = modelPath(modelID)
        await FileSystem.deleteAsync(targetPath, { idempotent: true }).catch(() => {})

        const download = FileSystem.createDownloadResumable(
          `${WHISPER_REPO}/${modelID}`,
          targetPath,
          {},
          (event: FileSystem.DownloadProgressData) => {
            const total = event.totalBytesExpectedToWrite
            if (!total) return
            const rawProgress = Math.max(0, Math.min(1, event.totalBytesWritten / total))
            const progress = Math.max(downloadProgressRef.current, rawProgress)
            downloadProgressRef.current = progress
            setDownloadProgress(progress)
          },
        )

        const result = await download.downloadAsync()
        if (!result?.uri) {
          throw new Error("Whisper model download did not complete")
        }

        await refreshInstalledWhisperModels()
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to download Whisper model"
        setWhisperError(message)
        return false
      } finally {
        setDownloadingModelID((current) => (current === modelID ? null : current))
      }
    },
    [downloadingModelID, modelPath, refreshInstalledWhisperModels],
  )

  const ensureWhisperModelReady = useCallback(
    async (modelID: WhisperModelID) => {
      const info = await FileSystem.getInfoAsync(modelPath(modelID))
      if (!info.exists) {
        const downloaded = await downloadWhisperModel(modelID)
        if (!downloaded) {
          throw new Error(`Unable to download ${modelID}`)
        }
      }
      return loadWhisperContext(modelID)
    },
    [downloadWhisperModel, loadWhisperContext, modelPath],
  )

  useEffect(() => {
    let mounted = true

    void (async () => {
      await FileSystem.makeDirectoryAsync(WHISPER_MODELS_DIR, { intermediates: true }).catch(() => {})

      let nextDefaultModel: WhisperModelID = DEFAULT_WHISPER_MODEL
      let nextMode: TranscriptionMode = DEFAULT_TRANSCRIPTION_MODE
      try {
        const data = await FileSystem.readAsStringAsync(WHISPER_SETTINGS_FILE)
        if (data) {
          const parsed = JSON.parse(data) as Partial<WhisperSavedState>
          if (isWhisperModelID(parsed.defaultModel)) {
            nextDefaultModel = parsed.defaultModel
          }
          if (isTranscriptionMode(parsed.mode)) {
            nextMode = parsed.mode
          }
        }
      } catch {
        // Use default settings if state file is missing or invalid.
      }

      if (!mounted) return

      whisperRestoredRef.current = true
      setDefaultWhisperModel(nextDefaultModel)
      setTranscriptionMode(nextMode)

      await refreshInstalledWhisperModels()

      try {
        await ensureWhisperModelReady(nextDefaultModel)
      } catch (error) {
        console.error("[Whisper] Failed to initialize default model:", error)
      } finally {
        if (mounted) {
          setIsPreparingWhisperModel(false)
        }
      }
    })()

    return () => {
      mounted = false
    }
  }, [ensureWhisperModelReady, refreshInstalledWhisperModels])

  useEffect(() => {
    if (!whisperRestoredRef.current) return
    const payload: WhisperSavedState = { defaultModel: defaultWhisperModel, mode: transcriptionMode }
    void FileSystem.writeAsStringAsync(WHISPER_SETTINGS_FILE, JSON.stringify(payload)).catch(() => {})
  }, [defaultWhisperModel, transcriptionMode])

  useEffect(() => {
    return () => {
      const transcriber = whisperTranscriberRef.current
      whisperTranscriberRef.current = null
      if (transcriber) {
        void (async () => {
          await transcriber.stop().catch(() => {})
          await transcriber.release().catch(() => {})
        })()
      }

      const bulkStream = bulkAudioStreamRef.current
      bulkAudioStreamRef.current = null
      if (bulkStream) {
        void (async () => {
          await bulkStream.stop().catch(() => {})
          await bulkStream.release().catch(() => {})
        })()
      }

      const context = whisperContextRef.current
      whisperContextRef.current = null
      whisperContextModelRef.current = null

      if (context) {
        void context.release().catch(() => {})
      }

      void releaseAllWhisper().catch(() => {})
    }
  }, [])

  const startWaveformPulse = useCallback(() => {
    if (waveformPulseIntervalRef.current) return

    waveformPulseIntervalRef.current = setInterval(() => {
      if (!isRecordingRef.current) return

      const next = waveformLevelsRef.current.map((value) => {
        const decay = value * 0.45
        const lift = Math.random() * 0.95
        return Math.max(0.08, Math.min(1, decay + lift * 0.55))
      })

      waveformLevelsRef.current = next

      const now = Date.now()
      if (now - lastWaveformCommitRef.current > 45) {
        setWaveformLevels(next)
        setWaveformTick(now)
        lastWaveformCommitRef.current = now
      }
    }, 70)
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState)
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        if (Platform.OS !== "ios") return
        const existing = await Notifications.getPermissionsAsync()
        const granted = Boolean((existing as { granted?: unknown }).granted)
        if (active) {
          setNotificationPermissionState(granted ? "granted" : "idle")
        }
        if (!granted) return
        const token = await getDevicePushToken()
        if (token) {
          setDevicePushToken(token)
        }
      } catch {
        // Non-fatal: monitoring can still work in-app via foreground SSE.
      }
    })()

    const sub = onPushTokenChange((token) => {
      if (!active) return
      setDevicePushToken(token)
    })

    return () => {
      active = false
      sub.remove()
    }
  }, [])

  useEffect(() => {
    const notificationSub = Notifications.addNotificationReceivedListener((notification: unknown) => {
      const data = (notification as { request?: { content?: { data?: unknown } } }).request?.content?.data
      const payload = parseNotificationPayload(data)
      if (!payload) return
      notificationHandlerRef.current(payload, "received")
    })

    const responseSub = Notifications.addNotificationResponseReceivedListener((response: unknown) => {
      const data = (response as { notification?: { request?: { content?: { data?: unknown } } } }).notification?.request
        ?.content?.data
      const payload = parseNotificationPayload(data)
      if (!payload) return
      notificationHandlerRef.current(payload, "response")
    })

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return
        const data = (response as { notification?: { request?: { content?: { data?: unknown } } } }).notification
          ?.request?.content?.data
        const payload = parseNotificationPayload(data)
        if (!payload) return
        notificationHandlerRef.current(payload, "response")
      })
      .catch(() => {})

    return () => {
      notificationSub.remove()
      responseSub.remove()
    }
  }, [])

  const finalizeRecordingState = useCallback(() => {
    isRecordingRef.current = false
    activeSessionRef.current = 0
    isStartingRef.current = false
    setIsRecording(false)
    stopWaveformPulse()
    clearWaveform()
  }, [clearWaveform, stopWaveformPulse])

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || isStartingRef.current || downloadingModelID || isTranscribingBulk) return

    isStartingRef.current = true
    const sessionID = Date.now()
    activeSessionRef.current = sessionID
    accumulatedRef.current = ""
    baseTextRef.current = normalizeTranscriptSessions(transcribedText)
    if (baseTextRef.current !== transcribedText) {
      setTranscribedText(baseTextRef.current)
    }
    isRecordingRef.current = true
    setIsRecording(true)
    setWhisperError("")

    const cancelled = () => !isRecordingRef.current || activeSessionRef.current !== sessionID

    try {
      const context = await ensureWhisperModelReady(defaultWhisperModel)
      if (cancelled()) {
        isStartingRef.current = false
        return
      }

      const previousTranscriber = whisperTranscriberRef.current
      whisperTranscriberRef.current = null
      if (previousTranscriber) {
        await previousTranscriber.stop().catch(() => {})
        await previousTranscriber.release().catch(() => {})
      }

      const previousBulkStream = bulkAudioStreamRef.current
      bulkAudioStreamRef.current = null
      if (previousBulkStream) {
        await previousBulkStream.stop().catch(() => {})
        await previousBulkStream.release().catch(() => {})
      }

      bulkAudioChunksRef.current = []
      bulkTranscriptionJobRef.current = 0

      startWaveformPulse()

      const englishOnlyModel = isEnglishOnlyWhisperModel(defaultWhisperModel)

      if (transcriptionMode === "bulk") {
        const audioStream = new AudioPcmStreamAdapter()
        audioStream.onData((packet: unknown) => {
          if (activeSessionRef.current !== sessionID) return
          const data = (packet as { data?: unknown }).data
          if (!(data instanceof Uint8Array) || data.length === 0) return
          bulkAudioChunksRef.current.push(new Uint8Array(data))
        })
        audioStream.onError((error: string) => {
          if (activeSessionRef.current !== sessionID) return
          setWhisperError(error)
          console.error("[Dictation] Bulk audio stream error:", error)
        })

        await audioStream.initialize({
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          bufferSize: 16 * 1024,
          audioSource: 6,
        })
        await audioStream.start()

        bulkAudioStreamRef.current = audioStream

        if (cancelled()) {
          await audioStream.stop().catch(() => {})
          await audioStream.release().catch(() => {})
          if (bulkAudioStreamRef.current === audioStream) {
            bulkAudioStreamRef.current = null
          }
          finalizeRecordingState()
          return
        }

        isStartingRef.current = false
        return
      }

      const transcriber = new RealtimeTranscriber(
        {
          whisperContext: context,
          audioStream: new AudioPcmStreamAdapter(),
        },
        {
          audioSliceSec: 4,
          audioMinSec: 0.8,
          maxSlicesInMemory: 6,
          transcribeOptions: {
            language: englishOnlyModel ? "en" : "auto",
            translate: !englishOnlyModel,
            maxLen: 1,
          },
          logger: () => {},
        },
        {
          onTranscribe: (event: RealtimeTranscribeEvent) => {
            if (activeSessionRef.current !== sessionID) return
            if (event.type !== "transcribe") return

            const nextSessionText = mergeTranscriptChunk(accumulatedRef.current, event.data?.result ?? "")
            accumulatedRef.current = nextSessionText

            const base = normalizeTranscriptSessions(baseTextRef.current)
            const separator = base.length > 0 && nextSessionText.length > 0 ? "\n\n" : ""
            setTranscribedText(normalizeTranscriptSessions(base + separator + nextSessionText))

            if (nextSessionText.length > 0) {
              setHasCompletedSession(true)
            }
          },
          onError: (error: string) => {
            if (activeSessionRef.current !== sessionID) return
            console.error("[Dictation] Whisper realtime error:", error)
            setWhisperError(error)
          },
          onStatusChange: (active: boolean) => {
            if (activeSessionRef.current !== sessionID) return
            if (!active) {
              if (whisperTranscriberRef.current === transcriber) {
                whisperTranscriberRef.current = null
              }
              finalizeRecordingState()
            }
          },
        },
      )

      whisperTranscriberRef.current = transcriber
      await transcriber.start()

      if (cancelled()) {
        await transcriber.stop().catch(() => {})
        await transcriber.release().catch(() => {})
        if (whisperTranscriberRef.current === transcriber) {
          whisperTranscriberRef.current = null
        }
        finalizeRecordingState()
        return
      }

      isStartingRef.current = false
    } catch (error) {
      console.error("[Dictation] Failed to start realtime transcription:", error)
      const message = error instanceof Error ? error.message : "Unable to start transcription"
      setWhisperError(message)

      const activeTranscriber = whisperTranscriberRef.current
      whisperTranscriberRef.current = null
      if (activeTranscriber) {
        void (async () => {
          await activeTranscriber.stop().catch(() => {})
          await activeTranscriber.release().catch(() => {})
        })()
      }

      finalizeRecordingState()
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    }
  }, [
    defaultWhisperModel,
    downloadingModelID,
    ensureWhisperModelReady,
    finalizeRecordingState,
    isTranscribingBulk,
    startWaveformPulse,
    transcriptionMode,
    transcribedText,
  ])

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current && !isStartingRef.current) return

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})

    const baseAtStop = normalizeTranscriptSessions(baseTextRef.current)
    const englishOnlyModel = isEnglishOnlyWhisperModel(defaultWhisperModel)

    const transcriber = whisperTranscriberRef.current
    whisperTranscriberRef.current = null
    if (transcriber) {
      void (async () => {
        await transcriber.stop().catch((error: unknown) => {
          console.warn("[Dictation] Failed to stop realtime transcription:", error)
        })
        await transcriber.release().catch(() => {})
      })()
    }

    const bulkStream = bulkAudioStreamRef.current
    bulkAudioStreamRef.current = null
    const bulkChunks = bulkAudioChunksRef.current
    bulkAudioChunksRef.current = []

    finalizeRecordingState()

    if (transcriptionMode !== "bulk") {
      return
    }

    const runID = Date.now()
    bulkTranscriptionJobRef.current = runID

    void (async () => {
      if (bulkStream) {
        await bulkStream.stop().catch((error: unknown) => {
          console.warn("[Dictation] Failed to stop bulk audio stream:", error)
        })
        await bulkStream.release().catch(() => {})
      }

      if (bulkChunks.length === 0) {
        return
      }

      const totalLength = bulkChunks.reduce((sum, chunk) => sum + chunk.length, 0)
      if (totalLength === 0) {
        return
      }

      const merged = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of bulkChunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }

      const context = whisperContextRef.current
      if (!context) {
        setWhisperError("Whisper model is not loaded")
        return
      }

      setIsTranscribingBulk(true)

      try {
        const { promise } = context.transcribeData(merged.buffer, {
          language: englishOnlyModel ? "en" : "auto",
          translate: !englishOnlyModel,
          maxLen: 1,
        })

        const result = await promise
        if (bulkTranscriptionJobRef.current !== runID) {
          return
        }

        const sessionText = cleanSessionText(result.result ?? "")
        if (!sessionText) {
          return
        }

        const separator = baseAtStop.length > 0 ? "\n\n" : ""
        setTranscribedText(normalizeTranscriptSessions(baseAtStop + separator + sessionText))
        setHasCompletedSession(true)
      } catch (error) {
        if (bulkTranscriptionJobRef.current !== runID) {
          return
        }
        const message = error instanceof Error ? error.message : "Bulk transcription failed"
        setWhisperError(message)
        console.error("[Dictation] Bulk transcription failed:", error)
      } finally {
        if (bulkTranscriptionJobRef.current === runID) {
          setIsTranscribingBulk(false)
        }
      }
    })()
  }, [defaultWhisperModel, finalizeRecordingState, transcriptionMode])

  const clearIconRotation = useSharedValue(0)
  const sendOutProgress = useSharedValue(0)

  const handleClearTranscript = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {})

    clearIconRotation.value = withSequence(
      withTiming(-30, { duration: 90 }),
      withTiming(30, { duration: 120 }),
      withTiming(0, { duration: 90 }),
    )

    if (isRecordingRef.current) {
      stopRecording()
    }
    accumulatedRef.current = ""
    baseTextRef.current = ""
    setTranscribedText("")
    setHasCompletedSession(false)
    clearWaveform()
    sendOutProgress.value = 0
    setIsSending(false)
  }, [clearIconRotation, clearWaveform, sendOutProgress, stopRecording])

  const handleHideAgentState = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {})
    setAgentStateDismissed(true)
  }, [])

  const resetTranscriptState = useCallback(() => {
    if (isRecordingRef.current) {
      stopRecording()
    }
    accumulatedRef.current = ""
    baseTextRef.current = ""
    setTranscribedText("")
    setHasCompletedSession(false)
    clearWaveform()
  }, [clearWaveform, stopRecording])

  const handleOpenWhisperSettings = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {})
    setDropdownMode("none")
    setWhisperSettingsOpen(true)
  }, [])

  const handleDownloadWhisperModel = useCallback(
    async (modelID: WhisperModelID) => {
      const ok = await downloadWhisperModel(modelID)
      if (ok) {
        void Haptics.selectionAsync().catch(() => {})
      }
    },
    [downloadWhisperModel],
  )

  const handleSelectWhisperModel = useCallback(
    async (modelID: WhisperModelID) => {
      if (isRecordingRef.current || isStartingRef.current) {
        stopRecording()
      }

      try {
        await ensureWhisperModelReady(modelID)
        setDefaultWhisperModel(modelID)
        setWhisperError("")
        void Haptics.selectionAsync().catch(() => {})
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to switch Whisper model"
        setWhisperError(message)
      }
    },
    [ensureWhisperModelReady, stopRecording],
  )

  const handleDeleteWhisperModel = useCallback(
    async (modelID: WhisperModelID) => {
      if (downloadingModelID === modelID) return

      if (isRecordingRef.current || isStartingRef.current) {
        stopRecording()
      }

      if (whisperContextModelRef.current === modelID && whisperContextRef.current) {
        const activeContext = whisperContextRef.current
        whisperContextRef.current = null
        whisperContextModelRef.current = null
        setActiveWhisperModel(null)
        await activeContext.release().catch(() => {})
      }

      await FileSystem.deleteAsync(modelPath(modelID), { idempotent: true }).catch(() => {})
      const nextInstalled = await refreshInstalledWhisperModels()

      if (defaultWhisperModel === modelID) {
        const fallbackModel = nextInstalled[0] ?? DEFAULT_WHISPER_MODEL
        setDefaultWhisperModel(fallbackModel)
        try {
          await ensureWhisperModelReady(fallbackModel)
        } catch {
          // Keep UI responsive if fallback init fails.
        }
      } else if (activeWhisperModel == null && nextInstalled.includes(defaultWhisperModel)) {
        try {
          await ensureWhisperModelReady(defaultWhisperModel)
        } catch {
          // Keep UI responsive if default model init fails.
        }
      }

      void Haptics.selectionAsync().catch(() => {})
    },
    [
      activeWhisperModel,
      defaultWhisperModel,
      downloadingModelID,
      ensureWhisperModelReady,
      modelPath,
      refreshInstalledWhisperModels,
      stopRecording,
    ],
  )

  const handleRequestNotificationPermission = useCallback(async () => {
    if (notificationPermissionState === "pending") return

    setNotificationPermissionState("pending")

    try {
      const granted = await ensureNotificationPermissions()
      setNotificationPermissionState(granted ? "granted" : "denied")

      if (!granted) {
        return
      }

      const token = await getDevicePushToken()
      if (token) {
        setDevicePushToken(token)
      }
    } catch {
      setNotificationPermissionState("denied")
    }
  }, [notificationPermissionState])

  const handleRequestMicrophonePermission = useCallback(async () => {
    if (microphonePermissionState === "pending") return

    setMicrophonePermissionState("pending")

    try {
      const permission = await AudioManager.requestRecordingPermissions()
      const granted = permission === "Granted"
      setPermissionGranted(granted)
      setMicrophonePermissionState(granted ? "granted" : "denied")

      if (granted) {
        await ensureAudioInputRoute()
      }
    } catch {
      setPermissionGranted(false)
      setMicrophonePermissionState("denied")
    }
  }, [ensureAudioInputRoute, microphonePermissionState])

  const handleRequestLocalNetworkPermission = useCallback(async () => {
    if (localNetworkPermissionState === "pending") return

    setLocalNetworkPermissionState("pending")

    const localProbes = new Set<string>([
      "http://192.168.1.1",
      "http://192.168.0.1",
      "http://10.0.0.1",
      "http://100.100.100.100",
    ])

    for (const server of serversRef.current) {
      try {
        const url = new URL(server.url)
        if (looksLikeLocalHost(url.hostname)) {
          localProbes.add(`${url.protocol}//${url.host}`)
        }
      } catch {
        // Skip malformed saved server URL.
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, 1800)

    try {
      await Promise.allSettled(
        [...localProbes].map((base) =>
          expoFetch(`${base.replace(/\/+$/, "")}/health`, {
            method: "GET",
            signal: controller.signal,
          }),
        ),
      )
      setLocalNetworkPermissionState("granted")
    } catch {
      setLocalNetworkPermissionState("denied")
    } finally {
      clearTimeout(timeout)
    }
  }, [localNetworkPermissionState])

  const completeSend = useCallback(() => {
    if (sendSettleTimeoutRef.current) {
      clearTimeout(sendSettleTimeoutRef.current)
    }

    sendSettleTimeoutRef.current = setTimeout(() => {
      resetTranscriptState()
      sendOutProgress.value = 0
      setIsSending(false)
      sendSettleTimeoutRef.current = null
    }, SEND_SETTLE_MS)
  }, [resetTranscriptState, sendOutProgress])

  const stopForegroundMonitor = useCallback(() => {
    const aborter = foregroundMonitorAbortRef.current
    if (aborter) {
      aborter.abort()
      foregroundMonitorAbortRef.current = null
    }
  }, [])

  const loadLatestAssistantResponse = useCallback(async (baseURL: string, sessionID: string) => {
    const requestID = latestAssistantRequestRef.current + 1
    latestAssistantRequestRef.current = requestID

    const base = baseURL.replace(/\/+$/, "")

    try {
      const response = await fetch(`${base}/session/${sessionID}/message?limit=60`)
      if (!response.ok) {
        throw new Error(`Session messages failed (${response.status})`)
      }

      const payload = (await response.json()) as unknown
      const text = findLatestAssistantCompletionText(payload)

      if (latestAssistantRequestRef.current !== requestID) return
      if (activeSessionIdRef.current !== sessionID) return
      setLatestAssistantResponse(text)
      if (text) {
        setAgentStateDismissed(false)
      }
    } catch {
      if (latestAssistantRequestRef.current !== requestID) return
      if (activeSessionIdRef.current !== sessionID) return
      setLatestAssistantResponse("")
    }
  }, [])

  const fetchSessionRuntimeStatus = useCallback(
    async (baseURL: string, sessionID: string): Promise<SessionRuntimeStatus | null> => {
      const base = baseURL.replace(/\/+$/, "")

      try {
        const response = await fetch(`${base}/session/status`)
        if (!response.ok) {
          throw new Error(`Session status failed (${response.status})`)
        }

        const payload = (await response.json()) as unknown
        if (!payload || typeof payload !== "object") return null

        const status = (payload as Record<string, unknown>)[sessionID]
        if (!status || typeof status !== "object") return "idle"

        const type = (status as { type?: unknown }).type
        if (type === "busy" || type === "retry" || type === "idle") {
          return type
        }

        return null
      } catch {
        return null
      }
    },
    [],
  )

  const handleMonitorEvent = useCallback(
    (eventType: MonitorEventType, job: MonitorJob) => {
      setMonitorStatus(formatMonitorEventLabel(eventType))

      if (eventType === "permission") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
        return
      }

      if (eventType === "complete") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
        void completePlayer.seekTo(0)
        void completePlayer.play()
        stopForegroundMonitor()
        setMonitorJob(null)
        void loadLatestAssistantResponse(job.opencodeBaseURL, job.sessionID)
        return
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      stopForegroundMonitor()
      setMonitorJob(null)
    },
    [completePlayer, loadLatestAssistantResponse, stopForegroundMonitor],
  )

  const startForegroundMonitor = useCallback(
    (job: MonitorJob) => {
      stopForegroundMonitor()

      const abortController = new AbortController()
      foregroundMonitorAbortRef.current = abortController

      const base = job.opencodeBaseURL.replace(/\/+$/, "")

      void (async () => {
        try {
          const response = await expoFetch(`${base}/event`, {
            signal: abortController.signal,
            headers: {
              Accept: "text/event-stream",
              "Cache-Control": "no-cache",
            },
          })

          if (!response.ok || !response.body) {
            throw new Error(`SSE monitor failed (${response.status})`)
          }

          for await (const message of parseSSEStream(response.body)) {
            let parsed: OpenCodeEvent | null = null
            try {
              parsed = JSON.parse(message.data) as OpenCodeEvent
            } catch {
              continue
            }

            if (!parsed) continue
            const sessionID = extractSessionID(parsed)
            if (sessionID !== job.sessionID) continue

            const eventType = classifyMonitorEvent(parsed)
            if (!eventType) continue

            const active = monitorJobRef.current
            if (!active || active.id !== job.id) return
            handleMonitorEvent(eventType, job)
          }
        } catch {
          if (abortController.signal.aborted) return
        }
      })()
    },
    [handleMonitorEvent, stopForegroundMonitor],
  )

  const beginMonitoring = useCallback(
    async (job: MonitorJob) => {
      setMonitorJob(job)
      setMonitorStatus("Monitoring…")
      startForegroundMonitor(job)
    },
    [startForegroundMonitor],
  )

  useEffect(() => {
    const active = monitorJobRef.current
    if (!active) return

    if (appState === "active") {
      startForegroundMonitor(active)
      return
    }

    stopForegroundMonitor()
  }, [appState, startForegroundMonitor, stopForegroundMonitor])

  useEffect(() => {
    const active = monitorJobRef.current
    if (!active) return
    if (activeSessionId === active.sessionID) return

    stopForegroundMonitor()
    setMonitorJob(null)
    setMonitorStatus("")
  }, [activeSessionId, stopForegroundMonitor])

  useEffect(() => {
    setLatestAssistantResponse("")
    setAgentStateDismissed(false)
    if (!activeServerId || !activeSessionId) return

    const server = serversRef.current.find((item) => item.id === activeServerId)
    if (!server || server.status !== "online") return
    void loadLatestAssistantResponse(server.url, activeSessionId)
  }, [activeServerId, activeSessionId, loadLatestAssistantResponse])

  useEffect(() => {
    return () => {
      stopForegroundMonitor()
    }
  }, [stopForegroundMonitor])

  const handleSendTranscript = useCallback(async () => {
    const text = transcribedText.trim()
    if (text.length === 0 || isSending || !activeServerId || !activeSessionId) return

    const server = serversRef.current.find((item) => item.id === activeServerId)
    if (!server) return

    const session = server.sessions.find((item) => item.id === activeSessionId)
    if (!session) return

    const base = server.url.replace(/\/+$/, "")

    setIsSending(true)
    setMonitorStatus("Sending prompt…")

    try {
      const response = await fetch(`${base}/session/${session.id}/prompt_async`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parts: [
            {
              type: "text",
              text,
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`Prompt request failed (${response.status})`)
      }

      const nextJob: MonitorJob = {
        id: `job-${Date.now()}`,
        sessionID: session.id,
        opencodeBaseURL: base,
        startedAt: Date.now(),
      }

      await beginMonitoring(nextJob)

      if (server.relaySecret.trim().length === 0) {
        setMonitorStatus("Monitoring (foreground only)")
      }

      void sendPlayer.seekTo(0)
      void sendPlayer.play()

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
      setTimeout(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      }, 70)

      sendOutProgress.value = withTiming(
        1,
        {
          duration: 320,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        },
        (finished) => {
          if (finished) {
            runOnJS(completeSend)()
          }
        },
      )
    } catch {
      setMonitorStatus("Failed to send prompt")
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      setIsSending(false)
      sendOutProgress.value = 0
    }
  }, [
    activeServerId,
    activeSessionId,
    beginMonitoring,
    completeSend,
    isSending,
    sendOutProgress,
    sendPlayer,
    transcribedText,
  ])

  // --- Gesture handling: tap vs hold ---

  const handlePressIn = useCallback(() => {
    pressInTimeRef.current = Date.now()

    if (isRecordingRef.current) return

    setDropdownMode("none")
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    isHoldingRef.current = true
    void startRecording()
  }, [startRecording])

  const handlePressOut = useCallback(() => {
    const pressDuration = Date.now() - pressInTimeRef.current

    if (pressDuration < TAP_THRESHOLD_MS) {
      if (isHoldingRef.current) {
        // Tap started recording on pressIn -- keep it running (toggle ON)
        isHoldingRef.current = false
      } else {
        // Already recording from a previous tap -- this tap stops it
        stopRecording()
      }
    } else {
      // Long press = hold-to-record, stop on release
      isHoldingRef.current = false
      stopRecording()
    }
  }, [stopRecording])

  const modelDownloading = downloadingModelID !== null
  const modelLoading = isPreparingWhisperModel || activeWhisperModel == null || modelDownloading || isTranscribingBulk
  let modelLoadingState: "downloading" | "loading" | "ready" = "ready"
  if (modelDownloading) {
    modelLoadingState = "downloading"
  } else if (modelLoading) {
    modelLoadingState = "loading"
  }
  const pct = Math.round(Math.max(0, Math.min(1, downloadProgress)) * 100)
  const loadingModelLabel = downloadingModelID
    ? WHISPER_MODEL_LABELS[downloadingModelID]
    : WHISPER_MODEL_LABELS[defaultWhisperModel]
  const hasTranscript = transcribedText.trim().length > 0
  const hasAssistantResponse = latestAssistantResponse.trim().length > 0
  const hasAgentActivity = hasAssistantResponse || monitorStatus.trim().length > 0 || monitorJob !== null
  const shouldShowAgentStateCard = hasAgentActivity && !agentStateDismissed
  const showsCompleteState = monitorStatus.toLowerCase().includes("complete")
  let agentStateIcon: "loading" | "done" = "loading"
  if (monitorJob === null && (hasAssistantResponse || showsCompleteState)) {
    agentStateIcon = "done"
  }
  const agentStateText = hasAssistantResponse ? latestAssistantResponse : "Waiting for agent…"
  const shouldShowSend = hasCompletedSession && hasTranscript
  const activeServer = servers.find((s) => s.id === activeServerId) ?? null
  const activeSession = activeServer?.sessions.find((s) => s.id === activeSessionId) ?? null
  const canSendToSession = !!activeServer && activeServer.status === "online" && !!activeSession
  const isDropdownOpen = dropdownMode !== "none"
  const effectiveDropdownMode = isDropdownOpen ? dropdownMode : dropdownRenderMode
  const headerTitle = activeServer?.name ?? "No server configured"
  let headerDotStyle = styles.serverStatusOffline
  if (activeServer?.status === "online") {
    headerDotStyle = styles.serverStatusActive
  } else if (activeServer?.status === "checking") {
    headerDotStyle = styles.serverStatusChecking
  }

  const recordingProgress = useSharedValue(0)
  const sendVisibility = useSharedValue(hasTranscript ? 1 : 0)
  const waveformVisibility = useSharedValue(0)
  const serverMenuProgress = useSharedValue(0)

  useEffect(() => {
    recordingProgress.value = withSpring(isRecording ? 1 : 0, {
      damping: 14,
      stiffness: 140,
      mass: 0.8,
    })
  }, [isRecording, recordingProgress])

  useEffect(() => {
    const isGenerating = isRecording
    waveformVisibility.value = withTiming(isGenerating ? 1 : 0, {
      duration: isGenerating ? 180 : 240,
      easing: Easing.inOut(Easing.quad),
    })
  }, [isRecording, waveformVisibility])

  useEffect(() => {
    serverMenuProgress.value = withTiming(isDropdownOpen ? 1 : 0, {
      duration: isDropdownOpen ? 240 : 240,
      easing: isDropdownOpen ? Easing.bezier(0.2, 0.8, 0.2, 1) : Easing.bezier(0.4, 0, 0.2, 1),
    })
  }, [isDropdownOpen, serverMenuProgress])

  useEffect(() => {
    if (dropdownMode !== "none") {
      setDropdownRenderMode(dropdownMode)
    }
  }, [dropdownMode])

  useEffect(() => {
    sendVisibility.value = shouldShowSend
      ? withTiming(1, {
          duration: 320,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        })
      : withTiming(0, {
          duration: 360,
          easing: Easing.bezier(0.22, 0.61, 0.36, 1),
        })
  }, [shouldShowSend, sendVisibility])

  // Parent clips outer half of center-stroke, so only inner half is visible.
  // borderWidth 6 → 3px visible inward, borderWidth 12 → 6px visible inward.
  const animatedBorderStyle = useAnimatedStyle(() => {
    const progress = recordingProgress.value
    // Width: 3 → ~1.5px visible inward at rest (matches other cards),
    // 12 → ~6px visible inward when active
    const bw = interpolate(progress, [0, 1], [3, 12], Extrapolation.CLAMP)
    return {
      borderWidth: bw,
      borderColor: "#FF2E3F",
    }
  })

  const animatedDotStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(recordingProgress.value, [0, 1], [19, 2], Extrapolation.CLAMP),
  }))

  const animatedClearIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${clearIconRotation.value}deg` }],
  }))

  const animatedSendStyle = useAnimatedStyle(() => ({
    width: interpolate(sendVisibility.value, [0, 1], [0, Math.max((controlsWidth - 8) / 2, 0)], Extrapolation.CLAMP),
    marginLeft: interpolate(sendVisibility.value, [0, 1], [0, 8], Extrapolation.CLAMP),
    opacity: sendVisibility.value,
    transform: [
      {
        translateX: interpolate(sendVisibility.value, [0, 1], [14, 0], Extrapolation.CLAMP),
      },
      {
        scale: interpolate(sendVisibility.value, [0, 1], [0.98, 1], Extrapolation.CLAMP),
      },
    ],
  }))

  const animatedTranscriptSendStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sendOutProgress.value, [0, 1], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(sendOutProgress.value, [0, 1], [0, -44], Extrapolation.CLAMP),
      },
    ],
  }))

  const animatedWaveformRowStyle = useAnimatedStyle(() => ({
    opacity: waveformVisibility.value,
    transform: [
      {
        translateY: interpolate(waveformVisibility.value, [0, 1], [6, 0], Extrapolation.CLAMP),
      },
    ],
  }))

  const menuRows =
    effectiveDropdownMode === "server" ? Math.max(servers.length, 1) : Math.max(activeServer?.sessions.length ?? 0, 1)
  const expandedRowsHeight = Math.min(menuRows, DROPDOWN_VISIBLE_ROWS) * 42
  const addServerExtraHeight = effectiveDropdownMode === "server" ? 38 : 8
  const expandedHeaderHeight = 51 + 12 + expandedRowsHeight + addServerExtraHeight

  const animatedHeaderStyle = useAnimatedStyle(() => ({
    height: interpolate(serverMenuProgress.value, [0, 1], [51, expandedHeaderHeight], Extrapolation.CLAMP),
  }))

  const animatedServerMenuStyle = useAnimatedStyle(() => ({
    opacity: serverMenuProgress.value,
    transform: [
      {
        translateY: interpolate(serverMenuProgress.value, [0, 1], [-8, 0], Extrapolation.CLAMP),
      },
    ],
  }))

  const animatedHeaderShadowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(serverMenuProgress.value, [0, 1], [0, 0.35], Extrapolation.CLAMP),
    shadowRadius: interpolate(serverMenuProgress.value, [0, 1], [0, 18], Extrapolation.CLAMP),
    elevation: interpolate(serverMenuProgress.value, [0, 1], [0, 16], Extrapolation.CLAMP),
  }))

  const waveformColumnMeta = useMemo(
    () =>
      Array.from({ length: waveformLevels.length }, () => ({
        delay: Math.random() * 1.5,
        duration: 1 + Math.random(),
        phase: Math.random() * Math.PI * 2,
      })),
    [waveformLevels.length],
  )

  const getWaveformCellStyle = useCallback(
    (row: number, col: number) => {
      const level = waveformLevels[col] ?? 0
      const rowFromBottom = WAVEFORM_ROWS - 1 - row
      const intensity = Math.max(0, Math.min(1, level * WAVEFORM_ROWS - rowFromBottom))

      const meta = waveformColumnMeta[col]
      const t = waveformTick / 1000
      const basePhase = (Math.max(0, t - meta.delay) / meta.duration) * Math.PI * 2 + meta.phase + row * 0.35
      const pulse = 0.5 + 0.5 * Math.sin(basePhase)

      let alpha = 0.08
      if (intensity > 0) {
        alpha = (0.4 + intensity * 0.6) * (0.85 + pulse * 0.15)
      } else if (isRecording) {
        alpha = 0.1 + pulse * 0.07
      }

      // Base palette around #78839A, with brighter/lower variants by intensity.
      const baseR = 120
      const baseG = 131
      const baseB = 154
      const lift = Math.round(intensity * 28)
      const r = Math.min(255, baseR + lift)
      const g = Math.min(255, baseG + lift)
      const b = Math.min(255, baseB + lift)

      return {
        backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})`,
        borderColor: `rgba(${Math.min(255, r + 8)}, ${Math.min(255, g + 8)}, ${Math.min(255, b + 8)}, ${Math.min(1, alpha + 0.16)})`,
      }
    },
    [isRecording, waveformColumnMeta, waveformLevels, waveformTick],
  )

  const handleControlsLayout = useCallback((event: LayoutChangeEvent) => {
    setControlsWidth(event.nativeEvent.layout.width)
  }, [])

  const handleWaveformLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width
    const columns = Math.max(14, Math.floor((width + WAVEFORM_CELL_GAP) / (WAVEFORM_CELL_SIZE + WAVEFORM_CELL_GAP)))

    if (columns === waveformLevelsRef.current.length) return

    const next = Array.from({ length: columns }, () => 0)
    waveformLevelsRef.current = next
    setWaveformLevels(next)
  }, [])

  const refreshServerStatusAndSessions = useCallback(async (serverID: string, includeSessions = true) => {
    const server = serversRef.current.find((s) => s.id === serverID)
    if (!server) return
    const req = (refreshSeqRef.current[serverID] ?? 0) + 1
    refreshSeqRef.current[serverID] = req
    const current = () => refreshSeqRef.current[serverID] === req

    const candidates = serverBases(server.url)
    const base = candidates[0] ?? server.url.replace(/\/+$/, "")
    const healthURL = `${base}/health`
    const sessionsURL = `${base}/experimental/session?limit=100`
    let insecureRemote = false
    try {
      const parsedBase = new URL(base)
      insecureRemote = parsedBase.protocol === "http:" && !looksLikeLocalHost(parsedBase.hostname)
    } catch {
      insecureRemote = base.startsWith("http://")
    }
    console.log("[Server] refresh:start", {
      id: server.id,
      name: server.name,
      base,
      healthURL,
      sessionsURL,
      includeSessions,
    })

    setServers((prev) => prev.map((s) => (s.id === serverID && includeSessions ? { ...s, sessionsLoading: true } : s)))

    let activeBase = base
    try {
      let healthRes: Response | null = null
      let healthErr: unknown

      for (const item of candidates) {
        const url = `${item}/health`
        try {
          const next = await fetch(url)
          if (next.ok) {
            healthRes = next
            activeBase = item
            if (item !== server.url.replace(/\/+$/, "") && current()) {
              setServers((prev) => prev.map((s) => (s.id === serverID ? { ...s, url: item } : s)))
              console.log("[Server] refresh:scheme-upgrade", {
                id: server.id,
                from: server.url,
                to: item,
              })
            }
            break
          }
          healthRes = next
          activeBase = item
        } catch (err) {
          healthErr = err
          console.log("[Server] health:attempt-error", {
            id: server.id,
            url,
            error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
          })
        }
      }

      const online = !!healthRes?.ok
      if (!current()) {
        console.log("[Server] refresh:stale-skip", { id: server.id, req })
        return
      }
      console.log("[Server] health", {
        id: server.id,
        base: activeBase,
        url: `${activeBase}/health`,
        status: healthRes?.status ?? "fetch_error",
        online,
      })

      if (!online) {
        setServers((prev) =>
          prev.map((s) => (s.id === serverID ? { ...s, status: "offline", sessionsLoading: false, sessions: [] } : s)),
        )
        console.log("[Server] refresh:offline", {
          id: server.id,
          base,
          candidates,
          error: healthErr instanceof Error ? `${healthErr.name}: ${healthErr.message}` : String(healthErr),
        })
        return
      }

      if (!includeSessions) {
        setServers((prev) =>
          prev.map((s) => (s.id === serverID ? { ...s, status: "online", sessionsLoading: false } : s)),
        )
        console.log("[Server] refresh:online", { id: server.id, base })
        return
      }

      const resolvedSessionsURL = `${activeBase}/experimental/session?limit=100`
      const sessionsRes = await fetch(resolvedSessionsURL)
      if (!current()) {
        console.log("[Server] refresh:stale-skip", { id: server.id, req })
        return
      }
      if (!sessionsRes.ok) {
        console.log("[Server] sessions:http-error", {
          id: server.id,
          url: resolvedSessionsURL,
          status: sessionsRes.status,
        })
      }

      const json = sessionsRes.ok ? await sessionsRes.json() : []
      const sessions = parseSessionItems(json)

      setServers((prev) =>
        prev.map((s) => (s.id === serverID ? { ...s, status: "online", sessionsLoading: false, sessions } : s)),
      )
      console.log("[Server] sessions", { id: server.id, count: sessions.length })
    } catch (err) {
      if (!current()) {
        console.log("[Server] refresh:stale-skip", { id: server.id, req })
        return
      }
      setServers((prev) =>
        prev.map((s) => (s.id === serverID ? { ...s, status: "offline", sessionsLoading: false, sessions: [] } : s)),
      )
      console.log("[Server] refresh:error", {
        id: server.id,
        base,
        healthURL,
        sessionsURL,
        candidates,
        insecureRemote,
        error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      })
      if (insecureRemote) {
        console.log("[Server] refresh:hint", {
          id: server.id,
          message: "Remote http:// host may be blocked by iOS ATS; prefer https:// for non-local hosts.",
        })
      }
    }
  }, [])

  const refreshAllServerHealth = useCallback(() => {
    const ids = serversRef.current.map((s) => s.id)
    ids.forEach((id) => {
      void refreshServerStatusAndSessions(id, false)
    })
  }, [refreshServerStatusAndSessions])

  const syncSessionState = useCallback(
    async (input: { serverID: string; sessionID: string; preserveStatusLabel?: boolean }) => {
      await refreshServerStatusAndSessions(input.serverID)

      const server = serversRef.current.find((item) => item.id === input.serverID)
      if (!server || server.status !== "online") return

      const runtimeStatus = await fetchSessionRuntimeStatus(server.url, input.sessionID)
      await loadLatestAssistantResponse(server.url, input.sessionID)

      if (runtimeStatus === "busy" || runtimeStatus === "retry") {
        const nextJob: MonitorJob = {
          id: `job-resume-${Date.now()}`,
          sessionID: input.sessionID,
          opencodeBaseURL: server.url.replace(/\/+$/, ""),
          startedAt: Date.now(),
        }

        setMonitorJob(nextJob)
        setMonitorStatus("Monitoring…")
        if (appState === "active") {
          startForegroundMonitor(nextJob)
        }
        return
      }

      if (runtimeStatus === "idle") {
        stopForegroundMonitor()
        setMonitorJob(null)
        if (!input.preserveStatusLabel) {
          setMonitorStatus("")
        }
      }
    },
    [
      appState,
      fetchSessionRuntimeStatus,
      loadLatestAssistantResponse,
      refreshServerStatusAndSessions,
      startForegroundMonitor,
      stopForegroundMonitor,
    ],
  )

  const findServerForSession = useCallback(
    async (sessionID: string, preferredServerID?: string | null): Promise<ServerItem | null> => {
      if (!serversRef.current.length && !restoredRef.current) {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 150))
          if (serversRef.current.length > 0 || restoredRef.current) {
            break
          }
        }
      }

      if (preferredServerID) {
        const preferred = serversRef.current.find((server) => server.serverID === preferredServerID)
        if (preferred?.sessions.some((session) => session.id === sessionID)) {
          return preferred
        }
        if (preferred) {
          await refreshServerStatusAndSessions(preferred.id)
          const refreshed = serversRef.current.find((server) => server.id === preferred.id)
          if (refreshed?.sessions.some((session) => session.id === sessionID)) {
            return refreshed
          }
        }
      }

      const direct = serversRef.current.find((server) => server.sessions.some((session) => session.id === sessionID))
      if (direct) return direct

      const ids = serversRef.current.map((server) => server.id)
      for (const id of ids) {
        await refreshServerStatusAndSessions(id)
        const matched = serversRef.current.find(
          (server) => server.id === id && server.sessions.some((session) => session.id === sessionID),
        )
        if (matched) {
          return matched
        }
      }

      return null
    },
    [refreshServerStatusAndSessions],
  )

  const handleNotificationPayload = useCallback(
    async (payload: NotificationPayload, source: "received" | "response") => {
      const activeServer = activeServerIdRef.current
        ? serversRef.current.find((server) => server.id === activeServerIdRef.current)
        : null
      const matchesActiveSession =
        !!payload.sessionID &&
        activeSessionIdRef.current === payload.sessionID &&
        (!payload.serverID || activeServer?.serverID === payload.serverID)

      if (payload.eventType && (source === "response" || matchesActiveSession || !payload.sessionID)) {
        setMonitorStatus(formatMonitorEventLabel(payload.eventType))
      }

      if (payload.eventType === "complete" && source === "received") {
        void completePlayer.seekTo(0)
        void completePlayer.play()
      }

      if (
        (payload.eventType === "complete" || payload.eventType === "error") &&
        (source === "response" || matchesActiveSession)
      ) {
        stopForegroundMonitor()
        setMonitorJob(null)
      }

      if (!payload.sessionID) return

      if (source === "response") {
        const matched = await findServerForSession(payload.sessionID, payload.serverID)
        if (!matched) {
          console.log("[Notification] open:session-not-found", {
            serverID: payload.serverID,
            sessionID: payload.sessionID,
            eventType: payload.eventType,
          })
          return
        }

        activeServerIdRef.current = matched.id
        activeSessionIdRef.current = payload.sessionID
        setActiveServerId(matched.id)
        setActiveSessionId(payload.sessionID)
        setDropdownMode("none")
        setAgentStateDismissed(false)

        await syncSessionState({
          serverID: matched.id,
          sessionID: payload.sessionID,
          preserveStatusLabel: Boolean(payload.eventType),
        })
        return
      }

      if (!matchesActiveSession) return

      const activeServerID = activeServerIdRef.current
      if (!activeServerID) return

      await syncSessionState({
        serverID: activeServerID,
        sessionID: payload.sessionID,
        preserveStatusLabel: Boolean(payload.eventType),
      })
    },
    [completePlayer, findServerForSession, stopForegroundMonitor, syncSessionState],
  )

  useEffect(() => {
    notificationHandlerRef.current = (payload, source) => {
      void handleNotificationPayload(payload, source)
    }

    if (!pendingNotificationEventsRef.current.length) return

    const queued = [...pendingNotificationEventsRef.current]
    pendingNotificationEventsRef.current = []
    queued.forEach(({ payload, source }) => {
      void handleNotificationPayload(payload, source)
    })
  }, [handleNotificationPayload])

  useEffect(() => {
    const previous = previousAppStateRef.current
    previousAppStateRef.current = appState

    if (appState !== "active" || previous === "active") return

    const serverID = activeServerIdRef.current
    const sessionID = activeSessionIdRef.current
    if (!serverID || !sessionID) return

    void syncSessionState({ serverID, sessionID })
  }, [appState, syncSessionState])

  const toggleServerMenu = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {})
    setDropdownMode((prev) => {
      const next = prev === "server" ? "none" : "server"
      if (next === "server") {
        setDropdownRenderMode("server")
      }
      if (next === "server") {
        refreshAllServerHealth()
      }
      return next
    })
  }, [refreshAllServerHealth])

  const toggleSessionMenu = useCallback(() => {
    if (!activeServer || activeServer.status !== "online") return
    void Haptics.selectionAsync().catch(() => {})
    void refreshServerStatusAndSessions(activeServer.id)
    setDropdownRenderMode("session")
    setDropdownMode((prev) => (prev === "session" ? "none" : "session"))
  }, [activeServer, refreshServerStatusAndSessions])

  const closeDropdown = useCallback(() => {
    setDropdownMode("none")
  }, [])

  const handleSelectServer = useCallback(
    (id: string) => {
      setActiveServerId(id)
      setActiveSessionId(null)
      setDropdownMode("none")
      void refreshServerStatusAndSessions(id)
    },
    [refreshServerStatusAndSessions],
  )

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id)
    setDropdownMode("none")
  }, [])

  const handleDeleteServer = useCallback(
    (id: string) => {
      const server = serversRef.current.find((s) => s.id === id)
      if (server && devicePushToken && server.relaySecret.trim().length > 0) {
        unregisterRelayDevice({
          relayBaseURL: server.relayURL,
          secret: server.relaySecret.trim(),
          deviceToken: devicePushToken,
        }).catch(() => {})
      }

      setServers((prev) => prev.filter((s) => s.id !== id))
      setActiveServerId((prev) => (prev === id ? null : prev))
      if (activeServerId === id) {
        setActiveSessionId(null)
      }
    },
    [activeServerId, devicePushToken],
  )

  const addServer = useCallback(
    (serverURL: string, relayURL: string, relaySecretRaw: string, serverIDRaw?: string) => {
      const raw = serverURL.trim()
      if (!raw) return false

      const normalized = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `http://${raw}`

      const rawRelay = relayURL.trim()
      const relayNormalizedRaw = rawRelay.length > 0 ? rawRelay : DEFAULT_RELAY_URL
      const normalizedRelay =
        relayNormalizedRaw.startsWith("http://") || relayNormalizedRaw.startsWith("https://")
          ? relayNormalizedRaw
          : `http://${relayNormalizedRaw}`

      let parsed: URL
      let relayParsed: URL
      try {
        parsed = new URL(normalized)
        relayParsed = new URL(normalizedRelay)
      } catch {
        return false
      }

      const id = `srv-${Date.now()}`
      const relaySecret = relaySecretRaw.trim()
      const serverID = typeof serverIDRaw === "string" && serverIDRaw.length > 0 ? serverIDRaw : null
      const url = `${parsed.protocol}//${parsed.host}`
      const inferredName =
        parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" ? "Local OpenCode" : parsed.hostname
      const relay = `${relayParsed.protocol}//${relayParsed.host}`
      const existing = serversRef.current.find(
        (item) =>
          item.url === url &&
          item.relayURL === relay &&
          item.relaySecret.trim() === relaySecret &&
          (!serverID || item.serverID === serverID || item.serverID === null),
      )
      if (existing) {
        if (serverID && existing.serverID !== serverID) {
          setServers((prev) =>
            prev.map((item) => (item.id === existing.id ? { ...item, serverID: serverID ?? item.serverID } : item)),
          )
        }
        setActiveServerId(existing.id)
        setActiveSessionId(null)
        setDropdownMode("none")
        void refreshServerStatusAndSessions(existing.id)
        return true
      }

      setServers((prev) => [
        ...prev,
        {
          id,
          name: inferredName,
          url,
          serverID,
          relayURL: relay,
          relaySecret,
          status: "offline",
          sessions: [],
          sessionsLoading: false,
        },
      ])
      setActiveServerId(id)
      setActiveSessionId(null)
      setDropdownMode("none")
      void refreshServerStatusAndSessions(id)
      return true
    },
    [refreshServerStatusAndSessions],
  )

  const handleStartScan = useCallback(async () => {
    scanLockRef.current = false
    const current =
      camera ??
      (await import("expo-camera")
        .catch(() => null)
        .then((mod) => {
          if (!mod) return null

          const direct = (mod as { requestCameraPermissionsAsync?: unknown }).requestCameraPermissionsAsync
          const fromCamera = (mod as { Camera?: { requestCameraPermissionsAsync?: unknown } }).Camera
            ?.requestCameraPermissionsAsync
          let requestCameraPermissionsAsync: (() => Promise<{ granted: boolean }>) | null = null
          if (typeof direct === "function") {
            requestCameraPermissionsAsync = direct as () => Promise<{ granted: boolean }>
          } else if (typeof fromCamera === "function") {
            requestCameraPermissionsAsync = fromCamera as () => Promise<{ granted: boolean }>
          }

          if (!requestCameraPermissionsAsync) {
            return null
          }

          const next = {
            CameraView: mod.CameraView,
            requestCameraPermissionsAsync,
          }
          setCamera(next)
          return next
        }))
    if (!current) {
      Alert.alert("Scanner unavailable", "This build does not include camera support. Reinstall the latest dev build.")
      return
    }
    if (camGranted) {
      setScanOpen(true)
      return
    }
    const res = await current.requestCameraPermissionsAsync()
    if (!res.granted) return
    setCamGranted(true)
    setScanOpen(true)
  }, [camGranted, camera])

  const completeOnboarding = useCallback(
    (openScanner: boolean) => {
      setOnboardingComplete(true)
      void FileSystem.writeAsStringAsync(ONBOARDING_STATE_FILE, JSON.stringify({ completed: true })).catch(() => {})

      if (openScanner) {
        void handleStartScan()
      }
    },
    [handleStartScan],
  )

  const handleReplayOnboarding = useCallback(() => {
    setWhisperSettingsOpen(false)
    setScanOpen(false)
    setDropdownMode("none")
    setOnboardingStep(0)
    setMicrophonePermissionState(permissionGranted ? "granted" : "idle")
    setNotificationPermissionState("idle")
    setLocalNetworkPermissionState("idle")
    setOnboardingReady(true)
    setOnboardingComplete(false)
    void FileSystem.deleteAsync(ONBOARDING_STATE_FILE, { idempotent: true }).catch(() => {})
  }, [permissionGranted])

  const connectPairPayload = useCallback(
    (rawData: string, source: "scan" | "link") => {
      const fromScan = source === "scan"
      if (fromScan && scanLockRef.current) return

      if (fromScan) {
        scanLockRef.current = true
      }

      const pair = parsePair(rawData)
      if (!pair) {
        if (fromScan) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
          setTimeout(() => {
            scanLockRef.current = false
          }, 750)
        }
        return
      }

      void pickHost(pair.hosts)
        .then((host) => {
          if (!host) {
            if (fromScan) {
              scanLockRef.current = false
            }
            return
          }

          const ok = addServer(host, pair.relayURL, pair.relaySecret, pair.serverID)
          if (!ok) {
            if (fromScan) {
              scanLockRef.current = false
            }
            return
          }

          setScanOpen(false)
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
        })
        .catch(() => {
          if (fromScan) {
            scanLockRef.current = false
          }
        })
    },
    [addServer],
  )

  const handleScan = useCallback(
    (event: Scan) => {
      connectPairPayload(event.data, "scan")
    },
    [connectPairPayload],
  )

  useEffect(() => {
    if (scanOpen) return
    scanLockRef.current = false
  }, [scanOpen])

  useEffect(() => {
    let active = true

    const handleURL = async (url: string | null) => {
      if (!url) return
      if (!parsePair(url)) return

      if (!restoredRef.current) {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          if (restoredRef.current || !active) {
            break
          }
        }
      }

      if (!active) return
      connectPairPayload(url, "link")
    }

    void Linking.getInitialURL()
      .then((url) => handleURL(url))
      .catch(() => {})

    const sub = Linking.addEventListener("url", (event) => {
      void handleURL(event.url)
    })

    return () => {
      active = false
      sub.remove()
    }
  }, [connectPairPayload])

  useEffect(() => {
    if (!activeServerId) return
    void refreshServerStatusAndSessions(activeServerId)
    const timer = setInterval(() => {
      void refreshServerStatusAndSessions(activeServerId)
    }, 15000)
    return () => clearInterval(timer)
  }, [activeServerId, refreshServerStatusAndSessions])

  // Stable key that only changes when relay-relevant server properties change
  // (id, relayURL, relaySecret), not on status/session/sessionsLoading updates.
  const relayServersKey = useMemo(
    () =>
      servers
        .filter((s) => s.relaySecret.trim().length > 0)
        .map((s) => `${s.id}:${s.relayURL}:${s.relaySecret.trim()}`)
        .join("|"),
    [servers],
  )

  useEffect(() => {
    if (Platform.OS !== "ios") return
    if (!devicePushToken) return

    const list = serversRef.current.filter((server) => server.relaySecret.trim().length > 0)
    if (!list.length) return

    const bundleId = Constants.expoConfig?.ios?.bundleIdentifier ?? "com.anomalyco.mobilevoice"
    const apnsEnv = "production"
    console.log("[Relay] env", {
      dev: __DEV__,
      node: process.env.NODE_ENV,
      apnsEnv,
    })
    console.log("[Relay] register:batch", {
      tokenSuffix: devicePushToken.slice(-8),
      count: list.length,
      apnsEnv,
      bundleId,
    })

    void Promise.allSettled(
      list.map(async (server) => {
        const secret = server.relaySecret.trim()
        const relay = server.relayURL
        console.log("[Relay] register:start", {
          id: server.id,
          relay,
          tokenSuffix: devicePushToken.slice(-8),
          secretLength: secret.length,
        })
        try {
          await registerRelayDevice({
            relayBaseURL: relay,
            secret,
            deviceToken: devicePushToken,
            bundleId,
            apnsEnv,
          })
          console.log("[Relay] register:ok", { id: server.id, relay })
        } catch (err) {
          console.log("[Relay] register:error", {
            id: server.id,
            relay,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }),
    ).catch(() => {})
  }, [devicePushToken, relayServersKey])

  useEffect(() => {
    if (Platform.OS !== "ios") return
    if (!devicePushToken) return
    const previous = previousPushTokenRef.current
    previousPushTokenRef.current = devicePushToken
    if (!previous || previous === devicePushToken) return

    const list = serversRef.current.filter((server) => server.relaySecret.trim().length > 0)
    if (!list.length) return
    console.log("[Relay] unregister:batch", {
      previousSuffix: previous.slice(-8),
      nextSuffix: devicePushToken.slice(-8),
      count: list.length,
    })

    void Promise.allSettled(
      list.map(async (server) => {
        const secret = server.relaySecret.trim()
        const relay = server.relayURL
        console.log("[Relay] unregister:start", {
          id: server.id,
          relay,
          tokenSuffix: previous.slice(-8),
          secretLength: secret.length,
        })
        try {
          await unregisterRelayDevice({
            relayBaseURL: relay,
            secret,
            deviceToken: previous,
          })
          console.log("[Relay] unregister:ok", { id: server.id, relay })
        } catch (err) {
          console.log("[Relay] unregister:error", {
            id: server.id,
            relay,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }),
    ).catch(() => {})
  }, [devicePushToken, relayServersKey])

  const defaultModelInstalled = installedWhisperModels.includes(defaultWhisperModel)
  let onboardingProgressRaw = 0
  if (downloadingModelID) {
    onboardingProgressRaw = downloadProgress
  } else if (defaultModelInstalled || activeWhisperModel === defaultWhisperModel) {
    onboardingProgressRaw = 1
  } else if (isPreparingWhisperModel) {
    onboardingProgressRaw = 0.12
  }
  const onboardingProgress = Math.max(0, Math.min(1, onboardingProgressRaw))
  const onboardingProgressPct = Math.round(onboardingProgress * 100)
  let onboardingModelStatus = "Downloading model in background"
  if (downloadingModelID) {
    onboardingModelStatus = `Downloading model in background ${onboardingProgressPct}%`
  } else if (onboardingProgress >= 1) {
    onboardingModelStatus = "Model ready in background"
  }
  const onboardingSteps = [
    {
      title: "Allow mic access.",
      body: "Control only listens while you hold the record button.",
      primaryLabel: microphonePermissionState === "pending" ? "Requesting microphone..." : "Allow microphone",
      primaryDisabled: microphonePermissionState === "pending",
      secondaryLabel: "Continue without granting",
      visualTag: "MIC",
      visualSurfaceStyle: styles.onboardingVisualSurfaceMic,
      visualOrbStyle: styles.onboardingVisualOrbMic,
      visualTagStyle: styles.onboardingVisualTagMic,
    },
    {
      title: "Turn on notifications.",
      body: "Get alerts when your OpenCode run finishes, fails, or needs your attention.",
      primaryLabel: notificationPermissionState === "pending" ? "Requesting notifications..." : "Allow notifications",
      primaryDisabled: notificationPermissionState === "pending",
      secondaryLabel: "Continue without granting",
      visualTag: "PUSH",
      visualSurfaceStyle: styles.onboardingVisualSurfaceNotifications,
      visualOrbStyle: styles.onboardingVisualOrbNotifications,
      visualTagStyle: styles.onboardingVisualTagNotifications,
    },
    {
      title: "Enable local network.",
      body: "This lets Control discover your machine on the same network.",
      primaryLabel: localNetworkPermissionState === "pending" ? "Requesting local network..." : "Allow local network",
      primaryDisabled: localNetworkPermissionState === "pending",
      secondaryLabel: "Continue without granting",
      visualTag: "LAN",
      visualSurfaceStyle: styles.onboardingVisualSurfaceNetwork,
      visualOrbStyle: styles.onboardingVisualOrbNetwork,
      visualTagStyle: styles.onboardingVisualTagNetwork,
    },
    {
      title: "Pair your computer.",
      body: "Start `opencode serve` on your computer, then scan the QR code to pair.",
      primaryLabel: "Scan OpenCode QR",
      primaryDisabled: false,
      secondaryLabel: "I will do this later",
      visualTag: "PAIR",
      visualSurfaceStyle: styles.onboardingVisualSurfacePair,
      visualOrbStyle: styles.onboardingVisualOrbPair,
      visualTagStyle: styles.onboardingVisualTagPair,
    },
  ] as const
  const onboardingStepCount = onboardingSteps.length
  const clampedOnboardingStep = Math.max(0, Math.min(onboardingStep, onboardingStepCount - 1))
  const onboardingCurrentStep = onboardingSteps[clampedOnboardingStep]
  const {
    title: onboardingTitle,
    body: onboardingBody,
    primaryLabel: onboardingPrimaryLabel,
    primaryDisabled: onboardingPrimaryDisabled,
    secondaryLabel: onboardingSecondaryLabel,
    visualTag: onboardingVisualTag,
    visualSurfaceStyle: onboardingVisualSurfaceStyle,
    visualOrbStyle: onboardingVisualOrbStyle,
    visualTagStyle: onboardingVisualTagStyle,
  } = onboardingCurrentStep
  const onboardingSafeStyle = useMemo(
    () => [styles.onboardingRoot, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }],
    [insets.bottom, insets.top],
  )

  if (!onboardingReady) {
    return (
      <SafeAreaView style={onboardingSafeStyle} edges={["left", "right"]}>
        <StatusBar style="light" />
      </SafeAreaView>
    )
  }

  if (!onboardingComplete) {
    return (
      <SafeAreaView style={onboardingSafeStyle} edges={["left", "right"]}>
        <StatusBar style="light" />

        <View style={styles.onboardingShell}>
          <View style={styles.onboardingTopRail}>
            <View style={styles.onboardingModelRow}>
              <Text style={styles.onboardingModelText}>{onboardingModelStatus}</Text>
              <View style={styles.onboardingModelTrack}>
                <View
                  style={[
                    styles.onboardingModelFill,
                    { width: `${Math.max(onboardingProgressPct, onboardingProgress > 0 ? 6 : 0)}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={styles.onboardingContent}>
            <View style={[styles.onboardingVisualSurface, onboardingVisualSurfaceStyle]}>
              <View style={[styles.onboardingVisualOrb, styles.onboardingVisualOrbOne, onboardingVisualOrbStyle]} />
              <View style={[styles.onboardingVisualOrb, styles.onboardingVisualOrbTwo, onboardingVisualOrbStyle]} />
              <View style={[styles.onboardingVisualTag, onboardingVisualTagStyle]}>
                <Text style={styles.onboardingVisualTagText}>{onboardingVisualTag}</Text>
              </View>
            </View>

            <View style={styles.onboardingCopyBlock}>
              <Text
                style={styles.onboardingEyebrow}
              >{`STEP ${clampedOnboardingStep + 1} OF ${onboardingStepCount}`}</Text>
              <Text style={styles.onboardingTitle}>{onboardingTitle}</Text>
              <Text style={styles.onboardingBody}>{onboardingBody}</Text>
            </View>
          </View>

          <View style={styles.onboardingFooter}>
            <Pressable
              onPress={() => {
                if (clampedOnboardingStep === 0) {
                  void (async () => {
                    await handleRequestMicrophonePermission()
                    setOnboardingStep(1)
                  })()
                  return
                }

                if (clampedOnboardingStep === 1) {
                  void (async () => {
                    await handleRequestNotificationPermission()
                    setOnboardingStep(2)
                  })()
                  return
                }

                if (clampedOnboardingStep === 2) {
                  void (async () => {
                    await handleRequestLocalNetworkPermission()
                    setOnboardingStep(3)
                  })()
                  return
                }

                completeOnboarding(true)
              }}
              style={({ pressed }) => [
                styles.onboardingPrimaryButton,
                onboardingPrimaryDisabled && styles.onboardingPrimaryButtonDisabled,
                pressed && styles.clearButtonPressed,
              ]}
              disabled={onboardingPrimaryDisabled}
            >
              <Text style={styles.onboardingPrimaryButtonText}>{onboardingPrimaryLabel}</Text>
              <SymbolView
                name={{ ios: "arrow.right", android: "arrow_forward", web: "arrow_forward" }}
                size={20}
                weight="semibold"
                tintColor="#FFFFFF"
              />
            </Pressable>

            <Pressable
              onPress={() => {
                if (clampedOnboardingStep < onboardingStepCount - 1) {
                  setOnboardingStep((step) => Math.min(step + 1, onboardingStepCount - 1))
                  return
                }

                completeOnboarding(false)
              }}
              style={({ pressed }) => [styles.onboardingSecondaryButton, pressed && styles.clearButtonPressed]}
            >
              <Text style={styles.onboardingSecondaryText}>{onboardingSecondaryLabel}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {isDropdownOpen ? <Pressable style={styles.dismissOverlay} onPress={closeDropdown} /> : null}

      {/* Workspace header */}
      <View style={styles.headerAnchor}>
        <Animated.View style={[styles.statusBar, animatedHeaderStyle, animatedHeaderShadowStyle]}>
          {activeServer ? (
            <View style={styles.headerSplitRow}>
              <Pressable
                onPress={toggleServerMenu}
                style={({ pressed }) => [styles.headerSplitLeft, pressed && styles.clearButtonPressed]}
              >
                <View style={styles.headerServerLabel}>
                  <View style={[styles.serverStatusDot, headerDotStyle]} />
                  <Text
                    style={[styles.workspaceHeaderText, styles.headerServerText]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {activeServer.name}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.headerSplitDivider} />

              <Pressable
                onPress={toggleSessionMenu}
                style={({ pressed }) => [styles.headerSplitRight, pressed && styles.clearButtonPressed]}
              >
                <Text
                  style={[styles.workspaceHeaderText, styles.headerSessionText]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {activeSession?.title ?? "Select session"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={toggleServerMenu}
              style={({ pressed }) => [styles.statusBarTapArea, pressed && styles.clearButtonPressed]}
            >
              <View style={styles.headerServerLabel}>
                <View style={[styles.serverStatusDot, headerDotStyle]} />
                <Text style={styles.workspaceHeaderText}>{headerTitle}</Text>
              </View>
            </Pressable>
          )}

          <Animated.View
            style={[styles.serverMenuInline, animatedServerMenuStyle]}
            pointerEvents={isDropdownOpen ? "auto" : "none"}
          >
            <ScrollView
              style={styles.dropdownListViewport}
              contentContainerStyle={styles.dropdownListContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {effectiveDropdownMode === "server" ? (
                servers.length === 0 ? (
                  <Text style={styles.serverEmptyText}>No servers yet</Text>
                ) : (
                  servers.map((server) => (
                    <Pressable
                      key={server.id}
                      onPress={() => handleSelectServer(server.id)}
                      style={({ pressed }) => [styles.serverRow, pressed && styles.serverRowPressed]}
                    >
                      <View
                        style={[
                          styles.serverStatusDot,
                          server.status === "online" ? styles.serverStatusActive : styles.serverStatusOffline,
                        ]}
                      />
                      <Text style={styles.serverNameText}>{server.name}</Text>
                      <Pressable onPress={() => handleDeleteServer(server.id)} hitSlop={8}>
                        <Text style={styles.serverDeleteIcon}>✕</Text>
                      </Pressable>
                    </Pressable>
                  ))
                )
              ) : activeServer ? (
                activeServer.sessions.length === 0 ? (
                  activeServer.sessionsLoading ? null : (
                    <Text style={styles.serverEmptyText}>No sessions available</Text>
                  )
                ) : (
                  activeServer.sessions.map((session, index) => (
                    <Pressable
                      key={session.id}
                      onPress={() => handleSelectSession(session.id)}
                      style={({ pressed }) => [
                        styles.serverRow,
                        index === activeServer.sessions.length - 1 && styles.serverRowLast,
                        pressed && styles.serverRowPressed,
                      ]}
                    >
                      <View style={[styles.serverStatusDot, styles.serverStatusActive]} />
                      <Text style={styles.serverNameText} numberOfLines={1}>
                        {session.title}
                      </Text>
                      <Text style={styles.sessionUpdatedText}>{formatSessionUpdated(session.updated)}</Text>
                    </Pressable>
                  ))
                )
              ) : (
                <Text style={styles.serverEmptyText}>Select a server first</Text>
              )}
            </ScrollView>

            {effectiveDropdownMode === "server" ? (
              <Pressable onPress={() => void handleStartScan()} style={styles.addServerButton}>
                <Text style={styles.addServerButtonText}>Add server by scanning QR code</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </Animated.View>
      </View>

      {/* Transcription area */}
      <View style={styles.transcriptionArea}>
        {shouldShowAgentStateCard ? (
          <View style={styles.splitCardStack}>
            <View style={[styles.splitCard, styles.replyCard]}>
              <View style={styles.agentStateHeaderRow}>
                <View style={styles.agentStateTitleWrap}>
                  <View style={styles.agentStateIconWrap}>
                    {agentStateIcon === "loading" ? (
                      <ActivityIndicator size="small" color="#91A0C0" />
                    ) : (
                      <SymbolView
                        name={{ ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" }}
                        size={16}
                        tintColor="#91C29D"
                      />
                    )}
                  </View>
                  <Text style={styles.replyCardLabel}>Agent</Text>
                </View>
                <Pressable onPress={handleHideAgentState} hitSlop={8}>
                  <Text style={styles.agentStateClose}>✕</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.replyScroll} contentContainerStyle={styles.replyContent}>
                <Text style={styles.replyText}>{agentStateText}</Text>
              </ScrollView>
            </View>

            <View style={styles.transcriptionPanel}>
              <View style={styles.transcriptionTopActions} pointerEvents="box-none">
                <Pressable
                  onPress={handleOpenWhisperSettings}
                  style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
                  hitSlop={8}
                >
                  <SymbolView
                    name={{ ios: "gearshape.fill", android: "settings", web: "settings" }}
                    size={18}
                    weight="semibold"
                    tintColor="#B8BDC9"
                  />
                </Pressable>
                <Pressable
                  onPress={handleClearTranscript}
                  style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
                  hitSlop={8}
                >
                  <Animated.Text style={[styles.clearIcon, animatedClearIconStyle]}>↻</Animated.Text>
                </Pressable>
              </View>

              {whisperError ? (
                <View style={styles.modelErrorBadge}>
                  <Text style={styles.modelErrorText}>{whisperError}</Text>
                </View>
              ) : null}

              <ScrollView
                ref={scrollViewRef}
                style={styles.transcriptionScroll}
                contentContainerStyle={styles.transcriptionContent}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              >
                <Animated.View style={animatedTranscriptSendStyle}>
                  {transcribedText ? (
                    <Text style={styles.transcriptionText}>{transcribedText}</Text>
                  ) : (
                    <Text style={styles.placeholderText}>Your transcription will appear here…</Text>
                  )}
                </Animated.View>
              </ScrollView>

              <Animated.View
                style={[styles.waveformBoxesRow, animatedWaveformRowStyle]}
                pointerEvents="none"
                onLayout={handleWaveformLayout}
              >
                {Array.from({ length: WAVEFORM_ROWS }).map((_, row) => (
                  <View key={`row-${row}`} style={styles.waveformGridRow}>
                    {waveformLevels.map((_, col) => (
                      <View key={`cell-${row}-${col}`} style={[styles.waveformBox, getWaveformCellStyle(row, col)]} />
                    ))}
                  </View>
                ))}
              </Animated.View>
            </View>
          </View>
        ) : (
          <View style={styles.transcriptionPanel}>
            <View style={styles.transcriptionTopActions} pointerEvents="box-none">
              <Pressable
                onPress={handleOpenWhisperSettings}
                style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
                hitSlop={8}
              >
                <SymbolView
                  name={{ ios: "gearshape.fill", android: "settings", web: "settings" }}
                  size={18}
                  weight="semibold"
                  tintColor="#B8BDC9"
                />
              </Pressable>
              <Pressable
                onPress={handleClearTranscript}
                style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
                hitSlop={8}
              >
                <Animated.Text style={[styles.clearIcon, animatedClearIconStyle]}>↻</Animated.Text>
              </Pressable>
            </View>

            {whisperError ? (
              <View style={styles.modelErrorBadge}>
                <Text style={styles.modelErrorText}>{whisperError}</Text>
              </View>
            ) : null}

            <ScrollView
              ref={scrollViewRef}
              style={styles.transcriptionScroll}
              contentContainerStyle={styles.transcriptionContent}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              <Animated.View style={animatedTranscriptSendStyle}>
                {transcribedText ? (
                  <Text style={styles.transcriptionText}>{transcribedText}</Text>
                ) : (
                  <Text style={styles.placeholderText}>Your transcription will appear here…</Text>
                )}
              </Animated.View>
            </ScrollView>

            <Animated.View
              style={[styles.waveformBoxesRow, animatedWaveformRowStyle]}
              pointerEvents="none"
              onLayout={handleWaveformLayout}
            >
              {Array.from({ length: WAVEFORM_ROWS }).map((_, row) => (
                <View key={`row-${row}`} style={styles.waveformGridRow}>
                  {waveformLevels.map((_, col) => (
                    <View key={`cell-${row}-${col}`} style={[styles.waveformBox, getWaveformCellStyle(row, col)]} />
                  ))}
                </View>
              ))}
            </Animated.View>
          </View>
        )}
      </View>

      {/* Record button */}
      <View style={styles.controlsRow} onLayout={handleControlsLayout}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!permissionGranted || modelLoading}
          style={[styles.recordPressable, !permissionGranted && styles.recordButtonDisabled]}
        >
          <View style={styles.recordButton}>
            {isTranscribingBulk ? (
              <View style={styles.recordBusyCenter}>
                <ActivityIndicator color="#FF2E3F" size="small" />
              </View>
            ) : modelLoadingState !== "ready" ? (
              <>
                <View
                  style={[
                    styles.loadFill,
                    modelLoadingState === "loading" && styles.loadFillPending,
                    { width: modelLoadingState === "downloading" ? `${Math.max(pct, 3)}%` : "100%" },
                  ]}
                />
                <View style={styles.loadOverlay} pointerEvents="none">
                  <Text style={styles.loadText}>
                    {modelLoadingState === "downloading"
                      ? `Downloading ${loadingModelLabel} ${pct}%`
                      : `Loading ${loadingModelLabel}`}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Animated.View style={[styles.recordBorder, animatedBorderStyle]} pointerEvents="none" />
                <Animated.View style={[styles.recordDot, animatedDotStyle]} />
              </>
            )}
          </View>
        </Pressable>

        <Animated.View style={[styles.sendSlot, animatedSendStyle]} pointerEvents={shouldShowSend ? "auto" : "none"}>
          <Pressable
            onPress={handleSendTranscript}
            style={({ pressed }) => [
              styles.sendButton,
              (isSending || !hasTranscript || !canSendToSession) && styles.sendButtonDisabled,
              pressed && styles.clearButtonPressed,
            ]}
            disabled={isSending || !hasTranscript || !canSendToSession}
            hitSlop={8}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </Pressable>
        </Animated.View>
      </View>

      <Modal
        visible={whisperSettingsOpen}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setWhisperSettingsOpen(false)}
      >
        <SafeAreaView style={styles.settingsRoot}>
          <View style={styles.settingsTop}>
            <View style={styles.settingsTitleBlock}>
              <Text style={styles.settingsTitle}>Settings</Text>
              <Text style={styles.settingsSubtitle}>Default: {WHISPER_MODEL_LABELS[defaultWhisperModel]}</Text>
            </View>
            <Pressable onPress={() => setWhisperSettingsOpen(false)}>
              <Text style={styles.settingsClose}>Done</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.settingsContent}>
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionLabel}>DEVELOPMENT:</Text>
              {__DEV__ ? (
                <Pressable
                  onPress={handleReplayOnboarding}
                  style={({ pressed }) => [styles.settingsTextRow, pressed && styles.clearButtonPressed]}
                >
                  <Text style={styles.settingsTextRowTitle}>Replay onboarding</Text>
                  <Text style={styles.settingsTextRowAction}>Run</Text>
                </Pressable>
              ) : (
                <View style={styles.settingsTextRow}>
                  <Text style={styles.settingsMutedText}>Available in development builds.</Text>
                </View>
              )}
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionLabel}>GENERAL:</Text>
              <View style={styles.settingsTextRow}>
                <Text style={styles.settingsTextRowTitle}>Default model</Text>
                <Text style={styles.settingsTextRowValue}>{WHISPER_MODEL_LABELS[defaultWhisperModel]}</Text>
              </View>

              <Pressable
                onPress={() => setTranscriptionMode("bulk")}
                disabled={isRecording || isTranscribingBulk}
                style={({ pressed }) => [
                  styles.settingsTextRow,
                  (isRecording || isTranscribingBulk) && styles.settingsInlinePressableDisabled,
                  pressed && styles.clearButtonPressed,
                ]}
              >
                <View style={styles.settingsOptionCopy}>
                  <Text style={styles.settingsTextRowTitle}>On Release</Text>
                  <Text style={styles.settingsTextRowMeta}>Transcribe after release</Text>
                </View>
                <Text
                  style={[
                    styles.settingsTextRowAction,
                    transcriptionMode === "bulk" && styles.settingsTextRowActionActive,
                  ]}
                >
                  {transcriptionMode === "bulk" ? "Selected" : "Use"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setTranscriptionMode("realtime")}
                disabled={isRecording || isTranscribingBulk}
                style={({ pressed }) => [
                  styles.settingsTextRow,
                  (isRecording || isTranscribingBulk) && styles.settingsInlinePressableDisabled,
                  pressed && styles.clearButtonPressed,
                ]}
              >
                <View style={styles.settingsOptionCopy}>
                  <Text style={styles.settingsTextRowTitle}>Realtime</Text>
                  <Text style={styles.settingsTextRowMeta}>Transcribe while you speak</Text>
                </View>
                <Text
                  style={[
                    styles.settingsTextRowAction,
                    transcriptionMode === "realtime" && styles.settingsTextRowActionActive,
                  ]}
                >
                  {transcriptionMode === "realtime" ? "Selected" : "Use"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionLabel}>MODELS:</Text>
              {WHISPER_MODELS.map((modelID) => {
                const installed = installedWhisperModels.includes(modelID)
                const isDefault = defaultWhisperModel === modelID
                const isDownloading = downloadingModelID === modelID
                const actionDisabled = (downloadingModelID !== null && !isDownloading) || isTranscribingBulk
                const downloadPct = Math.round(Math.max(0, Math.min(1, downloadProgress)) * 100)
                const actionLabel = isDownloading
                  ? `${downloadPct}%`
                  : installed
                    ? isDefault
                      ? "Selected"
                      : "Select"
                    : "Download"
                const sizeLabel = formatWhisperModelSize(WHISPER_MODEL_SIZES[modelID])
                const rowMeta = [sizeLabel, installed ? "installed" : null, isDefault ? "default" : null]
                  .filter(Boolean)
                  .join(" · ")

                return (
                  <View key={modelID} style={styles.settingsInlineRow}>
                    <Pressable
                      onPress={() => {
                        if (installed) {
                          void handleSelectWhisperModel(modelID)
                        }
                      }}
                      onLongPress={() => {
                        if (!installed || isDownloading) return
                        Alert.alert("Delete model?", `Remove ${modelID} from this device?`, [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => {
                              void handleDeleteWhisperModel(modelID)
                            },
                          },
                        ])
                      }}
                      delayLongPress={350}
                      disabled={!installed || actionDisabled || isPreparingWhisperModel}
                      style={({ pressed }) => [
                        styles.settingsInlineLabelPressable,
                        (!installed || actionDisabled || isPreparingWhisperModel) &&
                          styles.settingsInlinePressableDisabled,
                        pressed && styles.clearButtonPressed,
                      ]}
                    >
                      <Text style={styles.settingsInlineName}>{modelID}</Text>
                      <Text style={styles.settingsInlineMeta}>{rowMeta}</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (isDownloading) return
                        if (installed) {
                          void handleSelectWhisperModel(modelID)
                          return
                        }
                        void handleDownloadWhisperModel(modelID)
                      }}
                      disabled={actionDisabled || (installed && isPreparingWhisperModel)}
                      accessibilityLabel={actionLabel}
                      style={({ pressed }) => [
                        styles.settingsInlineTextActionPressable,
                        (actionDisabled || (installed && isPreparingWhisperModel)) &&
                          styles.settingsInlinePressableDisabled,
                        pressed && styles.clearButtonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.settingsInlineTextAction,
                          installed && styles.settingsInlineTextActionInstalled,
                          isDownloading && styles.settingsInlineTextActionDownloading,
                        ]}
                      >
                        {actionLabel}
                      </Text>
                    </Pressable>
                  </View>
                )
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={scanOpen}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setScanOpen(false)}
      >
        <SafeAreaView style={styles.scanRoot}>
          <View style={styles.scanTop}>
            <Text style={styles.scanTitle}>Scan server QR</Text>
            <Pressable onPress={() => setScanOpen(false)}>
              <Text style={styles.scanClose}>Close</Text>
            </Pressable>
          </View>
          {camGranted && camera ? (
            <camera.CameraView
              style={styles.scanCam}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={handleScan}
            />
          ) : (
            <View style={styles.scanEmpty}>
              <Text style={styles.scanHint}>Camera permission is required to scan setup QR codes.</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    position: "relative",
  },
  onboardingRoot: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 16,
  },
  onboardingShell: {
    flex: 1,
  },
  onboardingTopRail: {
    gap: 8,
    marginBottom: 10,
  },
  onboardingContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    gap: 22,
    paddingHorizontal: 2,
  },
  onboardingModelRow: {
    gap: 6,
  },
  onboardingModelText: {
    color: "#A9A9A9",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  onboardingModelTrack: {
    height: 4,
    width: "100%",
    borderRadius: 999,
    backgroundColor: "#2C2C2C",
    overflow: "hidden",
  },
  onboardingModelFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#FF5B47",
  },
  onboardingVisualSurface: {
    width: "100%",
    minHeight: 176,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#171717",
    borderColor: "#2B2B2B",
  },
  onboardingVisualSurfaceMic: {
    backgroundColor: "#1A2118",
    borderColor: "#2F3D2D",
  },
  onboardingVisualSurfaceNotifications: {
    backgroundColor: "#1A1D2A",
    borderColor: "#303A5A",
  },
  onboardingVisualSurfaceNetwork: {
    backgroundColor: "#1A2218",
    borderColor: "#344930",
  },
  onboardingVisualSurfacePair: {
    backgroundColor: "#1F1A27",
    borderColor: "#413157",
  },
  onboardingVisualOrb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.22,
  },
  onboardingVisualOrbOne: {
    width: 130,
    height: 130,
    top: -28,
    left: -22,
  },
  onboardingVisualOrbTwo: {
    width: 160,
    height: 160,
    bottom: -52,
    right: -44,
  },
  onboardingVisualOrbMic: {
    backgroundColor: "#61C372",
  },
  onboardingVisualOrbNotifications: {
    backgroundColor: "#4A6EE0",
  },
  onboardingVisualOrbNetwork: {
    backgroundColor: "#78B862",
  },
  onboardingVisualOrbPair: {
    backgroundColor: "#9B6CDC",
  },
  onboardingVisualTag: {
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  onboardingVisualTagMic: {
    backgroundColor: "#253A25",
    borderColor: "#3A5C3A",
  },
  onboardingVisualTagNotifications: {
    backgroundColor: "#223561",
    borderColor: "#38518C",
  },
  onboardingVisualTagNetwork: {
    backgroundColor: "#284122",
    borderColor: "#3D6835",
  },
  onboardingVisualTagPair: {
    backgroundColor: "#3B2859",
    borderColor: "#5A3D86",
  },
  onboardingVisualTagText: {
    color: "#F6F7F8",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  onboardingCopyBlock: {
    alignItems: "flex-start",
    gap: 10,
    width: "100%",
  },
  onboardingEyebrow: {
    color: "#7F7F7F",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  onboardingTitle: {
    color: "#F1F1F1",
    fontSize: 34,
    fontWeight: "800",
    textAlign: "left",
    letterSpacing: -1,
    lineHeight: 38,
  },
  onboardingBody: {
    color: "#B4B4B4",
    fontSize: 18,
    lineHeight: 25,
    textAlign: "left",
    paddingHorizontal: 0,
  },
  onboardingFooter: {
    gap: 10,
    paddingTop: 6,
  },
  onboardingPrimaryButton: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1D6FF4",
    borderWidth: 2,
    borderColor: "#1557C3",
    flexDirection: "row",
    gap: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 4,
  },
  onboardingPrimaryButtonDisabled: {
    opacity: 0.6,
  },
  onboardingPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  onboardingSecondaryButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  onboardingSecondaryText: {
    color: "#959CAA",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "left",
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
  },
  headerAnchor: {
    marginHorizontal: 6,
    marginTop: 5,
    height: 51,
    zIndex: 30,
  },
  statusBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#151515",
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#282828",
    paddingHorizontal: 14,
    paddingTop: 0,
    overflow: "hidden",
    shadowColor: "#000000",
  },
  statusBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 30,
  },
  statusBarTapArea: {
    height: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  headerServerLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  headerSplitRow: {
    height: 45,
    flexDirection: "row",
    alignItems: "center",
  },
  headerSplitLeft: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingRight: 8,
  },
  headerSplitDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3F4556",
    marginHorizontal: 6,
  },
  headerSplitRight: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 8,
  },
  workspaceHeaderText: {
    color: "#8F8F8F",
    fontSize: 14,
    fontWeight: "600",
  },
  headerServerText: {
    flex: 1,
    minWidth: 0,
    width: "100%",
  },
  headerSessionText: {
    flexShrink: 1,
    minWidth: 0,
    width: "100%",
    textAlign: "left",
  },
  serverMenuInline: {
    marginTop: 8,
    paddingBottom: 8,
    gap: 4,
  },
  dropdownListViewport: {
    maxHeight: DROPDOWN_VISIBLE_ROWS * 42,
  },
  dropdownListContent: {
    paddingBottom: 2,
  },
  serverEmptyText: {
    color: "#6F7686",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 10,
  },
  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#222733",
  },
  serverRowLast: {
    borderBottomWidth: 0,
  },
  serverRowPressed: {
    opacity: 0.85,
  },
  serverStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  serverStatusActive: {
    backgroundColor: "#4CC26A",
  },
  serverStatusChecking: {
    backgroundColor: "#D2A542",
  },
  serverStatusOffline: {
    backgroundColor: "#D14C55",
  },
  serverNameText: {
    flex: 1,
    color: "#D6DAE4",
    fontSize: 14,
    fontWeight: "500",
  },
  sessionUpdatedText: {
    color: "#8E96A8",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 8,
  },
  serverDeleteIcon: {
    color: "#8C93A3",
    fontSize: 15,
    fontWeight: "700",
  },
  addServerButton: {
    marginTop: 10,
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  addServerButtonText: {
    color: "#B8BDC9",
    fontSize: 16,
    fontWeight: "600",
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  readyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF2E3F",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  statusActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  clearButtonPressed: {
    opacity: 0.75,
  },
  clearIcon: {
    color: "#A0A0A0",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    transform: [{ translateY: -0.5 }],
  },
  transcriptionArea: {
    flex: 1,
    marginHorizontal: 6,
    marginTop: 6,
  },
  splitCardStack: {
    flex: 1,
    gap: 8,
  },
  splitCard: {
    flex: 1,
    backgroundColor: "#151515",
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#282828",
    overflow: "hidden",
    position: "relative",
  },
  replyCard: {
    paddingTop: 16,
  },
  transcriptionPanel: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  replyCardLabel: {
    color: "#AAB5CC",
    fontSize: 15,
    fontWeight: "600",
  },
  agentStateHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginBottom: 8,
  },
  agentStateTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  agentStateIconWrap: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  agentStateClose: {
    color: "#8D97AB",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 18,
  },
  replyScroll: {
    flex: 1,
  },
  replyContent: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexGrow: 1,
  },
  replyText: {
    fontSize: 22,
    fontWeight: "500",
    lineHeight: 32,
    color: "#F4F7FF",
  },
  transcriptionScroll: {
    flex: 1,
  },
  transcriptionContent: {
    padding: 20,
    paddingTop: 54,
    paddingBottom: 54,
    flexGrow: 1,
  },
  transcriptionTopActions: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    zIndex: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modelErrorBadge: {
    alignSelf: "flex-start",
    marginLeft: 14,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#3A1A1D",
    borderWidth: 1,
    borderColor: "#5D292F",
  },
  modelErrorText: {
    color: "#FFB9BF",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  transcriptionText: {
    fontSize: 28,
    fontWeight: "500",
    lineHeight: 38,
    color: "#FFFFFF",
  },
  placeholderText: {
    fontSize: 28,
    fontWeight: "500",
    color: "#333",
  },
  waveformBoxesRow: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 14,
    height: WAVEFORM_ROWS * WAVEFORM_CELL_SIZE + (WAVEFORM_ROWS - 1) * WAVEFORM_CELL_GAP,
    pointerEvents: "none",
  },
  waveformGridRow: {
    flexDirection: "row",
    gap: WAVEFORM_CELL_GAP,
    marginBottom: WAVEFORM_CELL_GAP,
  },
  waveformBox: {
    width: WAVEFORM_CELL_SIZE,
    height: WAVEFORM_CELL_SIZE,
    borderRadius: 1,
    backgroundColor: "#78839A",
    borderWidth: 1,
    borderColor: "#818DA6",
  },
  controlsRow: {
    paddingHorizontal: 6,
    paddingBottom: 6,
    paddingTop: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  recordPressable: {
    flex: 1,
  },
  recordButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#421B17",
    height: CONTROL_HEIGHT,
    borderRadius: 20,
    width: "100%",
    overflow: "hidden",
  },
  recordBusyCenter: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  loadFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#FF5B47",
  },
  loadFillPending: {
    backgroundColor: "#66423C",
  },
  loadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  loadText: {
    color: "#FFF6F4",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  settingsRoot: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  settingsTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  settingsTitleBlock: {
    flex: 1,
    gap: 4,
  },
  settingsTitle: {
    color: "#F1F1F1",
    fontSize: 20,
    fontWeight: "700",
  },
  settingsSubtitle: {
    color: "#999999",
    fontSize: 13,
    fontWeight: "500",
  },
  settingsClose: {
    color: "#C5C5C5",
    fontSize: 15,
    fontWeight: "700",
  },
  settingsScroll: {
    flex: 1,
  },
  settingsContent: {
    gap: 24,
    paddingBottom: 24,
  },
  settingsSection: {
    gap: 0,
  },
  settingsSectionLabel: {
    color: "#7D7D7D",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.05,
    marginBottom: 6,
  },
  settingsTextRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#242424",
    paddingVertical: 10,
  },
  settingsMutedText: {
    color: "#868686",
    fontSize: 12,
    fontWeight: "500",
  },
  settingsOptionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  settingsTextRowTitle: {
    color: "#ECECEC",
    fontSize: 14,
    fontWeight: "600",
  },
  settingsTextRowMeta: {
    color: "#8D8D8D",
    fontSize: 12,
    fontWeight: "500",
  },
  settingsTextRowValue: {
    color: "#BDBDBD",
    fontSize: 13,
    fontWeight: "600",
    maxWidth: "55%",
    textAlign: "right",
  },
  settingsTextRowAction: {
    color: "#B8B8B8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  settingsTextRowActionActive: {
    color: "#FFD8D2",
  },
  settingsInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#242424",
  },
  settingsInlineLabelPressable: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingRight: 12,
    gap: 2,
  },
  settingsInlinePressableDisabled: {
    opacity: 0.55,
  },
  settingsInlineName: {
    color: "#E7E7E7",
    fontSize: 14,
    fontWeight: "600",
  },
  settingsInlineMeta: {
    color: "#8F8F8F",
    fontSize: 12,
    fontWeight: "500",
  },
  settingsInlineTextActionPressable: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  settingsInlineTextAction: {
    color: "#D0D0D0",
    fontSize: 12,
    fontWeight: "700",
    minWidth: 72,
    textAlign: "right",
  },
  settingsInlineTextActionInstalled: {
    color: "#E2B1A8",
  },
  settingsInlineTextActionDownloading: {
    color: "#FFD7CE",
  },
  scanRoot: {
    flex: 1,
    backgroundColor: "#101014",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  scanTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scanTitle: {
    color: "#E8EAF0",
    fontSize: 18,
    fontWeight: "700",
  },
  scanClose: {
    color: "#8FA4CC",
    fontSize: 15,
    fontWeight: "600",
  },
  scanCam: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  scanEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scanHint: {
    color: "#A6ABBA",
    fontSize: 14,
    textAlign: "center",
  },
  sendSlot: {
    height: CONTROL_HEIGHT,
    overflow: "hidden",
  },
  sendButton: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1D6FF4",
    borderWidth: 2,
    borderColor: "#1557C3",
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendIcon: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 36,
    transform: [{ translateY: -1 }],
  },
  recordBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  recordButtonDisabled: {
    opacity: 0.4,
  },
  recordDot: {
    width: 38,
    height: 38,
    backgroundColor: "#FF2E3F",
  },
})
