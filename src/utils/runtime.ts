export function isRunningOnBun() {
    return !!process.versions.bun
}