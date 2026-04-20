import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { isCoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
/*
 * Stage 1 emits Markdown seam: optional ## Notes, required ## Clusters with ### subsections.
 * Each cluster lists members by **stableKey:** and optional fenced **intendedRole** JSON (CoyoteAffinityPossibility).
 */

export type ParsedClusterMember = {
    stableKey: string
    intendedRole?: CoyoteAffinityPossibility
}

export type ParsedCluster = {
    clusterName: string
    members: ParsedClusterMember[]
}

export type ParseHypothesisStageOneSuccess = {
    ok: true
    markdown: string
    clusters: ParsedCluster[]
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

function sectionExtract(body: string, title: string): { found: false } | { found: true; start: number; end: number } {
    const re = new RegExp(`^## ${title}\\s*$`, 'm')
    const m = body.match(re)
    if (!m || m.index === undefined) {
        return { found: false }
    }
    return { found: true, start: m.index, end: m.index + m[0].length }
}

function expectedStableKeysSorted(
    roomObjectsByRoom: Record<EphemeraRoomId, EphemeraMetaRoomObject[]>
): string[] {
    const keys: string[] = []
    for (const objects of Object.values(roomObjectsByRoom)) {
        for (const o of objects) {
            keys.push(o.stableKey.trim())
        }
    }
    return keys.map((k) => k).sort()
}

function parseClusterMemberLines(
    lines: string[]
): { ok: true; members: ParsedClusterMember[] } | { ok: false; errorMessage: string } {
    const members: ParsedClusterMember[] = []
    let i = 0
    const consumeBlank = (): void => {
        while (i < lines.length && lines[i].trim() === '') {
            i += 1
        }
    }

    while (true) {
        consumeBlank()
        if (i >= lines.length) {
            break
        }
        const skMatch = lines[i].trim().match(/^-\s*\*\*stableKey:\*\*\s*(.+)$/u)
        if (!skMatch) {
            return { ok: false, errorMessage: `stage 1 seam: expected - **stableKey:** line, got: ${lines[i].trim()}` }
        }
        const stableKey = skMatch[1].trim()
        if (!stableKey.length) {
            return { ok: false, errorMessage: 'stage 1 seam: empty stableKey' }
        }
        i += 1
        consumeBlank()

        let intendedRole: CoyoteAffinityPossibility | undefined
        if (i < lines.length && lines[i].trim().startsWith('```')) {
            const fenceLine = lines[i].trim()
            if (!/^```(?:json)?\s*$/u.test(fenceLine)) {
                return { ok: false, errorMessage: 'stage 1 seam: intendedRole must use ``` or ```json fence' }
            }
            i += 1
            const jsonLines: string[] = []
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                jsonLines.push(lines[i])
                i += 1
            }
            if (i >= lines.length) {
                return { ok: false, errorMessage: 'stage 1 seam: unclosed intendedRole ``` fence' }
            }
            i += 1
            const jsonBody = jsonLines.join('\n').trim()
            try {
                const parsed: unknown = JSON.parse(jsonBody)
                if (!isCoyoteAffinityPossibility(parsed)) {
                    return { ok: false, errorMessage: 'stage 1 seam: intendedRole JSON is not CoyoteAffinityPossibility' }
                }
                intendedRole = parsed
            } catch {
                return { ok: false, errorMessage: 'stage 1 seam: intendedRole JSON parse failed' }
            }
        }

        members.push({ stableKey, intendedRole })
    }

    return { ok: true, members }
}

/**
 * Validates stage-1 body against the seam contract, then returns normalized Markdown plus parsed clusters.
 */
export function parseHypothesisStageOneOutput(
    rawBody: string,
    roomObjectsByRoom: Record<EphemeraRoomId, EphemeraMetaRoomObject[]>
): ParseHypothesisStageOneResult {
    const inner = normalizeNewlines(stripHypothesisStageOneFence(rawBody)).trim()
    if (!inner) {
        return { ok: false, errorMessage: 'stage 1 seam: empty body' }
    }

    const secNotes = sectionExtract(inner, 'Notes')
    const secClusters = sectionExtract(inner, 'Clusters')

    if (!secClusters.found) {
        return { ok: false, errorMessage: 'stage 1 seam: requires ## Clusters' }
    }

    if (secNotes.found && secClusters.start <= secNotes.start) {
        return { ok: false, errorMessage: 'stage 1 seam: ## Notes must precede ## Clusters' }
    }

    const clustersInner = inner.slice(secClusters.end).trim()

    const clusterBlocks = clustersInner.split(/\n(?=### )/).map((b) => b.trim()).filter(Boolean)
    const expectedCount = expectedStableKeysSorted(roomObjectsByRoom).length

    if (expectedCount === 0) {
        return { ok: false, errorMessage: 'stage 1 seam: no staged objects to cluster' }
    }

    if (clusterBlocks.length < 1 || clusterBlocks.length > expectedCount) {
        return {
            ok: false,
            errorMessage: `stage 1 seam: expected 1–${expectedCount} clusters, got ${clusterBlocks.length}`,
        }
    }

    const clusters: ParsedCluster[] = []

    for (const cblock of clusterBlocks) {
        const rawLines = cblock.split('\n')
        const heading = rawLines[0]?.trim() ?? ''
        const hm = heading.match(/^### \s*(.+)$/u)
        if (!hm) {
            return { ok: false, errorMessage: `stage 1 seam: invalid cluster heading: ${heading}` }
        }
        const clusterName = hm[1].trim()
        if (!clusterName.length) {
            return { ok: false, errorMessage: 'stage 1 seam: empty cluster label' }
        }

        const memberLines = rawLines.slice(1)
        const parsedMembers = parseClusterMemberLines(memberLines)
        if (!parsedMembers.ok) {
            return { ok: false, errorMessage: parsedMembers.errorMessage }
        }
        if (parsedMembers.members.length < 1) {
            return { ok: false, errorMessage: `stage 1 seam: cluster "${clusterName}" has no members` }
        }

        clusters.push({
            clusterName,
            members: parsedMembers.members,
        })
    }

    const parsedKeys = clusters
        .flatMap((c) => c.members.map((m) => m.stableKey.trim()))
        .sort()

    const expectedSorted = JSON.stringify(expectedStableKeysSorted(roomObjectsByRoom))
    const parsedSorted = JSON.stringify(parsedKeys)

    if (parsedKeys.length !== expectedStableKeysSorted(roomObjectsByRoom).length || parsedSorted !== expectedSorted) {
        return {
            ok: false,
            errorMessage: `stage 1 seam: stableKey multiset mismatch (expected ${expectedSorted}, parsed ${parsedSorted})`,
        }
    }

    const snapshotByStableKey = new Map<string, EphemeraMetaRoomObject>()
    for (const objects of Object.values(roomObjectsByRoom)) {
        for (const o of objects) {
            snapshotByStableKey.set(o.stableKey.trim(), o)
        }
    }

    for (const cl of clusters) {
        for (const mem of cl.members) {
            const obj = snapshotByStableKey.get(mem.stableKey.trim())
            if (!obj) {
                return { ok: false, errorMessage: `stage 1 seam: unknown stableKey "${mem.stableKey}"` }
            }
            if (mem.intendedRole !== undefined) {
                const aff = obj.affinities
                if (!aff || aff.length === 0 || obj.affinitiesFailed === true) {
                    return {
                        ok: false,
                        errorMessage: `stage 1 seam: intendedRole given for ${mem.stableKey} but affinities unavailable`,
                    }
                }
                const match = aff.some((a) => affinityEchoMatches(a, mem.intendedRole!))
                if (!match) {
                    return {
                        ok: false,
                        errorMessage: `stage 1 seam: intendedRole does not match snapshot row for ${mem.stableKey}`,
                    }
                }
            }
        }
    }

    return { ok: true, markdown: inner, clusters }
}

function affinityEchoMatches(stored: CoyoteAffinityPossibility, echoed: CoyoteAffinityPossibility): boolean {
    if (stored.role !== echoed.role) {
        return false
    }
    if (stored.role === 'entity_modification' && echoed.role === 'entity_modification') {
        return (
            stored.target === echoed.target
            && stored.mode === echoed.mode
            && Math.abs(stored.aptness - echoed.aptness) < 1e-6
        )
    }
    return Math.abs(stored.aptness - echoed.aptness) < 1e-6
}
