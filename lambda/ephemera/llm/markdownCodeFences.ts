/** Markdown fenced code blocks (``` optional lang + newline ... ```). Shared by LLM output parsers (e.g. Coyote hypothesis). */

export type FenceBlock = {
    start: number
    end: number
    interior: string
    /** Language tag after opening ``` (may be empty). */
    lang: string
}

export function findAllFenceBlocks(s: string): FenceBlock[] {
    const blocks: FenceBlock[] = []
    let i = 0
    while (i < s.length) {
        const tick = s.indexOf('```', i)
        if (tick < 0) {
            break
        }
        const rest = s.slice(tick + 3)
        const m = rest.match(/^([\w]*)\r?\n/)
        if (!m) {
            i = tick + 3
            continue
        }
        const innerStart = tick + 3 + m[0].length
        const closeIdx = s.indexOf('```', innerStart)
        if (closeIdx < 0) {
            break
        }
        const interior = s.slice(innerStart, closeIdx)
        blocks.push({ start: tick, end: closeIdx + 3, interior, lang: m[1] ?? '' })
        i = closeIdx + 3
    }
    return blocks
}
