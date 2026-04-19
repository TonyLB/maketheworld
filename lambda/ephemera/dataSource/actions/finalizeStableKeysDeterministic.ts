/**
 * Post-LLM deterministic **`stableKey`** enforcement for Acme orders.
 *
 * Contract: task plan **Disambiguation phases**, **Deterministic numeric repair**,
 * **Charset and normalization**, **`constructed-`** reservation in
 * `taskPlanning/.../AGENT.acmeObject-stableKey.plan.md`.
 *
 * **Occupancy:** Callers build **`coyoteOccupiedStableKeys`** from existing staged objects only;
 * legacy **`Meta::Room.objects`** rows without **`stableKey`** must not contribute keys to that set.
 */
import {
    defaultStableKeyProposal,
    normalizeStableKeyCharset,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

export type StableKeyFinalizeLineInput = {
    /** Display/catalog name for empty fallback (aligned with Step B **`name`**). */
    name: string;
    /** LLM proposal after Step B; omit or empty to derive from **`name`**. */
    proposedStableKey?: string;
};

const CONSTRUCTED_PREFIX = 'constructed-'

function remapConstructedPrefix(key: string): string {
    if (key.startsWith(CONSTRUCTED_PREFIX)) {
        return `acme-${key.slice(CONSTRUCTED_PREFIX.length)}`
    }
    return key
}

/** Strips maximal trailing ASCII digit run; result may be **''** if **`candidate`** is all digits. */
function stripMaximalTrailingDigits(candidate: string): string {
    let end = candidate.length
    while (end > 0 && candidate[end - 1] >= '0' && candidate[end - 1] <= '9') {
        end -= 1
    }
    return candidate.slice(0, end)
}

function normalizedCandidateBeforeUniqueness(line: StableKeyFinalizeLineInput): string {
    const raw = line.proposedStableKey?.trim() ?? ''
    let key = raw.length === 0
        ? defaultStableKeyProposal(line.name)
        : normalizeStableKeyCharset(raw)
    if (key.length === 0) {
        key = defaultStableKeyProposal(line.name)
    }
    key = remapConstructedPrefix(key)
    if (key.startsWith(CONSTRUCTED_PREFIX)) {
        key = remapConstructedPrefix(key)
    }
    if (key.length === 0) {
        key = defaultStableKeyProposal(line.name)
    }
    return key
}

function firstFreeNumericSuffix(base: string, working: ReadonlySet<string>): string {
    for (let n = 1; ; n += 1) {
        const candidate = `${base}${n}`
        if (!working.has(candidate)) {
            return candidate
        }
    }
}

function assignUnique(
    candidate: string,
    working: Set<string>,
    nameForEmptyBase: string
): string {
    if (!working.has(candidate)) {
        working.add(candidate)
        return candidate
    }
    let base = stripMaximalTrailingDigits(candidate)
    if (base.length === 0) {
        base = defaultStableKeyProposal(nameForEmptyBase)
    }
    const assigned = firstFreeNumericSuffix(base, working)
    working.add(assigned)
    return assigned
}

/**
 * Returns one final **`stableKey`** per input line, in order.
 * Mutates a copy of occupancy: **`occupied`** ∪ keys assigned earlier in this batch.
 */
export function finalizeStableKeysDeterministic(
    lines: readonly StableKeyFinalizeLineInput[],
    coyoteOccupiedStableKeys: ReadonlySet<string>
): readonly string[] {
    const working = new Set<string>(coyoteOccupiedStableKeys)
    const out: string[] = []
    for (const line of lines) {
        const normalized = normalizedCandidateBeforeUniqueness(line)
        out.push(assignUnique(normalized, working, line.name))
    }
    return out
}
