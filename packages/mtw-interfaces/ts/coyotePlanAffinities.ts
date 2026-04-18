//
// Coyote demo: plan-role affinities on staged objects (Acme enrich output + Meta::Room.objects).
//

/** Max line items in a single Acme enrich model response (prompt guardrail). */
export const ACME_ORDER_ENRICH_MAX_LINES = 50

/** Max affinity entries per object line (prompt guardrail). */
export const ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE = 20

export type CoyoteAffinityTarget = 'coyote' | 'road_runner' | 'environment'

export type CoyoteAffinityMode = 'direct' | 'constructive'

export type CoyoteStructuralRole = 'terminal' | 'trigger' | 'delivery' | 'autonomous_agent'

const structuralRoles: ReadonlySet<CoyoteStructuralRole> = new Set([
    'terminal',
    'trigger',
    'delivery',
    'autonomous_agent',
])

const affinityTargets: ReadonlySet<CoyoteAffinityTarget> = new Set([
    'coyote',
    'road_runner',
    'environment',
])

const affinityModes: ReadonlySet<CoyoteAffinityMode> = new Set(['direct', 'constructive'])

export type CoyoteAffinityPossibility =
    | {
          role: 'entity_modification';
          target: CoyoteAffinityTarget;
          mode: CoyoteAffinityMode;
          aptness: number;
      }
    | {
          role: CoyoteStructuralRole;
          aptness: number;
      }

export type AcmeOrderEnrichModelLine = {
    name: string;
    /** Catalog copy; use **`""`** when **`affinitiesFailed`** (no copy produced). */
    description: string;
    /** Role possibilities; use **`[]`** when none apply or when **`affinitiesFailed`**. */
    affinities: CoyoteAffinityPossibility[];
    /** When **`true`**, **`description`** must be **`""`** and **`affinities`** must be **`[]`**. */
    affinitiesFailed?: boolean;
}

export type AcmeOrderEnrichModelResponse = {
    lines: AcmeOrderEnrichModelLine[];
    /** Optional aggregate Step B confidence in **`[0, 1]`**. */
    confidence?: number;
}

function isFiniteAptness(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1
}

export function isCoyoteAffinityTarget(value: unknown): value is CoyoteAffinityTarget {
    return typeof value === 'string' && affinityTargets.has(value as CoyoteAffinityTarget)
}

export function isCoyoteAffinityMode(value: unknown): value is CoyoteAffinityMode {
    return typeof value === 'string' && affinityModes.has(value as CoyoteAffinityMode)
}

export function isCoyoteStructuralRole(value: unknown): value is CoyoteStructuralRole {
    return typeof value === 'string' && structuralRoles.has(value as CoyoteStructuralRole)
}

export function isCoyoteAffinityPossibility(entry: unknown): entry is CoyoteAffinityPossibility {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return false
    }
    const o = entry as Record<string, unknown>
    const role = o.role
    if (role === 'entity_modification') {
        return (
            isCoyoteAffinityTarget(o.target)
            && isCoyoteAffinityMode(o.mode)
            && isFiniteAptness(o.aptness)
        )
    }
    if (isCoyoteStructuralRole(role)) {
        return isFiniteAptness(o.aptness)
    }
    return false
}

function isFiniteUnitConfidence(n: unknown): boolean {
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1
}

function salvageAcmeOrderEnrichLine(raw: unknown): AcmeOrderEnrichModelLine | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null
    }
    const o = raw as Record<string, unknown>
    if (typeof o.name !== 'string') {
        return null
    }
    if (o.affinitiesFailed === true) {
        const coerced: AcmeOrderEnrichModelLine = {
            name: o.name,
            description: '',
            affinities: [],
            affinitiesFailed: true,
        }
        return isAcmeOrderEnrichModelLine(coerced) ? coerced : null
    }
    const description = typeof o.description === 'string' ? o.description : ''
    if (!Array.isArray(o.affinities)) {
        return null
    }
    const filtered = o.affinities.filter((x) => isCoyoteAffinityPossibility(x))
    if (filtered.length > ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE) {
        return null
    }
    const candidate: AcmeOrderEnrichModelLine = {
        name: o.name,
        description,
        affinities: filtered,
    }
    return isAcmeOrderEnrichModelLine(candidate) ? candidate : null
}

