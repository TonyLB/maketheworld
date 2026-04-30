//
// Coyote demo: plan-role affinities on staged objects (Acme enrich output + Meta::Room.objects).
// Vocabulary includes structural roles, generative roles (`prep`, `creation`), and
// flat modification-intent tags (`influence-road-runner`, `alter-road-runner`,
// `coyote-equipment`, `coyote-enhancement`, `setting-addition`, `connect-props`,
// `enhance-prop`).
//

/** Max line items in a single Acme enrich model response (prompt guardrail). */
export const ACME_ORDER_ENRICH_MAX_LINES = 50

/** Max affinity entries per object line (prompt guardrail). */
export const ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE = 20

/** Omit affinity possibilities strictly below this aptness (entries with aptness equal to this value are kept). */
export const COYOTE_AFFINITY_APTNESS_MIN = 0.2
const ACME_ENRICH_NORMALIZATION_DEBUG = false

export type CoyoteStructuralRole = 'terminal' | 'trigger' | 'delivery' | 'autonomous_agent'
export type CoyoteGenerativeRole = 'prep' | 'creation'
export type CoyoteModificationRole =
    | 'influence-road-runner'
    | 'alter-road-runner'
    | 'coyote-equipment'
    | 'coyote-enhancement'
    | 'setting-addition'
    | 'connect-props'
    | 'enhance-prop'

/** Acme order enrich catalog rejection (aligned with parse command apology copy). */
export type AcmeCatalogRejectionReason = 'Not a thing' | 'Not tangible' | 'Too large'

const structuralRoles: ReadonlySet<CoyoteStructuralRole> = new Set([
    'terminal',
    'trigger',
    'delivery',
    'autonomous_agent',
])

const modificationRoles: ReadonlySet<CoyoteModificationRole> = new Set([
    'influence-road-runner',
    'alter-road-runner',
    'coyote-equipment',
    'coyote-enhancement',
    'setting-addition',
    'connect-props',
    'enhance-prop',
])

export type CoyoteAffinityPossibility =
    | {
          role: CoyoteModificationRole;
          aptness: number;
      }
    | {
        role: CoyoteStructuralRole;
        aptness: number;
      }
    | {
        role: CoyoteGenerativeRole;
        aptness: number;
      }

export type CoyoteTrope = 'Contraption' | 'Distraction' | 'Disadvantage' | 'Finishing Move'

export type CoyoteTropeAptness = 'High' | 'Good' | 'Poor'

export type CoyoteTropeAffinity = {
    trope: CoyoteTrope;
    aptness: CoyoteTropeAptness;
    narrowing: string;
    environmentAffordances?: string[];
}

/** Stage-one intendedRole echo: same roles as **[`CoyoteAffinityPossibility`]**, but **`aptness`** may be omitted (resolved against snapshot rows). */
export type CoyoteAffinityPossibilityEcho =
    | {
          role: CoyoteModificationRole;
          aptness?: number;
      }
    | {
          role: CoyoteStructuralRole;
          aptness?: number;
      }
    | {
          role: CoyoteGenerativeRole;
          aptness?: number;
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
          /** Machine correlation key proposal (`a-z` / `0-9` / `-`); deterministic repair may adjust. */
          stableKey: string;
          tropeAffinities?: CoyoteTropeAffinity[];
          tropeAffinitiesFailed?: boolean;
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
    /** Optional aggregate Acme order enrich confidence in **`[0, 1]`**. */
    confidence?: number;
}

function isFiniteAptness(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1
}

function hasLegacyTupleKeys(o: Record<string, unknown>): boolean {
    return Object.prototype.hasOwnProperty.call(o, 'target')
        || Object.prototype.hasOwnProperty.call(o, 'mode')
}

export function isCoyoteModificationRole(value: unknown): value is CoyoteModificationRole {
    return typeof value === 'string' && modificationRoles.has(value as CoyoteModificationRole)
}

export function isCoyoteStructuralRole(value: unknown): value is CoyoteStructuralRole {
    return typeof value === 'string' && structuralRoles.has(value as CoyoteStructuralRole)
}

export function isCoyoteGenerativeRole(value: unknown): value is CoyoteGenerativeRole {
    return value === 'prep' || value === 'creation'
}

export function isCoyoteTrope(value: unknown): value is CoyoteTrope {
    return (
        value === 'Contraption'
        || value === 'Distraction'
        || value === 'Disadvantage'
        || value === 'Finishing Move'
    )
}

export function isCoyoteTropeAptness(value: unknown): value is CoyoteTropeAptness {
    return value === 'High' || value === 'Good' || value === 'Poor'
}

export function isCoyoteTropeAffinity(entry: unknown): entry is CoyoteTropeAffinity {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return false
    }
    const o = entry as Record<string, unknown>
    const validEnvironmentAffordances = (
        !('environmentAffordances' in o)
        || (Array.isArray(o.environmentAffordances) && o.environmentAffordances.every((entry) => typeof entry === 'string'))
    )
    const hasLegacyAffordancesKey = 'affordances' in o
    return (
        isCoyoteTrope(o.trope)
        && isCoyoteTropeAptness(o.aptness)
        && typeof o.narrowing === 'string'
        && o.narrowing.trim().length > 0
        && validEnvironmentAffordances
        && !hasLegacyAffordancesKey
    )
}

