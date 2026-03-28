import React, { useEffect, useState, useRef, useCallback, useMemo } from "react"
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  TextInput,
  LayoutChangeEvent,
  AppState,
  AppStateStatus,
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
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import * as Haptics from "expo-haptics"
import { useAudioPlayer } from "expo-audio"
import { useSpeechToText, WHISPER_BASE_EN } from "react-native-executorch"
import { AudioManager, AudioRecorder } from "react-native-audio-api"
import * as Notifications from "expo-notifications"
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

const SAMPLE_RATE = 16000
const AUDIO_BUFFER_SECONDS = 0.02
const CONTROL_HEIGHT = 86
const SEND_SETTLE_MS = 240
const WAVEFORM_ROWS = 5
const WAVEFORM_CELL_SIZE = 8
const WAVEFORM_CELL_GAP = 2
const DROPDOWN_VISIBLE_ROWS = 6
// If the press duration is shorter than this, treat it as a tap (toggle)
const TAP_THRESHOLD_MS = 300
const DEFAULT_RELAY_URL = "https://relay.opencode.ai"

type ServerItem = {
  id: string
  name: string
  url: string
  relayURL: string
  relaySecret: string
  status: "checking" | "online" | "offline"
  sessions: SessionItem[]
  sessionsLoading: boolean
}

