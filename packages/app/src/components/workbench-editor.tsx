import { createEffect, on, onCleanup, onMount } from "solid-js"
import { useTheme } from "@opencode-ai/ui/theme/context"
import * as monaco from "monaco-editor"
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker"
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker"
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker"
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker"
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"

const env = globalThis as typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: (_: string, label: string) => Worker
  }
}

env.MonacoEnvironment ??= {
  getWorker: (_, label) => {
    if (label === "json") return new JsonWorker()
    if (label === "css" || label === "scss" || label === "less") return new CssWorker()
    if (label === "html" || label === "handlebars" || label === "razor") return new HtmlWorker()
    if (label === "typescript" || label === "javascript") return new TsWorker()
    return new EditorWorker()
  },
}

export function WorkbenchEditor(props: {
  path: string
  value: string
  onChange: (value: string) => void
  onSave: VoidFunction
}) {
  const theme = useTheme()
  let root: HTMLDivElement | undefined
  let view: monaco.editor.IStandaloneCodeEditor | undefined
  let model: monaco.editor.ITextModel | undefined
  let skip = false

  const sync = (path: string, value: string) => {
    if (!view) return
    const uri = monaco.Uri.file(path)
    const next = monaco.editor.getModel(uri) ?? monaco.editor.createModel(value, undefined, uri)
    const prev = model
    model = next
    if (next.getValue() !== value) {
      skip = true
      next.setValue(value)
      skip = false
    }
    skip = true
    view.setModel(next)
    skip = false
    if (prev === next) return
    prev?.dispose()
  }

  onMount(() => {
    if (!root) return

    view = monaco.editor.create(root, {
      automaticLayout: true,
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      tabSize: 2,
    })

    view.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => props.onSave())
    view.onDidChangeModelContent(() => {
      if (skip || !view) return
      props.onChange(view.getValue())
    })

    sync(props.path, props.value)
  })

  createEffect(() => {
    monaco.editor.setTheme(theme.mode() === "dark" ? "vs-dark" : "vs")
  })

  createEffect(
    on(
      () => props.path,
      () => {
        if (!view) return
        sync(props.path, props.value)
      },
      { defer: true },
    ),
  )

  createEffect(() => {
    if (!view || !model) return
    if (model.uri.fsPath !== monaco.Uri.file(props.path).fsPath) return
    if (model.getValue() === props.value) return
    skip = true
    model.setValue(props.value)
    skip = false
  })

  onCleanup(() => {
    model?.dispose()
    view?.dispose()
  })

  return <div ref={root} class="size-full" />
}
