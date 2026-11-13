import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import { createDownloads } from "./download-file"

describe("createDownloads", () => {
  it("returns downloading and stores the status", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const downloads = createDownloads(environment.runtime)
      expect(downloads.supported).toBe(true)
      expect(downloads.state.get().status).toBeNull()

      const request = downloads.actions.request("https://example.com/file.pdf", "file.pdf")
      expect(environment.posts).toEqual([
        {
          eventType: "web_app_request_file_download",
          eventData: '{"url":"https://example.com/file.pdf","file_name":"file.pdf"}',
        },
      ])

      environment.emit("file_download_requested", { status: "downloading" })

      expect(await request).toBe("downloading")
      expect(downloads.state.get().status).toBe("downloading")
    } finally {
      environment.dispose()
    }
  })

  it("returns cancelled instead of throwing", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const downloads = createDownloads(environment.runtime)

      const request = downloads.actions.request("https://example.com/file.pdf", "file.pdf")
      environment.emit("file_download_requested", { status: "cancelled" })

      expect(await request).toBe("cancelled")
      expect(downloads.state.get().status).toBe("cancelled")
    } finally {
      environment.dispose()
    }
  })
})
