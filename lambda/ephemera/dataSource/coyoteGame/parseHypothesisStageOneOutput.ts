import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { normalizeSeamRoomLabelToken, seamRoomLabelFromEphemeraRoomId } from './coyoteHypothesisPromptShared'

/*
 * Stage 1 emits a Markdown "seam" that stage 2 consumes. Markdown is a compact wire format between
 * model calls (readable in prompts and logs, no extra JSON escaping in the transcript).
 *
 * That choice pushes complexity here: we must deterministically validate structure, constrained
 * tokens, and alignment with `roomObjectsByRoom` so bad stage-1 output fails closed (stub intent)
 * instead of propagating into a second Bedrock call and unreliable stage-2 output.
 *
 * This module is intentionally self-contained prototype logic. If multi-step seams with strict
 * contracts become a recurring pattern, consider extracting shared helpers (section splitting,
 * multiset checks, fenced-block stripping) rather than growing one-off parsers.
 */

const AFFINITY_TOKENS = new Set(['coyoteOperated', 'roadRunnerTrap', 'ambiguous'])
const COYOTE_ROLE_TOKENS = new Set(['participant', 'trapSetter', 'ambiguous'])

export type ParseHypothesisStageOneSuccess = {
    ok: true
    markdown: string
}

export type ParseHypothesisStageOneFailure = {
    ok: false
    errorMessage: string
}

export type ParseHypothesisStageOneResult = ParseHypothesisStageOneSuccess | ParseHypothesisStageOneFailure

export function stripHypothesisStageOneFence(body: string): string {
    let s = body.trim()
    const fenceOpen = /^```(?:markdown|md|text)?\s*\r?\n?/
    const fenceClose = /\r?\n```\s*$/
    if (fenceOpen.test(s)) {
        s = s.replace(fenceOpen, '').replace(fenceClose, '').trim()
    }
    return s
}

function normalizeNewlines(text: string): string {
    return text.replace(/\r\n/g, '\n')
}

function sortedMultisetKey(pairs: [string, string][]): string {
    const keys = pairs.map(([a, b]) => `${a} · ${b}`).sort()
    return JSON.stringify(keys)
}

/** Multiset keys use short seam labels (ROOM# stripped), aligned with prompts + topology names. */
function expectedObjectPairs(roomObjectsByRoom: Record<EphemeraRoomId, EphemeraMetaRoomObject[]>): [string, string][] {
    const pairs: [string, string][] = []
    for (const [roomId, objects] of Object.entries(roomObjectsByRoom)) {
        const seamLabel = seamRoomLabelFromEphemeraRoomId(roomId as EphemeraRoomId)
        for (const { shortName } of objects) {
            pairs.push([seamLabel, shortName])
        }
    }
    return pairs
}

function sectionExtract(body: string, title: string): { found: false } | { found: true; start: number; end: number } {
    const re = new RegExp(`^## ${title}\\s*$`, 'm')
    const m = body.match(re)
    if (!m || m.index === undefined) {
        return { found: false }
    }
    return { found: true, start: m.index, end: m.index + m[0].length }
}

/**
 * Validates stage-1 body against the locked seam contract, then returns the normalized Markdown for
 * stage 2. See module comment above for why validation is strict; task plan: Stage 1 seam contract.
 */
