const desktopPlatforms = new Set(["macos", "tdesktop", "unigram", "windows", "web", "weba", "webk"])

// Desktop and web clients do not resize the Mini App viewport. Unigram sends
// `windows`; `unigram`, `webk` and `weba` are accepted as alternative values.
const isDesktopPlatform = (platform: string): boolean => desktopPlatforms.has(platform)

export { isDesktopPlatform }
