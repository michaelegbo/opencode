import { describe, expect, test } from "bun:test"
import { attachmentMime } from "./files"
import { MAX_ATTACHMENT_BYTES, estimateAttachment, totalAttachments, wouldExceedAttachmentLimit } from "./limit"
import { pasteMode } from "./paste"

describe("attachmentMime", () => {
  test("keeps PDFs when the browser reports the mime", async () => {
    const file = new File(["%PDF-1.7"], "guide.pdf", { type: "application/pdf" })
    expect(await attachmentMime(file)).toBe("application/pdf")
  })

  test("normalizes structured text types to text/plain", async () => {
    const file = new File(['{"ok":true}\n'], "data.json", { type: "application/json" })
    expect(await attachmentMime(file)).toBe("text/plain")
  })

  test("accepts text files even with a misleading browser mime", async () => {
    const file = new File(["export const x = 1\n"], "main.ts", { type: "video/mp2t" })
    expect(await attachmentMime(file)).toBe("text/plain")
  })

  test("rejects binary files", async () => {
    const file = new File([Uint8Array.of(0, 255, 1, 2)], "blob.bin", { type: "application/octet-stream" })
    expect(await attachmentMime(file)).toBeUndefined()
  })
})

describe("pasteMode", () => {
  test("uses native paste for short single-line text", () => {
    expect(pasteMode("hello world")).toBe("native")
  })

  test("uses manual paste for multiline text", () => {
    expect(
      pasteMode(`{
  "ok": true
}`),
    ).toBe("manual")
    expect(pasteMode("a\r\nb")).toBe("manual")
  })

  test("uses manual paste for large text", () => {
    expect(pasteMode("x".repeat(8000))).toBe("manual")
  })
})

describe("attachment limit", () => {
  test("estimates encoded attachment size", () => {
    expect(estimateAttachment({ size: 3 }, "image/png")).toBe("data:image/png;base64,".length + 4)
  })

  test("totals current attachments", () => {
    expect(totalAttachments([{ dataUrl: "abc" }, { dataUrl: "de" }])).toBe(5)
  })

  test("flags uploads that exceed the total limit", () => {
    const list = [{ dataUrl: "a".repeat(MAX_ATTACHMENT_BYTES - 4) }]
    expect(wouldExceedAttachmentLimit(list, { size: 3 }, "image/png")).toBe(true)
    expect(wouldExceedAttachmentLimit([], { size: 3 }, "image/png")).toBe(false)
  })
})