export function parseHypothesisStageOneOutput(
    rawBody: string,
    roomObjectsByRoom: Record<EphemeraRoomId, EphemeraMetaRoomObject[]>
): ParseHypothesisStageOneResult {
    const inner = normalizeNewlines(stripHypothesisStageOneFence(rawBody)).trim()
    if (!inner) {
        return { ok: false, errorMessage: 'stage 1 seam: empty body' }
    }

    const secObjects = sectionExtract(inner, 'Objects')
    const secClusters = sectionExtract(inner, 'Clusters')
    if (!secObjects.found || !secClusters.found) {
        return { ok: false, errorMessage: 'stage 1 seam: requires ## Objects and ## Clusters' }
    }
    if (secClusters.start <= secObjects.start) {
        return { ok: false, errorMessage: 'stage 1 seam: ## Clusters must follow ## Objects' }
    }

    const objectsInner = inner.slice(secObjects.end, secClusters.start).trim()
    const clustersInner = inner.slice(secClusters.end).trim()

    const expectedPairs = expectedObjectPairs(roomObjectsByRoom)
    const parsedPairs: [string, string][] = []

    const objectHeadingRe = /^### (\S+) · (.+)$/u
    const objectBlocks = objectsInner.split(/\n(?=### )/).map((b) => b.trim()).filter(Boolean)

    for (const block of objectBlocks) {
        const rawLines = block.split('\n')
        const heading = rawLines[0]?.trim() ?? ''
        const hm = heading.match(objectHeadingRe)
        if (!hm) {
            return { ok: false, errorMessage: `stage 1 seam: invalid object heading: ${heading}` }
        }
        const roomLabel = normalizeSeamRoomLabelToken(hm[1])
        const shortName = hm[2].trim()
        parsedPairs.push([roomLabel, shortName])

        const bullets = rawLines.slice(1).filter((l) => l.trim().length > 0)
        if (bullets.length !== 2) {
            return {
                ok: false,
                errorMessage: `stage 1 seam: expected two bullets under ${roomLabel} · ${shortName}, got ${bullets.length}`,
            }
        }
        const b0 = bullets[0].trim()
        const b1 = bullets[1].trim()
        if (!/^-\s*\*\*Function:\*\*\s+\S/u.test(b0)) {
            return { ok: false, errorMessage: `stage 1 seam: first bullet must be - **Function:** ... under ${roomLabel}` }
        }
        const affinityM = b1.match(/^-\s*\*\*Affinity:\*\*\s*(\S+)\s*$/u)
        if (!affinityM || !AFFINITY_TOKENS.has(affinityM[1])) {
            return {
                ok: false,
                errorMessage: `stage 1 seam: second bullet must be - **Affinity:** <${[...AFFINITY_TOKENS].join('|')}> under ${roomLabel}`,
            }
        }
    }

    const expectedSorted = sortedMultisetKey(expectedPairs.map(([a, b]) => [a, b]))
    const parsedSorted = sortedMultisetKey(parsedPairs)
    if (parsedPairs.length !== expectedPairs.length || parsedSorted !== expectedSorted) {
        return {
            ok: false,
            errorMessage: `stage 1 seam: object multiset mismatch (expected ${expectedSorted}, parsed ${parsedSorted})`,
        }
    }

    const clusterBlocks = clustersInner.split(/\n(?=### )/).map((b) => b.trim()).filter(Boolean)
    if (clusterBlocks.length < 1 || clusterBlocks.length > 2) {
        return {
            ok: false,
            errorMessage: `stage 1 seam: expected 1 or 2 clusters, got ${clusterBlocks.length}`,
        }
    }

    const memberRefRe = /^(\S+) · (.+)$/u

    for (const cblock of clusterBlocks) {
        const rawLines = cblock.split('\n')
        const first = rawLines[0]?.trim() ?? ''
        if (!/^### .+/u.test(first)) {
            return { ok: false, errorMessage: `stage 1 seam: invalid cluster heading: ${first}` }
        }
        const bullets = rawLines.slice(1).filter((l) => l.trim().length > 0)
        if (bullets.length !== 3) {
            return { ok: false, errorMessage: `stage 1 seam: cluster must have three bullets (Members, Coyote role, Summary)` }
        }
        const mLine = bullets[0].trim()
        const rLine = bullets[1].trim()
        const sLine = bullets[2].trim()
        if (!/^-\s*\*\*Members:\*\*\s*\S/u.test(mLine)) {
            return { ok: false, errorMessage: 'stage 1 seam: cluster first bullet must be **Members:**' }
        }
        const membersBody = mLine.replace(/^-\s*\*\*Members:\*\*\s*/u, '').trim()
        const refs = membersBody.split(';').map((s) => s.trim()).filter(Boolean)
        for (const ref of refs) {
            const rm = ref.match(memberRefRe)
            if (!rm) {
                return { ok: false, errorMessage: `stage 1 seam: invalid member "${ref}"` }
            }
            const memberRoom = normalizeSeamRoomLabelToken(rm[1])
            const key = `${memberRoom} · ${rm[2].trim()}`
            const okPair = parsedPairs.some(([rid, sn]) => `${rid} · ${sn}` === key)
            if (!okPair) {
                return { ok: false, errorMessage: `stage 1 seam: unknown cluster member "${ref}"` }
            }
        }
        const roleM = rLine.match(/^-\s*\*\*Coyote role:\*\*\s*(\S+)\s*$/u)
        if (!roleM || !COYOTE_ROLE_TOKENS.has(roleM[1])) {
            return { ok: false, errorMessage: `stage 1 seam: invalid **Coyote role:** token` }
        }
        const summaryBody = sLine.replace(/^-\s*\*\*Summary:\*\*\s*/u, '').trim()
        if (!summaryBody.length) {
            return { ok: false, errorMessage: 'stage 1 seam: empty **Summary:**' }
        }
    }

    return { ok: true, markdown: inner }
}
