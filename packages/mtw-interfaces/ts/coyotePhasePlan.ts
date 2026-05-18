//
// Coyote hypothesis: machine-checkable phase plan (hop 2 JSON contract).
// See task planning **Decided: phase-plan document shape** under coyoteGame.
//

import {
    COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY,
    isCoyoteTrope,
    isSyntaxMaterializedAffordanceStableKey,
    normalizeStableKeyCharset,
    type CoyoteTrope,
} from './coyotePlanAffinities'

export type CoyotePhasePlanPhaseKind = 'gathered' | 'synthesized' | 'deployed'

/** Aligns with **[`CoyoteGenerativeRole`](./coyotePlanAffinities.ts)** prep / creation semantics in prompts. */
export type CoyotePhasePrepVsBeat = 'prep' | 'creation'

export type CoyotePhaseVirtualEntity = {
    label: string
    derivedFrom: string[]
    phaseKind: CoyotePhasePlanPhaseKind
}

export type CoyotePhasePlanPhase = {
    trope: CoyoteTrope
    tropeBeat: string
    stableKeysUsed: string[]
    virtualEntities: CoyotePhaseVirtualEntity[]
    achievement: string
    prepVsBeat?: CoyotePhasePrepVsBeat
}

export type CoyotePhasePlan = {
    tropeSequence: CoyoteTrope[]
    deconflictionSummary: string
    phases: CoyotePhasePlanPhase[]
}

export type CoyotePhasePlanValidationContext = {
    snapshotStableKeys: ReadonlySet<string>
    /** Seam room labels and other topology tokens allowed in **`derivedFrom`** when they are not snapshot keys. Compared case-insensitively after trim. */
    allowedTopologyRefTokens?: ReadonlySet<string>
    caps?: {
        /** Max virtuals per phase whose **`derivedFrom`** lists no staged **`stableKey`** (topology + reserved **`setting`** only). */
        maxSettingOnlyVirtualsPerPhase?: number
    }
    /** Reserved for future product rules; **`off`** performs no extra **`phaseKind`** checks. */
    phaseKindStrictness?: 'off' | 'strict'
}

export type ValidateCoyotePhasePlanResult =
    | { ok: true; phasePlan: CoyotePhasePlan }
    | { ok: false; reason: string }

const PHASE_KINDS = new Set<CoyotePhasePlanPhaseKind>(['gathered', 'synthesized', 'deployed'])
const PREP_VS_BEAT = new Set<CoyotePhasePrepVsBeat>(['prep', 'creation'])

const ROOT_KEYS = new Set(['tropeSequence', 'deconflictionSummary', 'phases'])
const PHASE_KEYS_REQUIRED = new Set(['stableKeysUsed', 'virtualEntities', 'achievement'])
const VIRTUAL_KEYS = new Set(['label', 'derivedFrom', 'phaseKind'])
/** Canonical trope order for prompts, parsers, and tropeSequence validation (single source of truth). */
export const CANONICAL_TROPE_ORDER: CoyoteTrope[] = [
    'Scene Dressing',
    'Contraption',
    'Bait',
    'Misdirection',
    'Disadvantage',
    'Finishing Move',
]
const CANONICAL_TROPE_INDEX = new Map<CoyoteTrope, number>(
    CANONICAL_TROPE_ORDER.map((trope, index) => [trope, index])
)