export function isCoyoteAffinityPossibility(entry: unknown): entry is CoyoteAffinityPossibility {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return false
    }
    const o = entry as Record<string, unknown>
    const role = o.role
    if (isCoyoteModificationRole(role)) {
        return !hasLegacyTupleKeys(o) && isFiniteAptness(o.aptness)
    }
    if (isCoyoteStructuralRole(role)) {
        return isFiniteAptness(o.aptness)
    }
    if (isCoyoteGenerativeRole(role)) {
        return isFiniteAptness(o.aptness)
    }
    return false
}

/** **`true`** for a full persisted row, or for an echo that omits **`aptness`** (optional decimals when present). */
export function isCoyoteAffinityPossibilityEcho(entry: unknown): entry is CoyoteAffinityPossibilityEcho {
    if (isCoyoteAffinityPossibility(entry)) {
        return true
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return false
    }
    const o = entry as Record<string, unknown>
    const role = o.role
    if (isCoyoteModificationRole(role)) {
        return !hasLegacyTupleKeys(o) && (o.aptness === undefined || isFiniteAptness(o.aptness))
    }
    if (isCoyoteStructuralRole(role)) {
        return o.aptness === undefined || isFiniteAptness(o.aptness)
    }
    if (isCoyoteGenerativeRole(role)) {
        return o.aptness === undefined || isFiniteAptness(o.aptness)
    }
    return false
}

export function isAcmeCatalogRejectionReason(value: unknown): value is AcmeCatalogRejectionReason {
    return value === 'Not a thing' || value === 'Not tangible' || value === 'Too large'
}

function isFiniteUnitConfidence(n: unknown): boolean {
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1
}

/**
 * Normalized **`stableKey`** reserved for Coyote phase-plan **virtual grounding** (human-facing label **`SETTING`**).
 * Acme deterministic finalization must not assign this key to staged **`Meta::Room.objects`**; use **`acme-setting`** (or suffixed variants) instead.
 *
 * @see task planning **Decided: reserved stable key SETTING (virtual grounding)** under **`lambda/ephemera/dataSource/coyoteGame/`**.
 */
export const COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY = 'setting' as const

/**
 * Charset normalization for **`stableKey`**: lowercase **`a-z`**, **`0-9`**, **`-`** only;
 * whitespace and punctuation folded to hyphens (see task plan **Charset and normalization**).
 */
export function normalizeStableKeyCharset(raw: string): string {
    const folded = raw.trim().toLowerCase()
    const withHyphens = folded.replace(/\s+/g, '-').replace(/[^a-z0-9-]+/g, '-')
    return withHyphens.replace(/-+/g, '-').replace(/^-|-$/g, '')
}

/** Fallback **`stableKey`** when the model omits or supplies an empty string (deterministic repair may still adjust). */
export function defaultStableKeyProposal(name: string): string {
    const collapsed = normalizeStableKeyCharset(name)
    return collapsed.length > 0 ? collapsed : 'line'
}

function stableKeyFromRawLine(o: Record<string, unknown>, nameForFallback: string): string {
    if (typeof o.stableKey === 'string') {
        const t = o.stableKey.trim()
        if (t.length > 0) {
            return t
        }
    }
    return defaultStableKeyProposal(nameForFallback)
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
    const nameTrim = o.name.trim() || 'unknown'
    const stableKey = stableKeyFromRawLine(o, nameTrim)
    if (o.affinitiesFailed === true) {
        const coerced: AcmeOrderEnrichModelLine = {
            valid: true,
            name: nameTrim,
            stableKey,
            tropeAffinities: [],
            tropeAffinitiesFailed: true,
            affinities: [],
            affinitiesFailed: true,
        }
        return isAcmeOrderEnrichModelLine(coerced) ? coerced : null
    }
    if ('affinities' in o && !Array.isArray(o.affinities)) {
        return null
    }
    const affinitiesSource = Array.isArray(o.affinities) ? o.affinities : []
    const filtered = affinitiesSource.filter((x) => isCoyoteAffinityPossibility(x))
    if (filtered.length > ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE) {
        return null
    }
    const candidate: AcmeOrderEnrichModelLine = {
        valid: true,
        name: nameTrim,
        stableKey,
        tropeAffinities: Array.isArray(o.tropeAffinities)
            ? o.tropeAffinities.filter((x) => isCoyoteTropeAffinity(x)).slice(0, 3)
            : [],
        tropeAffinitiesFailed: o.tropeAffinitiesFailed === true
            || !Array.isArray(o.tropeAffinities),
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
        stableKey: defaultStableKeyProposal(name),
        tropeAffinities: [],
        tropeAffinitiesFailed: true,
        affinities: [],
        affinitiesFailed: true,
    }
}

function trimStableKeyOrFallback(stableKey: string, name: string): string {
    const t = stableKey.trim()
    return t.length > 0 ? t : defaultStableKeyProposal(name)
}

