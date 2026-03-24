import type { LanguageModelV2 } from "@ai-sdk/provider"
import { MockLanguageModel } from "./model"

export { vfsPlugin } from "./plugin"
export { Filesystem as VFilesystem } from "./vfs"

export interface MockProviderSettings {
  name?: string
}

export interface MockProvider {
  (id: string): LanguageModelV2
  languageModel(id: string): LanguageModelV2
}

export function createMock(options: MockProviderSettings = {}): MockProvider {
  const name = options.name ?? "mock"

  const create = (id: string) => new MockLanguageModel(id, { provider: name })

  const provider = Object.assign((id: string) => create(id), { languageModel: create })

  return provider
}