type SessionItem = {
  id: string
  title: string
  updated: number
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

export default function DictationScreen() {
  const model = useSpeechToText({
    model: WHISPER_BASE_EN,
  })

  const [transcribedText, setTranscribedText] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [controlsWidth, setControlsWidth] = useState(0)
  const [hasCompletedSession, setHasCompletedSession] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [monitorJob, setMonitorJob] = useState<MonitorJob | null>(null)
  const [monitorStatus, setMonitorStatus] = useState<string>("")
  const [devicePushToken, setDevicePushToken] = useState<string | null>(null)
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState)
  const [dropdownMode, setDropdownMode] = useState<DropdownMode>("none")
  const [dropdownRenderMode, setDropdownRenderMode] = useState<Exclude<DropdownMode, "none">>("server")
  const [isAddingServer, setIsAddingServer] = useState(false)
  const [serverDraftURL, setServerDraftURL] = useState("http://127.0.0.1:4096")
  const [serverDraftRelayURL, setServerDraftRelayURL] = useState(DEFAULT_RELAY_URL)
  const [serverDraftRelaySecret, setServerDraftRelaySecret] = useState("")
  const [servers, setServers] = useState<ServerItem[]>([
    {
      id: "srv-1",
      name: "Local OpenCode",
      url: "http://127.0.0.1:4096",
      relayURL: DEFAULT_RELAY_URL,
      relaySecret: "",
      status: "checking",
      sessions: [],
      sessionsLoading: false,
    },
    {
      id: "srv-2",
      name: "Staging OpenCode",
      url: "http://127.0.0.1:4097",
      relayURL: "http://127.0.0.1:8788",
      relaySecret: "",
      status: "offline",
      sessions: [],
      sessionsLoading: false,
    },
  ])
  const [activeServerId, setActiveServerId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [waveformLevels, setWaveformLevels] = useState<number[]>(Array.from({ length: 24 }, () => 0))
  const [waveformTick, setWaveformTick] = useState(0)
  const waveformLevelsRef = useRef<number[]>(Array.from({ length: 24 }, () => 0))
  const serversRef = useRef<ServerItem[]>([])
  const lastWaveformCommitRef = useRef(0)
  const sendPlayer = useAudioPlayer(require("../../assets/sounds/send-whoosh.mp3"))

  const isRecordingRef = useRef(false)
  const isStartingRef = useRef(false)
  const activeSessionRef = useRef(0)
  const scrollViewRef = useRef<ScrollView>(null)
  const isHoldingRef = useRef(false)
  const pressInTimeRef = useRef(0)
  const accumulatedRef = useRef("")
  const baseTextRef = useRef("")
  // Keep a ref to model so audio callbacks always use the latest hook closure
  const modelRef = useRef(model)
  modelRef.current = model
  const prewarmPromiseRef = useRef<Promise<void> | null>(null)
  const hasPrewarmedRef = useRef(false)
  const sendSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const foregroundMonitorAbortRef = useRef<AbortController | null>(null)
  const monitorJobRef = useRef<MonitorJob | null>(null)
  const previousPushTokenRef = useRef<string | null>(null)

  const [recorder] = useState(() => new AudioRecorder())

  useEffect(() => {
    serversRef.current = servers
  }, [servers])

  useEffect(() => {
    monitorJobRef.current = monitorJob
  }, [monitorJob])

  const ensureAudioRoute = useCallback(async () => {
    await AudioManager.setAudioSessionActivity(true)
    const devices = await AudioManager.getDevicesInfo()
    if (devices.currentInputs.length === 0 && devices.availableInputs.length > 0) {
      await AudioManager.setInputDevice(devices.availableInputs[0].id)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (sendSettleTimeoutRef.current) {
        clearTimeout(sendSettleTimeoutRef.current)
      }
    }
  }, [])

  // Warm up the model once after load to reduce first-utterance latency.
  useEffect(() => {
    if (!model.isReady || hasPrewarmedRef.current) return
    hasPrewarmedRef.current = true
    prewarmPromiseRef.current = (async () => {
      try {
        await modelRef.current.transcribe(new Float32Array(SAMPLE_RATE / 2), {
          verbose: false,
        })
      } catch {
        // Prewarm best-effort only.
      }
    })()
  }, [model.isReady])

  // Set up audio session and request permissions on mount
  useEffect(() => {
    ;(async () => {
      try {
        AudioManager.setAudioSessionOptions({
          iosCategory: "playAndRecord",
          iosMode: "spokenAudio",
          iosOptions: ["allowBluetoothHFP", "defaultToSpeaker"],
        })

        // Ensure iOS session is active before starting recorder callbacks
        await AudioManager.setAudioSessionActivity(true)

        const permission = await AudioManager.requestRecordingPermissions()
        const granted = permission === "Granted"
        setPermissionGranted(granted)
        console.log("[Dictation] Mic permission:", permission)

        if (!granted) {
          return
        }

        // On some devices/simulators no current input is selected by default
        const devices = await AudioManager.getDevicesInfo()
        console.log(
          "[Dictation] Audio inputs:",
          devices.availableInputs.length,
          "current:",
          devices.currentInputs.length,
        )

        if (devices.currentInputs.length === 0 && devices.availableInputs.length > 0) {
          const pick = devices.availableInputs[0]
          const selected = await AudioManager.setInputDevice(pick.id)
          console.log("[Dictation] Selected input device:", pick.name, selected)
        }
      } catch (e) {
        console.error("Failed to set up audio permissions:", e)
      }
    })()
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState)
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        if (Platform.OS !== "ios") return
        const granted = await ensureNotificationPermissions()
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
      const data = (notification as { request?: { content?: { data?: unknown } } }).request?.content?.data as Record<
        string,
        unknown
      >
      const eventType = data.eventType
      if (eventType === "complete" || eventType === "permission" || eventType === "error") {
        setMonitorStatus(formatMonitorEventLabel(eventType))
      }
      if (eventType === "complete" || eventType === "error") {
        setMonitorJob(null)
      }
    })
    return () => notificationSub.remove()
  }, [])

  const startRecording = useCallback(async () => {
    const m = modelRef.current
    if (!m.isReady || isRecordingRef.current || isStartingRef.current) return

    isStartingRef.current = true

    // If prewarm is still running, wait once here to avoid ModelGenerating race.
    if (prewarmPromiseRef.current) {
      await prewarmPromiseRef.current
      prewarmPromiseRef.current = null
    }

    try {
      await ensureAudioRoute()
    } catch (e) {
      console.warn("[Dictation] Failed to ensure audio route:", e)
    }

    isRecordingRef.current = true
    setIsRecording(true)
    const sessionId = Date.now()
    activeSessionRef.current = sessionId
    accumulatedRef.current = ""
    baseTextRef.current = transcribedText

    recorder.onError((err) => {
      console.error("[Dictation] Recorder error:", err.message)
      if (activeSessionRef.current !== sessionId) return
      isRecordingRef.current = false
      setIsRecording(false)
      recorder.clearOnAudioReady()
      recorder.clearOnError()
      modelRef.current.streamStop()
    })

    const readyResult = recorder.onAudioReady(
      {
        sampleRate: SAMPLE_RATE,
        bufferLength: AUDIO_BUFFER_SECONDS * SAMPLE_RATE,
        channelCount: 1,
      },
      (chunk) => {
        if (activeSessionRef.current !== sessionId) return
        const samples = chunk.buffer.getChannelData(0)
        if (!samples || samples.length === 0) return

        // Defensive guard against invalid chunk data coming from unstable audio routes.
        let valid = true
        for (let i = 0; i < samples.length; i += 32) {
          if (!Number.isFinite(samples[i])) {
            valid = false
            break
          }
        }
        if (!valid) return

        const columns = waveformLevelsRef.current.length
        const segmentLength = Math.max(1, Math.floor(samples.length / Math.max(columns, 1)))
        const next = new Array(columns).fill(0)

        for (let b = 0; b < columns; b++) {
          const start = b * segmentLength
          const end = Math.min(samples.length, start + segmentLength)

          let sum = 0
          for (let i = start; i < end; i++) {
            const s = samples[i]
            sum += s * s
          }

          const rms = Math.sqrt(sum / Math.max(end - start, 1))
          const base = Math.min(1, rms * 10)
          const previous = waveformLevelsRef.current[b] ?? 0
          // Fast rise, slower decay for more natural meter behavior
          next[b] = base > previous ? base : previous * 0.82
        }

        waveformLevelsRef.current = next
        const now = Date.now()
        if (now - lastWaveformCommitRef.current > 45) {
          setWaveformLevels(next)
          setWaveformTick(now)
          lastWaveformCommitRef.current = now
        }

        // Always use the latest model ref to avoid stale closure
        modelRef.current.streamInsert(samples)
      },
    )

    if (readyResult.status === "error") {
      console.error("[Dictation] onAudioReady failed:", readyResult.message)
      isRecordingRef.current = false
      setIsRecording(false)
      isStartingRef.current = false
      return
    }

    // Start stream first, then begin feeding chunks from recorder.
    const streamIter = modelRef.current.stream({ verbose: false })
    let sawTextInSession = false
    const streamTask = (async () => {
      for await (const { committed, nonCommitted } of streamIter) {
        if (!isRecordingRef.current) break

        if (committed.text) {
          accumulatedRef.current += committed.text
        }

        if (committed.text || nonCommitted.text) {
          sawTextInSession = true
        }

        const base = baseTextRef.current
        const separator = base.length > 0 ? "\n\n" : ""
        // Whisper can emit a leading-space token at the start of each session.
        const sessionText = (accumulatedRef.current + nonCommitted.text).replace(/^\s+/, "")
        setTranscribedText(base + separator + sessionText)
      }
    })()

    const startResult = recorder.start()
    if (startResult.status === "error") {
      console.error("[Dictation] Recorder start failed:", startResult.message)
      modelRef.current.streamStop()
      isRecordingRef.current = false
      setIsRecording(false)
      isStartingRef.current = false
      return
    }

    try {
      await streamTask
      if (sawTextInSession) {
        setHasCompletedSession(true)
      }
    } catch (error) {
      console.error("[Dictation] Streaming error:", error)
    } finally {
      isStartingRef.current = false
    }
  }, [ensureAudioRoute, recorder, transcribedText])

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return

    isRecordingRef.current = false
    activeSessionRef.current = 0
    isStartingRef.current = false
    setIsRecording(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    recorder.stop()
    recorder.clearOnAudioReady()
    recorder.clearOnError()
    modelRef.current.streamStop()
    const cleared = new Array(waveformLevelsRef.current.length).fill(0)
    waveformLevelsRef.current = cleared
    setWaveformLevels(cleared)
    setWaveformTick(Date.now())
  }, [recorder])

  const clearIconRotation = useSharedValue(0)
  const sendOutProgress = useSharedValue(0)

  const handleClearTranscript = useCallback(() => {
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
    const cleared = new Array(waveformLevelsRef.current.length).fill(0)
    waveformLevelsRef.current = cleared
    setWaveformLevels(cleared)
    setWaveformTick(Date.now())
    sendOutProgress.value = 0
    setIsSending(false)
  }, [clearIconRotation, sendOutProgress, stopRecording])

  const resetTranscriptState = useCallback(() => {
    if (isRecordingRef.current) {
      stopRecording()
    }
    accumulatedRef.current = ""
    baseTextRef.current = ""
    setTranscribedText("")
    setHasCompletedSession(false)
    const cleared = new Array(waveformLevelsRef.current.length).fill(0)
    waveformLevelsRef.current = cleared
    setWaveformLevels(cleared)
    setWaveformTick(Date.now())
  }, [stopRecording])

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

  const handleMonitorEvent = useCallback(
    (eventType: MonitorEventType) => {
      setMonitorStatus(formatMonitorEventLabel(eventType))

      if (eventType === "permission") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
        return
      }

      if (eventType === "complete") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
        stopForegroundMonitor()
        setMonitorJob(null)
        return
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      stopForegroundMonitor()
      setMonitorJob(null)
    },
    [stopForegroundMonitor],
  )

  const startForegroundMonitor = useCallback(
    (job: MonitorJob) => {
      stopForegroundMonitor()

      const abortController = new AbortController()
      foregroundMonitorAbortRef.current = abortController

      const base = job.opencodeBaseURL.replace(/\/+$/, "")

      ;(async () => {
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
            handleMonitorEvent(eventType)
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

      sendPlayer.seekTo(0)
      sendPlayer.play()

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    isHoldingRef.current = true
    startRecording()
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

  const modelLoading = !model.isReady
  const hasTranscript = transcribedText.trim().length > 0
  const shouldShowSend = hasCompletedSession && hasTranscript
  const activeServer = servers.find((s) => s.id === activeServerId) ?? null
  const activeSession = activeServer?.sessions.find((s) => s.id === activeSessionId) ?? null
  const canSendToSession = !!activeServer && activeServer.status === "online" && !!activeSession
  const isDropdownOpen = dropdownMode !== "none"
  const effectiveDropdownMode = isDropdownOpen ? dropdownMode : dropdownRenderMode
  const headerTitle = activeServer?.name ?? "No server configured"
  const headerDotStyle =
    activeServer == null
      ? styles.serverStatusOffline
      : activeServer.status === "online"
        ? styles.serverStatusActive
        : activeServer.status === "checking"
          ? styles.serverStatusChecking
          : styles.serverStatusOffline

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
    const isGenerating = isRecording || model.isGenerating
    waveformVisibility.value = withTiming(isGenerating ? 1 : 0, {
      duration: isGenerating ? 180 : 240,
      easing: Easing.inOut(Easing.quad),
    })
  }, [isRecording, model.isGenerating, waveformVisibility])

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
          duration: 220,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
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
  const addServerExtraHeight = effectiveDropdownMode === "server" ? (isAddingServer ? 142 : 38) : 8
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

      const alpha =
        intensity > 0 ? (0.4 + intensity * 0.6) * (0.85 + pulse * 0.15) : isRecording ? 0.1 + pulse * 0.07 : 0.08

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

    const base = server.url.replace(/\/+$/, "")

    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverID) return s
        if (s.status === "checking" && s.sessionsLoading === includeSessions) return s
        return { ...s, status: "checking", sessionsLoading: includeSessions ? true : s.sessionsLoading }
      }),
    )

    try {
      const healthRes = await fetch(`${base}/health`)
      const online = healthRes.ok

      if (!online) {
        setServers((prev) =>
          prev.map((s) => (s.id === serverID ? { ...s, status: "offline", sessionsLoading: false, sessions: [] } : s)),
        )
        return
      }

      if (!includeSessions) {
        setServers((prev) =>
          prev.map((s) => (s.id === serverID ? { ...s, status: "online", sessionsLoading: false } : s)),
        )
        return
      }

      const sessionsRes = await fetch(`${base}/experimental/session?limit=100`)
      const json = sessionsRes.ok ? await sessionsRes.json() : []
      const sessions: SessionItem[] = Array.isArray(json)
        ? json
            .map((item: any) => ({
              id: String(item.id ?? ""),
              title: String(item.title ?? item.id ?? "Untitled session"),
              updated: Number(item?.time?.updated ?? 0),
            }))
            .filter((s) => s.id.length > 0)
            .sort((a, b) => b.updated - a.updated)
        : []

      setServers((prev) =>
        prev.map((s) => (s.id === serverID ? { ...s, status: "online", sessionsLoading: false, sessions } : s)),
      )
    } catch {
      setServers((prev) =>
        prev.map((s) => (s.id === serverID ? { ...s, status: "offline", sessionsLoading: false, sessions: [] } : s)),
      )
    }
  }, [])

  const refreshAllServerHealth = useCallback(() => {
    const ids = serversRef.current.map((s) => s.id)
    ids.forEach((id) => {
      refreshServerStatusAndSessions(id, false)
    })
  }, [refreshServerStatusAndSessions])

  const toggleServerMenu = useCallback(() => {
    Haptics.selectionAsync().catch(() => {})
    setIsAddingServer(false)
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
    Haptics.selectionAsync().catch(() => {})
    refreshServerStatusAndSessions(activeServer.id)
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
      refreshServerStatusAndSessions(id)
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

  const handleStartAddServer = useCallback(() => {
    setIsAddingServer(true)
    setServerDraftRelayURL(DEFAULT_RELAY_URL)
    setServerDraftRelaySecret("")
  }, [])

  const handleCancelAddServer = useCallback(() => {
    setIsAddingServer(false)
    setServerDraftRelayURL(DEFAULT_RELAY_URL)
    setServerDraftRelaySecret("")
  }, [])

  const handleConfirmAddServer = useCallback(() => {
    const raw = serverDraftURL.trim()
    if (!raw) return

    const normalized = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `http://${raw}`

    const rawRelay = serverDraftRelayURL.trim()
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
      return
    }

    const id = `srv-${Date.now()}`
    const relaySecret = serverDraftRelaySecret.trim()
    const inferredName =
      parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" ? "Local OpenCode" : parsed.hostname

    setServers((prev) => [
      ...prev,
      {
        id,
        name: inferredName,
        url: `${parsed.protocol}//${parsed.host}`,
        relayURL: `${relayParsed.protocol}//${relayParsed.host}`,
        relaySecret,
        status: "offline",
        sessions: [],
        sessionsLoading: false,
      },
    ])
    setActiveServerId(id)
    setActiveSessionId(null)
    setIsAddingServer(false)
    setServerDraftRelaySecret("")
    setDropdownMode("none")
    refreshServerStatusAndSessions(id)
  }, [refreshServerStatusAndSessions, serverDraftRelaySecret, serverDraftRelayURL, serverDraftURL])

  useEffect(() => {
    if (!activeServerId) return
    refreshServerStatusAndSessions(activeServerId)
    const timer = setInterval(() => {
      refreshServerStatusAndSessions(activeServerId)
    }, 15000)
    return () => clearInterval(timer)
  }, [activeServerId, refreshServerStatusAndSessions])

  useEffect(() => {
    if (Platform.OS !== "ios") return
    if (!devicePushToken) return

    const list = servers.filter((server) => server.relaySecret.trim().length > 0)
    if (!list.length) return

    const bundleId = Constants.expoConfig?.ios?.bundleIdentifier ?? "com.anomalyco.mobilevoice"
    const apnsEnv = process.env.NODE_ENV === "production" ? "production" : "sandbox"

    Promise.allSettled(
      list.map((server) =>
        registerRelayDevice({
          relayBaseURL: server.relayURL,
          secret: server.relaySecret.trim(),
          deviceToken: devicePushToken,
          bundleId,
          apnsEnv,
        }),
      ),
    ).catch(() => {})
  }, [devicePushToken, servers])

  useEffect(() => {
    if (Platform.OS !== "ios") return
    if (!devicePushToken) return
    const previous = previousPushTokenRef.current
    previousPushTokenRef.current = devicePushToken
    if (!previous || previous === devicePushToken) return

    const list = servers.filter((server) => server.relaySecret.trim().length > 0)
    if (!list.length) return

    Promise.allSettled(
      list.map((server) =>
        unregisterRelayDevice({
          relayBaseURL: server.relayURL,
          secret: server.relaySecret.trim(),
          deviceToken: previous,
        }),
      ),
    ).catch(() => {})
  }, [devicePushToken, servers])

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
                  <Text style={styles.workspaceHeaderText} numberOfLines={1}>
                    {activeServer.name}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.headerSplitDivider} />

              <Pressable
                onPress={toggleSessionMenu}
                style={({ pressed }) => [styles.headerSplitRight, pressed && styles.clearButtonPressed]}
              >
                <Text style={styles.workspaceHeaderText} numberOfLines={1}>
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
                activeServer.sessionsLoading ? (
                  <Text style={styles.serverEmptyText}>Loading sessions…</Text>
                ) : activeServer.sessions.length === 0 ? (
                  <Text style={styles.serverEmptyText}>No sessions available</Text>
                ) : (
                  activeServer.sessions.map((session) => (
                    <Pressable
                      key={session.id}
                      onPress={() => handleSelectSession(session.id)}
                      style={({ pressed }) => [styles.serverRow, pressed && styles.serverRowPressed]}
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
              isAddingServer ? (
                <View style={styles.addServerComposer}>
                  <TextInput
                    value={serverDraftURL}
                    onChangeText={setServerDraftURL}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    placeholder="https://your-opencode-server"
                    placeholderTextColor="#6F7686"
                    style={styles.addServerInput}
                  />
                  <TextInput
                    value={serverDraftRelayURL}
                    onChangeText={setServerDraftRelayURL}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    placeholder="https://your-relay-server"
                    placeholderTextColor="#6F7686"
                    style={styles.addServerInput}
                  />
                  <TextInput
                    value={serverDraftRelaySecret}
                    onChangeText={setServerDraftRelaySecret}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Relay shared secret"
                    placeholderTextColor="#6F7686"
                    secureTextEntry
                    style={styles.addServerInput}
                  />
                  <View style={styles.addServerActions}>
                    <Pressable onPress={handleCancelAddServer}>
                      <Text style={styles.addServerCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={handleConfirmAddServer}>
                      <Text style={styles.addServerConfirmText}>Add</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={handleStartAddServer} style={styles.addServerButton}>
                  <Text style={styles.addServerButtonText}>+ Add server</Text>
                </Pressable>
              )
            ) : null}
          </Animated.View>
        </Animated.View>
      </View>

      {/* Transcription area */}
      <View style={styles.transcriptionArea}>
        <View style={styles.transcriptionTopActions} pointerEvents="box-none">
          <Pressable
            onPress={handleClearTranscript}
            style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
            hitSlop={8}
          >
            <Animated.Text style={[styles.clearIcon, animatedClearIconStyle]}>↻</Animated.Text>
          </Pressable>
        </View>

        {monitorStatus ? (
          <View style={styles.monitorBadge}>
            <Text style={styles.monitorBadgeText}>{monitorStatus}</Text>
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

      {/* Record button */}
      <View style={styles.controlsRow} onLayout={handleControlsLayout}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!permissionGranted || modelLoading}
          style={[styles.recordPressable, (!permissionGranted || modelLoading) && styles.recordButtonDisabled]}
        >
          <View style={styles.recordButton}>
            <Animated.View style={[styles.recordBorder, animatedBorderStyle]} pointerEvents="none" />
            <Animated.View style={[styles.recordDot, animatedDotStyle]} />
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    position: "relative",
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
  },
  headerSplitRow: {
    height: 45,
    flexDirection: "row",
    alignItems: "center",
  },
  headerSplitLeft: {
    maxWidth: "38%",
    height: "100%",
    justifyContent: "center",
    paddingRight: 8,
  },
  headerSplitDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#2B3140",
    marginRight: 10,
  },
  headerSplitRight: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
  },
  workspaceHeaderText: {
    color: "#8F8F8F",
    fontSize: 14,
    fontWeight: "600",
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
  addServerComposer: {
    marginTop: 8,
    paddingHorizontal: 4,
    gap: 8,
  },
  addServerInput: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A33",
    backgroundColor: "#151515",
    color: "#D6DAE4",
    paddingHorizontal: 12,
    fontSize: 14,
  },
  addServerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    paddingHorizontal: 4,
  },
  addServerCancelText: {
    color: "#8C93A3",
    fontSize: 14,
    fontWeight: "600",
  },
  addServerConfirmText: {
    color: "#FF6A78",
    fontSize: 14,
    fontWeight: "700",
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
    backgroundColor: "#151515",
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#282828",
    overflow: "hidden",
    position: "relative",
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
    right: 10,
    zIndex: 4,
  },
  monitorBadge: {
    alignSelf: "flex-start",
    marginLeft: 14,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#1B2438",
    borderWidth: 1,
    borderColor: "#2B3D66",
  },
  monitorBadgeText: {
    color: "#BFD0FA",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
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
