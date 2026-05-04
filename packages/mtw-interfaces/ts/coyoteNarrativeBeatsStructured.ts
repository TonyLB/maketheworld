import {
    COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY,
    isSyntaxMaterializedAffordanceStableKey,
    normalizeStableKeyCharset,
} from './coyotePlanAffinities'

export type CoyoteNarrativeBeat = {
    beatId: string
    description: string
    derivedFrom: string[]
}

export type CoyoteNarrativeBeatsStructured = {
    beats: CoyoteNarrativeBeat[]
    linearizedSequence: string[]
}

export type CoyoteNarrativeBeatsValidationContext = {
    snapshotStableKeys: ReadonlySet<string>
    /** Seam room labels and topology tokens allowed in derivedFrom when not snapshot keys. */
    allowedTopologyRefTokens?: ReadonlySet<string>
}

export type ValidateCoyoteNarrativeBeatsStructuredResult =
    | { ok: true; narrativeBeatsStructured: CoyoteNarrativeBeatsStructured }
    | { ok: false; reason: string }

const ROOT_KEYS = new Set(['beats', 'linearizedSequence'])
const BEAT_KEYS = new Set(['beatId', 'description', 'derivedFrom'])

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function normalizedStableKey(raw: string): string {
    return normalizeStableKeyCharset(raw.trim())
}

function normalizedTopologyRef(raw: string): string {
    return raw.trim().toLowerCase()
}

function buildNormalizedSnapshotSet(snapshotStableKeys: ReadonlySet<string>): Set<string> {
    const out = new Set<string>()
    for (const k of snapshotStableKeys) {
        out.add(normalizedStableKey(k))
    }
    return out
}

function buildTopologyLookup(allowed?: ReadonlySet<string>): Set<string> | undefined {
    if (allowed === undefined || allowed.size === 0) {
        return undefined
    }
    const out = new Set<string>()
    for (const t of allowed) {
        out.add(normalizedTopologyRef(t))
    }
    return out
}

function validateDerivedFromToken(
    raw: string,
    snapshotNorm: Set<string>,
    topologyLookup: Set<string> | undefined,
    hadTopologyAllowlist: boolean
): { ok: true } | { ok: false; reason: string } {
    const norm = normalizedStableKey(raw)
    if (norm.length === 0) {
        return { ok: false, reason: 'derivedFrom contains an empty token' }
    }
    if (norm === COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY) {
        return { ok: true }
    }
    if (snapshotNorm.has(norm)) {
        return { ok: true }
    }
    if (topologyLookup?.has(normalizedTopologyRef(raw))) {
        return { ok: true }
    }
    if (isSyntaxMaterializedAffordanceStableKey(raw)) {
        return { ok: true }
    }
    if (hadTopologyAllowlist) {
        return {
            ok: false,
            reason:
                `derivedFrom token ${JSON.stringify(raw)} is not a snapshot stableKey, not reserved "${COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY}", and not in the topology allowlist`,
        }
    }
    return {
        ok: false,
        reason: `derivedFrom token ${JSON.stringify(raw)} is not a snapshot stableKey and not reserved "${COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY}"`,
    }
}

export function validateCoyoteNarrativeBeatsStructured(
    raw: unknown,
    ctx: CoyoteNarrativeBeatsValidationContext
): ValidateCoyoteNarrativeBeatsStructuredResult {
    const snapshotNorm = buildNormalizedSnapshotSet(ctx.snapshotStableKeys)
    const topologyLookup = buildTopologyLookup(ctx.allowedTopologyRefTokens)
    const hadTopologyAllowlist = topologyLookup !== undefined && topologyLookup.size > 0
    if (!isPlainObject(raw)) {
        return { ok: false, reason: 'narrativeBeatsStructured must be a plain object' }
    }
    const rootKeys = Object.keys(raw)
    if (rootKeys.length !== 2 || !rootKeys.every((key) => ROOT_KEYS.has(key))) {
        return { ok: false, reason: 'narrativeBeatsStructured root must contain exactly keys "beats" and "linearizedSequence"' }
    }
    const beatsRaw = raw.beats
    if (!Array.isArray(beatsRaw) || beatsRaw.length === 0) {
        return { ok: false, reason: 'beats must be a non-empty array' }
    }
    const beats: CoyoteNarrativeBeat[] = []
    const beatIds = new Set<string>()
    for (let i = 0; i < beatsRaw.length; i++) {
        const beatRaw = beatsRaw[i]
        if (!isPlainObject(beatRaw)) {
            return { ok: false, reason: `beats[${i}] must be a plain object` }
        }
        const keys = Object.keys(beatRaw)
        if (keys.length !== 3 || !keys.every((key) => BEAT_KEYS.has(key))) {
            return { ok: false, reason: `beats[${i}] must contain exactly keys "beatId", "description", and "derivedFrom"` }
        }
        const beatId = beatRaw.beatId
        const description = beatRaw.description
        const derivedFrom = beatRaw.derivedFrom
        if (typeof beatId !== 'string' || beatId.trim().length === 0) {
            return { ok: false, reason: `beats[${i}].beatId must be a non-empty string` }
        }
        const beatIdTrimmed = beatId.trim()
        if (beatIds.has(beatIdTrimmed)) {
            return { ok: false, reason: `beats[${i}].beatId duplicates ${beatIdTrimmed}` }
        }
        if (typeof description !== 'string' || description.trim().length === 0) {
            return { ok: false, reason: `beats[${i}].description must be a non-empty string` }
        }
        if (!Array.isArray(derivedFrom) || derivedFrom.length === 0) {
            return { ok: false, reason: `beats[${i}].derivedFrom must be a non-empty array` }
        }
        if (!derivedFrom.every((item): item is string => typeof item === 'string')) {
            return { ok: false, reason: `beats[${i}].derivedFrom must be an array of strings` }
        }
        for (const token of derivedFrom) {
            const tokenRes = validateDerivedFromToken(token, snapshotNorm, topologyLookup, hadTopologyAllowlist)
            if (!tokenRes.ok) {
                return { ok: false, reason: `beats[${i}].${tokenRes.reason}` }
            }
        }
        beatIds.add(beatIdTrimmed)
        beats.push({
            beatId: beatIdTrimmed,
            description: description.trim(),
            derivedFrom: [...derivedFrom],
        })
    }
    const linearizedSequenceRaw = raw.linearizedSequence
    if (!Array.isArray(linearizedSequenceRaw) || linearizedSequenceRaw.length === 0) {
        return { ok: false, reason: 'linearizedSequence must be a non-empty array' }
    }
    if (!linearizedSequenceRaw.every((item): item is string => typeof item === 'string')) {
        return { ok: false, reason: 'linearizedSequence must be an array of strings' }
    }
    const linearizedSequence: string[] = []
    const linearizedSeen = new Set<string>()
    for (let i = 0; i < linearizedSequenceRaw.length; i++) {
        const beatId = linearizedSequenceRaw[i].trim()
        if (beatId.length === 0) {
            return { ok: false, reason: `linearizedSequence[${i}] must be a non-empty string` }
        }
        if (!beatIds.has(beatId)) {
            return { ok: false, reason: `linearizedSequence[${i}] references unknown beatId ${beatId}` }
        }
        if (linearizedSeen.has(beatId)) {
            return { ok: false, reason: `linearizedSequence[${i}] duplicates beatId ${beatId}` }
        }
        linearizedSeen.add(beatId)
        linearizedSequence.push(beatId)
    }
    return {
        ok: true,
        narrativeBeatsStructured: {
            beats,
            linearizedSequence,
        },
    }
}
