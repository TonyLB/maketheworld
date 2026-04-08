import type { EphemeraCacheMarkState } from '../baseClasses'

/**
 * Normalized mark state for stable comparison (trim, dedupe by mark, sort).
 */
export const normalizeMarkState = (markState: EphemeraCacheMarkState): EphemeraCacheMarkState => {
    const deduped = new Map<string, string>()

    for (const entry of markState.markValue) {
        if (!entry || typeof entry.mark !== 'string' || typeof entry.value !== 'string') {
            continue
        }
        const mark = entry.mark.trim()
        const value = entry.value.trim()
        if (!mark || !value) {
            continue
        }
        deduped.set(mark, value)
    }

    const markValue = Array.from(deduped.entries())
        .sort(([markA], [markB]) => {
            if (markA < markB) {
                return -1
            }
            if (markA > markB) {
                return 1
            }
            return 0
        })
        .map(([mark, value]) => ({ mark, value }))

    return { markValue }
}

export const markStatesEqual = (a: EphemeraCacheMarkState, b: EphemeraCacheMarkState): boolean => {
    const normalizedA = normalizeMarkState(a)
    const normalizedB = normalizeMarkState(b)

    if (normalizedA.markValue.length !== normalizedB.markValue.length) {
        return false
    }

    for (let index = 0; index < normalizedA.markValue.length; index += 1) {
        const entryA = normalizedA.markValue[index]
        const entryB = normalizedB.markValue[index]
        if (entryA.mark !== entryB.mark || entryA.value !== entryB.value) {
            return false
        }
    }

    return true
}