/** Sparse trope sequence from a trope-keyed record, in canonical order (omits absent tropes). */
export function tropeSequenceFromAssignments(
    assignments: Partial<Record<CoyoteTrope, unknown>>
): CoyoteTrope[] {
    return CANONICAL_TROPE_ORDER.filter((trope) => assignments[trope] !== undefined)
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Normalizes for snapshot **`stableKey`** equality (trim + **[`normalizeStableKeyCharset`](./coyotePlanAffinities.ts)**). */
export function normalizedPhasePlanStableKey(raw: string): string {
    return normalizeStableKeyCharset(raw.trim())
}

/** Topology allowlist entries: trim + lowercase ASCII for comparison. */
function normalizedTopologyRef(raw: string): string {
    return raw.trim().toLowerCase()
}

function buildNormalizedSnapshotSet(snapshotStableKeys: ReadonlySet<string>): Set<string> {
    const out = new Set<string>()
    for (const k of snapshotStableKeys) {
        out.add(normalizedPhasePlanStableKey(k))
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

function topologyMatches(lookup: Set<string> | undefined, raw: string): boolean {
    if (lookup === undefined) {
        return false
    }
    return lookup.has(normalizedTopologyRef(raw))
}

/** True when derivedFrom cites at least one staged snapshot key or a well-formed materialized affordance token (handoff-only `affordance:` ids). */
function derivedFromReferencesSnapshotKey(derivedFrom: readonly string[], snapshotNorm: Set<string>): boolean {
    for (const raw of derivedFrom) {
        const norm = normalizedPhasePlanStableKey(raw)
        if (norm.length === 0) {
            continue
        }
        if (snapshotNorm.has(norm)) {
            return true
        }
        if (isSyntaxMaterializedAffordanceStableKey(raw)) {
            return true
        }
    }
    return false
}

function validateDerivedFromToken(
    raw: string,
    snapshotNorm: Set<string>,
    topologyLookup: Set<string> | undefined,
    hadTopologyAllowlist: boolean
): { ok: true } | { ok: false; reason: string } {
    const norm = normalizedPhasePlanStableKey(raw)
    if (norm.length === 0) {
        return { ok: false, reason: 'derivedFrom contains an empty token' }
    }
    if (norm === COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY) {
        return { ok: true }
    }
    if (snapshotNorm.has(norm)) {
        return { ok: true }
    }
    if (topologyMatches(topologyLookup, raw)) {
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

function validateVirtualEntity(
    v: unknown,
    snapshotNorm: Set<string>,
    topologyLookup: Set<string> | undefined,
    hadTopologyAllowlist: boolean
): { ok: true; entity: CoyotePhaseVirtualEntity } | { ok: false; reason: string } {
    if (!isPlainObject(v)) {
        return { ok: false, reason: 'virtualEntities entries must be plain objects' }
    }
    const keys = Object.keys(v)
    const keySet = new Set(keys)
    for (const k of keys) {
        if (!VIRTUAL_KEYS.has(k)) {
            return { ok: false, reason: `unexpected key on virtual entity: ${k}` }
        }
    }
    for (const req of VIRTUAL_KEYS) {
        if (!keySet.has(req)) {
            return { ok: false, reason: `virtual entity missing key: ${req}` }
        }
    }
    const label = v.label
    const derivedFrom = v.derivedFrom
    const phaseKind = v.phaseKind
    if (typeof label !== 'string' || label.trim().length === 0) {
        return { ok: false, reason: 'virtual entity label must be a non-empty string' }
    }
    if (!Array.isArray(derivedFrom) || derivedFrom.length === 0) {
        return { ok: false, reason: 'virtual entity derivedFrom must be a non-empty array' }
    }
    if (!derivedFrom.every((item): item is string => typeof item === 'string')) {
        return { ok: false, reason: 'virtual entity derivedFrom must be an array of strings' }
    }
    if (typeof phaseKind !== 'string' || !PHASE_KINDS.has(phaseKind as CoyotePhasePlanPhaseKind)) {
        return { ok: false, reason: 'virtual entity phaseKind must be gathered, synthesized, or deployed' }
    }
    const phaseKindNarrow = phaseKind as CoyotePhasePlanPhaseKind
    for (const token of derivedFrom) {
        const tokRes = validateDerivedFromToken(token, snapshotNorm, topologyLookup, hadTopologyAllowlist)
        if (!tokRes.ok) {
            return tokRes
        }
    }
    const entity: CoyotePhaseVirtualEntity = {
        label: label.trim(),
        derivedFrom: [...derivedFrom],
        phaseKind: phaseKindNarrow,
    }
    return { ok: true, entity }
}

function validatePhase(
    p: unknown,
    snapshotNorm: Set<string>,
    topologyLookup: Set<string> | undefined,
    hadTopologyAllowlist: boolean
): { ok: true; phase: CoyotePhasePlanPhase } | { ok: false; reason: string } {
    if (!isPlainObject(p)) {
        return { ok: false, reason: 'each phases entry must be a plain object' }
    }
    const keys = Object.keys(p)
    const keySet = new Set(keys)
    for (const k of keys) {
        if (!PHASE_KEYS_REQUIRED.has(k) && k !== 'prepVsBeat' && k !== 'trope' && k !== 'tropeBeat') {
            return { ok: false, reason: `unexpected key on phase: ${k}` }
        }
    }
    for (const req of PHASE_KEYS_REQUIRED) {
        if (!keySet.has(req)) {
            return { ok: false, reason: `phase missing key: ${req}` }
        }
    }
    if (!keySet.has('trope')) {
        return { ok: false, reason: 'phase missing key: trope' }
    }
    if (!keySet.has('tropeBeat')) {
        return { ok: false, reason: 'phase missing key: tropeBeat' }
    }
    const trope = p.trope
    const tropeBeat = p.tropeBeat
    const stableKeysUsed = p.stableKeysUsed
    if (typeof trope !== 'string' || !isCoyoteTrope(trope)) {
        return { ok: false, reason: `trope must be one of ${CANONICAL_TROPE_ORDER.join(', ')}` }
    }
    if (typeof tropeBeat !== 'string' || tropeBeat.trim().length === 0) {
        return { ok: false, reason: 'tropeBeat must be a non-empty string' }
    }
    const virtualEntities = p.virtualEntities
    const achievement = p.achievement
    const prepVsBeat = p.prepVsBeat

    if (!Array.isArray(stableKeysUsed)) {
        return { ok: false, reason: 'stableKeysUsed must be an array' }
    }
    if (!stableKeysUsed.every((item): item is string => typeof item === 'string')) {
        return { ok: false, reason: 'stableKeysUsed must be an array of strings' }
    }
    if (!Array.isArray(virtualEntities)) {
        return { ok: false, reason: 'virtualEntities must be an array' }
    }
    if (typeof achievement !== 'string') {
        return { ok: false, reason: 'achievement must be a string' }
    }
    if (prepVsBeat !== undefined) {
        if (typeof prepVsBeat !== 'string' || !PREP_VS_BEAT.has(prepVsBeat as CoyotePhasePrepVsBeat)) {
            return { ok: false, reason: 'prepVsBeat must be prep or creation when present' }
        }
    }

    for (const sk of stableKeysUsed) {
        const norm = normalizedPhasePlanStableKey(sk)
        if (norm.length === 0) {
            return { ok: false, reason: 'stableKeysUsed contains an empty stableKey' }
        }
        if (norm === COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY) {
            return {
                ok: false,
                reason: `reserved virtual grounding stableKey "${COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY}" must not appear in stableKeysUsed`,
            }
        }
        if (!snapshotNorm.has(norm) && !isSyntaxMaterializedAffordanceStableKey(sk)) {
            return {
                ok: false,
                reason: `stableKeysUsed references unknown snapshot stableKey ${JSON.stringify(sk)}`,
            }
        }
    }

    const entitiesOut: CoyotePhaseVirtualEntity[] = []
    for (let i = 0; i < virtualEntities.length; i++) {
        const ve = validateVirtualEntity(virtualEntities[i], snapshotNorm, topologyLookup, hadTopologyAllowlist)
        if (!ve.ok) {
            return { ok: false, reason: `virtualEntities[${i}]: ${ve.reason}` }
        }
        entitiesOut.push(ve.entity)
    }

    const phase: CoyotePhasePlanPhase = {
        trope,
        tropeBeat: tropeBeat.trim(),
        stableKeysUsed: stableKeysUsed.map((s) => normalizedPhasePlanStableKey(s)),
        virtualEntities: entitiesOut,
        achievement,
        ...(prepVsBeat !== undefined ? { prepVsBeat: prepVsBeat as CoyotePhasePrepVsBeat } : {}),
    }

    return { ok: true, phase }
}

/**
 * Validates hop-2 **`phasePlan`** JSON against staged snapshot keys and **`SETTING`** grounding rules.
 *
 * Callers may pass **`allowedTopologyRefTokens`** (e.g. seam labels from **`seamRoomLabelFromEphemeraRoomId`**) so **`derivedFrom`** can cite geography without inventing staged rows.
 */
export function validateCoyotePhasePlan(
    raw: unknown,
    ctx: CoyotePhasePlanValidationContext
): ValidateCoyotePhasePlanResult {
    const snapshotNorm = buildNormalizedSnapshotSet(ctx.snapshotStableKeys)
    const topologyLookup = buildTopologyLookup(ctx.allowedTopologyRefTokens)
    const hadTopologyAllowlist = topologyLookup !== undefined && topologyLookup.size > 0
    if (!isPlainObject(raw)) {
        return { ok: false, reason: 'phasePlan must be a plain object' }
    }
    const rootKeys = Object.keys(raw)
    if (rootKeys.length !== 3 || !rootKeys.every((key) => ROOT_KEYS.has(key))) {
        return { ok: false, reason: 'phasePlan root must contain exactly keys "tropeSequence", "deconflictionSummary", and "phases"' }
    }
    const tropeSequenceRaw = raw.tropeSequence
    const deconflictionSummary = raw.deconflictionSummary
    if (!Array.isArray(tropeSequenceRaw) || tropeSequenceRaw.length === 0) {
        return { ok: false, reason: 'tropeSequence must be a non-empty array' }
    }
    const tropeSequence: CoyoteTrope[] = []
    const seenTropes = new Set<CoyoteTrope>()
    let lastOrderIndex = -1
    for (let ti = 0; ti < tropeSequenceRaw.length; ti++) {
        const trope = tropeSequenceRaw[ti]
        if (typeof trope !== 'string' || !isCoyoteTrope(trope)) {
            return { ok: false, reason: `tropeSequence[${ti}] must be a valid trope` }
        }
        if (seenTropes.has(trope)) {
            return { ok: false, reason: `tropeSequence[${ti}] duplicates trope ${trope}` }
        }
        const orderIndex = CANONICAL_TROPE_INDEX.get(trope)
        if (orderIndex === undefined) {
            return { ok: false, reason: `tropeSequence[${ti}] unknown trope ${trope}` }
        }
        if (orderIndex <= lastOrderIndex) {
            return {
                ok: false,
                reason: `tropeSequence violates canonical order ${CANONICAL_TROPE_ORDER.join(' -> ')}`,
            }
        }
        lastOrderIndex = orderIndex
        seenTropes.add(trope)
        tropeSequence.push(trope)
    }
    if (typeof deconflictionSummary !== 'string' || deconflictionSummary.trim().length === 0) {
        return { ok: false, reason: 'deconflictionSummary must be a non-empty string' }
    }
    const phases = raw.phases
    if (!Array.isArray(phases)) {
        return { ok: false, reason: 'phases must be an array' }
    }
    if (phases.length === 0) {
        return { ok: false, reason: 'phases must be non-empty' }
    }
    if (phases.length !== tropeSequence.length) {
        return { ok: false, reason: 'phases length must match tropeSequence length' }
    }

    const phasesOut: CoyotePhasePlanPhase[] = []
    const maxSettingOnly = ctx.caps?.maxSettingOnlyVirtualsPerPhase

    for (let pi = 0; pi < phases.length; pi++) {
        const phaseRes = validatePhase(phases[pi], snapshotNorm, topologyLookup, hadTopologyAllowlist)
        if (!phaseRes.ok) {
            return { ok: false, reason: `phases[${pi}]: ${phaseRes.reason}` }
        }
        const ph = phaseRes.phase
        if (ph.trope !== tropeSequence[pi]) {
            return {
                ok: false,
                reason: `phases[${pi}].trope must match tropeSequence[${pi}]`,
            }
        }

        if (maxSettingOnly !== undefined) {
            let settingOnlyCount = 0
            for (const ent of ph.virtualEntities) {
                if (!derivedFromReferencesSnapshotKey(ent.derivedFrom, snapshotNorm)) {
                    settingOnlyCount += 1
                }
            }
            if (settingOnlyCount > maxSettingOnly) {
                return {
                    ok: false,
                    reason: `phases[${pi}]: exceeds maxSettingOnlyVirtualsPerPhase (${settingOnlyCount} > ${maxSettingOnly})`,
                }
            }
        }

        phasesOut.push(ph)
    }

    return {
        ok: true,
        phasePlan: {
            tropeSequence,
            deconflictionSummary: deconflictionSummary.trim(),
            phases: phasesOut,
        },
    }
}