function normalizeTropeFields(raw: {
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
}, context?: {
    fallbackName?: string;
    lineName?: string;
    sourceKind?: 'valid_line' | 'affinities_failed_line' | 'salvaged_line' | 'synthetic_line';
}): { tropeAffinities: CoyoteTropeAffinity[]; tropeAffinitiesFailed: boolean } {
    const tropeAffinities = Array.isArray(raw.tropeAffinities) ? raw.tropeAffinities.slice(0, 3) : []
    const tropeAffinitiesFailed = raw.tropeAffinitiesFailed === true || tropeAffinities.length === 0
    const output = {
        tropeAffinities: tropeAffinitiesFailed ? [] : tropeAffinities,
        tropeAffinitiesFailed,
    }
    if (ACME_ENRICH_NORMALIZATION_DEBUG && output.tropeAffinitiesFailed) {
        console.log('[mtw.interfaces.acmeEnrich.normalize] trope_affinities_failed', {
            sourceKind: context?.sourceKind ?? 'valid_line',
            fallbackName: context?.fallbackName,
            lineName: context?.lineName,
            hadTropeAffinitiesField: Array.isArray(raw.tropeAffinities),
            rawTropeAffinitiesLength: Array.isArray(raw.tropeAffinities) ? raw.tropeAffinities.length : undefined,
            rawTropeAffinitiesFailed: raw.tropeAffinitiesFailed,
            outputTropeAffinitiesLength: output.tropeAffinities.length,
            outputTropeAffinitiesFailed: output.tropeAffinitiesFailed,
            reason: raw.tropeAffinitiesFailed === true
                ? 'input_marked_failed'
                : 'missing_or_empty_trope_affinities',
        })
    }
    return output
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
                stableKey: trimStableKeyOrFallback(raw.stableKey, raw.name),
                ...normalizeTropeFields(raw, {
                    fallbackName,
                    lineName: raw.name,
                    sourceKind: 'affinities_failed_line',
                }),
                affinities: [],
                affinitiesFailed: true,
            }
        }
        const normalizedTrope = normalizeTropeFields(raw, {
            fallbackName,
            lineName: raw.name,
            sourceKind: 'valid_line',
        })
        return {
            valid: true,
            name: raw.name,
            stableKey: trimStableKeyOrFallback(raw.stableKey, raw.name),
            ...normalizedTrope,
            affinities: applyCoyoteAffinityAptnessFloor(raw.affinities ?? []),
        }
    }
    const salvaged = salvageAcmeOrderEnrichLine(raw)
    if (salvaged !== null) {
        return salvaged
    }
    return syntheticAcmeOrderEnrichFailureLine(raw, fallbackName)
}

export type NormalizeAcmeOrderEnrichOptions = {
    /** When **`lines`** is missing or empty after parse, emit one synthetic failure row with this **`name`**. */
    emptyFallbackName?: string;
};

/**
 * Normalizes Acme order enrich JSON: optional root **`confidence`**, **`lines`** capped at **`ACME_ORDER_ENRICH_MAX_LINES`**.
 * Empty **`lines`** becomes a single **`affinitiesFailed`** row (see **`emptyFallbackName`**).
 */
export function normalizeAcmeOrderEnrichResponse(
    parsed: unknown,
    options?: NormalizeAcmeOrderEnrichOptions
): AcmeOrderEnrichModelResponse {
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

    const emptyName = options?.emptyFallbackName ?? 'order'
    const outLines: AcmeOrderEnrichModelLine[] = rawLines.length > 0
        ? rawLines.map((raw, i) => normalizeAcmeOrderEnrichLine(raw, `line${i + 1}`))
        : [{
            valid: true,
            name: emptyName,
            stableKey: defaultStableKeyProposal(emptyName),
            tropeAffinities: [],
            tropeAffinitiesFailed: true,
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
        const aff = o.affinities
        const affEmpty = aff === undefined || (Array.isArray(aff) && aff.length === 0)
        return isAcmeCatalogRejectionReason(o.errorType) && affEmpty
    }
    if (typeof o.stableKey !== 'string' || o.stableKey.trim().length === 0) {
        return false
    }
    if ('tropeAffinities' in o) {
        if (!Array.isArray(o.tropeAffinities)) {
            return false
        }
        if (o.tropeAffinities.length > 3) {
            return false
        }
        if (!o.tropeAffinities.every((x) => isCoyoteTropeAffinity(x))) {
            return false
        }
    }
    if ('tropeAffinitiesFailed' in o && typeof o.tropeAffinitiesFailed !== 'boolean') {
        return false
    }
    if (o.tropeAffinitiesFailed === true && Array.isArray(o.tropeAffinities) && o.tropeAffinities.length !== 0) {
        return false
    }
    if (o.affinities !== undefined && !Array.isArray(o.affinities)) {
        return false
    }
    const affinities = Array.isArray(o.affinities) ? o.affinities : []
    if (affinities.length > ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE) {
        return false
    }
    if (o.affinitiesFailed === true) {
        return affinities.length === 0
    }
    return affinities.every((x) => isCoyoteAffinityPossibility(x))
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
