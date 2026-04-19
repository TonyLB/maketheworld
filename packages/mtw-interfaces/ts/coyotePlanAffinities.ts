//
// Coyote demo: plan-role affinities on staged objects (Acme enrich output + Meta::Room.objects).
//

/** Max line items in a single Acme enrich model response (prompt guardrail). */
export const ACME_ORDER_ENRICH_MAX_LINES = 50

/** Max affinity entries per object line (prompt guardrail). */
export const ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE = 20

/** Omit affinity possibilities strictly below this aptness (entries with aptness equal to this value are kept). */
export const COYOTE_AFFINITY_APTNESS_MIN = 0.2

export type CoyoteAffinityTarget = 'coyote' | 'road_runner' | 'environment'

export type CoyoteAffinityMode = 'direct' | 'constructive'

export type CoyoteStructuralRole = 'terminal' | 'trigger' | 'delivery' | 'autonomous_agent'

/** Step B catalog rejection (aligned with parse command apology copy). */
export type AcmeCatalogRejectionReason = 'Not a thing' | 'Not tangible' | 'Too large'

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

function applyCoyoteAffinityAptnessFloor(
    affinities: CoyoteAffinityPossibility[]
): CoyoteAffinityPossibility[] {
    const kept = affinities.filter((a) => a.aptness >= COYOTE_AFFINITY_APTNESS_MIN)
    kept.sort((a, b) => b.aptness - a.aptness)
    return kept
}

export type AcmeOrderEnrichModelLine =
    | {
          valid: true;
          name: string;
          affinities: CoyoteAffinityPossibility[];
          affinitiesFailed?: boolean;
      }
    | {
          valid: false;
          name: string;
          errorType: AcmeCatalogRejectionReason;
          affinities: [];
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

export function isAcmeCatalogRejectionReason(value: unknown): value is AcmeCatalogRejectionReason {
    return value === 'Not a thing' || value === 'Not tangible' || value === 'Too large'
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
    if (o.valid === false) {
        const errorType = isAcmeCatalogRejectionReason(o.errorType) ? o.errorType : 'Not a thing'
        const candidate: AcmeOrderEnrichModelLine = {
            valid: false,
            name: o.name.trim() || 'unknown',
            errorType,
            affinities: [],
        }
        return isAcmeOrderEnrichModelLine(candidate) ? candidate : null
    }
    if (o.affinitiesFailed === true) {
        const coerced: AcmeOrderEnrichModelLine = {
            valid: true,
            name: o.name.trim() || 'unknown',
            affinities: [],
            affinitiesFailed: true,
        }
        return isAcmeOrderEnrichModelLine(coerced) ? coerced : null
    }
    if (!Array.isArray(o.affinities)) {
        return null
    }
    const filtered = o.affinities.filter((x) => isCoyoteAffinityPossibility(x))
    if (filtered.length > ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE) {
        return null
    }
    const candidate: AcmeOrderEnrichModelLine = {
        valid: true,
        name: o.name.trim() || 'unknown',
        affinities: applyCoyoteAffinityAptnessFloor(filtered),
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
        valid: true,
        name,
        affinities: [],
        affinitiesFailed: true,
    }
}

/**
 * Maps one raw **`lines[i]`** entry to a canonical **`AcmeOrderEnrichModelLine`**: validate, salvage common LLM mistakes, or synthesize **`affinitiesFailed`**.
 */
export function normalizeAcmeOrderEnrichLine(raw: unknown, fallbackName: string): AcmeOrderEnrichModelLine {
    if (isAcmeOrderEnrichModelLine(raw)) {
        if (raw.valid === false) {
            return {
                valid: false,
                name: raw.name,
                errorType: raw.errorType,
                affinities: [],
            }
        }
        if (raw.affinitiesFailed === true) {
            return {
                valid: true,
                name: raw.name,
                affinities: [],
                affinitiesFailed: true,
            }
        }
        return {
            valid: true,
            name: raw.name,
            affinities: applyCoyoteAffinityAptnessFloor(raw.affinities),
        }
    }
    const salvaged = salvageAcmeOrderEnrichLine(raw)
    if (salvaged !== null) {
        return salvaged
    }
    return syntheticAcmeOrderEnrichFailureLine(raw, fallbackName)
}

export type NormalizeAcmeOrderStepBOptions = {
    /** When **`lines`** is missing or empty after parse, emit one synthetic failure row with this **`name`**. */
    emptyFallbackName?: string;
};

/**
 * Normalizes Step B JSON: optional root **`confidence`**, **`lines`** capped at **`ACME_ORDER_ENRICH_MAX_LINES`**.
 * Empty **`lines`** becomes a single **`affinitiesFailed`** row (see **`emptyFallbackName`**).
 */
export function normalizeAcmeOrderStepBResponse(
    parsed: unknown,
    options?: NormalizeAcmeOrderStepBOptions
): AcmeOrderEnrichModelResponse {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('normalizeAcmeOrderStepBResponse: parsed must be a plain object')
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

    const emptyName = options?.emptyFallbackName ?? 'order'
    const outLines: AcmeOrderEnrichModelLine[] = rawLines.length > 0
        ? rawLines.map((raw, i) => normalizeAcmeOrderEnrichLine(raw, `line${i + 1}`))
        : [{
            valid: true,
            name: emptyName,
            affinities: [],
            affinitiesFailed: true,
        }]

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
    if (o.valid === false) {
        return (
            isAcmeCatalogRejectionReason(o.errorType)
            && Array.isArray(o.affinities)
            && o.affinities.length === 0
        )
    }
    if (!Array.isArray(o.affinities)) {
        return false
    }
    if (o.affinities.length > ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE) {
        return false
    }
    if (o.affinitiesFailed === true) {
        return o.affinities.length === 0
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
