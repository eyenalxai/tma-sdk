type PlatformKind = "mobile" | "desktop" | "web" | "unknown"

type PlatformInfo = {
  /** The raw platform string from the launch parameters. */
  name: string
  kind: PlatformKind
  supportsViewport: boolean
  isEmbeddedWeb: boolean
}

type PlatformDefinition = Omit<PlatformInfo, "name">

const unknownPlatform: PlatformDefinition = {
  kind: "unknown",
  supportsViewport: false,
  isEmbeddedWeb: false,
}

// `supportsViewport` records whether the client provides a usable viewport height.
// Mobile clients report a measured viewport. Telegram Desktop measures its layout.
// The macOS client answers with a null payload, so it has no usable height.
// Unigram and the embedded web clients never answer; waiting stalls mount.
// `android_x` and `unigram` are legacy aliases.
const platformTable = new Map<string, PlatformDefinition>([
  ["ios", { kind: "mobile", supportsViewport: true, isEmbeddedWeb: false }],
  ["android", { kind: "mobile", supportsViewport: true, isEmbeddedWeb: false }],
  ["android_x", { kind: "mobile", supportsViewport: true, isEmbeddedWeb: false }],
  ["macos", { kind: "desktop", supportsViewport: false, isEmbeddedWeb: false }],
  ["tdesktop", { kind: "desktop", supportsViewport: true, isEmbeddedWeb: false }],
  ["windows", { kind: "desktop", supportsViewport: false, isEmbeddedWeb: false }],
  ["unigram", { kind: "desktop", supportsViewport: false, isEmbeddedWeb: false }],
  ["web", { kind: "web", supportsViewport: false, isEmbeddedWeb: true }],
  ["weba", { kind: "web", supportsViewport: false, isEmbeddedWeb: true }],
  ["webk", { kind: "web", supportsViewport: false, isEmbeddedWeb: true }],
  ["unknown", unknownPlatform],
])

const getPlatform = (name: string): PlatformInfo => {
  const definition = platformTable.get(name) ?? unknownPlatform
  return { name, ...definition }
}

export { getPlatform, type PlatformInfo, type PlatformKind }
