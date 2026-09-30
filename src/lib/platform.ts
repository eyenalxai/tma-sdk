const desktopPlatforms = new Set(["macos", "tdesktop", "unigram", "windows", "web", "weba", "webk"])

// Desktop and web clients do not resize the Mini App viewport. Unigram reports
// `windows`, while `unigram`, `webk` and `weba` appear in older builds.
const isDesktopPlatform = (platform: string): boolean => desktopPlatforms.has(platform)

export { isDesktopPlatform }