function syntheticAcmeOrderEnrichFailureLine(raw: unknown, fallbackName: string): AcmeOrderEnrichModelLine {
    let name = fallbackName
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const n = (raw as Record<string, unknown>).name
        if (typeof n === 'string' && n.trim().length > 0) {
            name = n.trim()
        }
    }
    return {
        name,
        description: '',
        affinities: [],
        affinitiesFailed: true,
    }
}

/**
 * Maps one raw **`lines[i]`** entry to a canonical **`AcmeOrderEnrichModelLine`**: validate, salvage common LLM mistakes, or synthesize **`affinitiesFailed`**.
 */
export function normalizeAcmeOrderEnrichLine(raw: unknown, fallbackName: string): AcmeOrderEnrichModelLine {
    if (isAcmeOrderEnrichModelLine(raw)) {
        return raw
    }
    const salvaged = salvageAcmeOrderEnrichLine(raw)
    if (salvaged !== null) {
        return salvaged
    }
    return syntheticAcmeOrderEnrichFailureLine(raw, fallbackName)
}

/**
 * Builds a full enrich response with **`slotCount`** lines aligned to Step A valid rows. Root **`confidence`** is kept only when valid; invalid values are omitted. **`lines`** values may be partial or invalid per index.
 */
export function normalizeAcmeOrderEnrichResponse(
    parsed: unknown,
    slotCount: number,
    fallbackNames: readonly string[]
): AcmeOrderEnrichModelResponse {
    if (fallbackNames.length !== slotCount) {
        throw new Error('normalizeAcmeOrderEnrichResponse: fallbackNames length must equal slotCount')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('normalizeAcmeOrderEnrichResponse: parsed must be a plain object')
    }
    const root = parsed as Record<string, unknown>

    let confidence: number | undefined
    if ('confidence' in root && isFiniteUnitConfidence(root.confidence)) {
        confidence = root.confidence as number
    }

    let rawLines: unknown[]
    if (Array.isArray(root.lines)) {
        rawLines = root.lines.slice(0, ACME_ORDER_ENRICH_MAX_LINES)
    } else {
        rawLines = []
    }

    const outLines: AcmeOrderEnrichModelLine[] = []
    for (let i = 0; i < slotCount; i += 1) {
        outLines.push(normalizeAcmeOrderEnrichLine(rawLines[i], fallbackNames[i]))
    }

    const result: AcmeOrderEnrichModelResponse = { lines: outLines }
    if (confidence !== undefined) {
        result.confidence = confidence
    }
    return result
}

export function isAcmeOrderEnrichModelLine(entry: unknown): entry is AcmeOrderEnrichModelLine {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return false
    }
    const o = entry as Record<string, unknown>
    if (typeof o.name !== 'string') {
        return false
    }
    if (typeof o.description !== 'string') {
        return false
    }
    if (!Array.isArray(o.affinities)) {
        return false
    }
    if (o.affinities.length > ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE) {
        return false
    }
    if (o.affinitiesFailed === true) {
        return o.description === '' && o.affinities.length === 0
    }
    return o.affinities.every((x) => isCoyoteAffinityPossibility(x))
}

export function isAcmeOrderEnrichModelResponse(body: unknown): body is AcmeOrderEnrichModelResponse {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return false
    }
    const o = body as Record<string, unknown>
    if (!Array.isArray(o.lines)) {
        return false
    }
    if (o.lines.length > ACME_ORDER_ENRICH_MAX_LINES) {
        return false
    }
    if ('confidence' in o && !isFiniteUnitConfidence(o.confidence)) {
        return false
    }
    return o.lines.every((line) => isAcmeOrderEnrichModelLine(line))
}
