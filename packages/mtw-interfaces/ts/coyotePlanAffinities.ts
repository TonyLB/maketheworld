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
    description: string;
    affinities: CoyoteAffinityPossibility[];
}

export type AcmeOrderEnrichModelResponse = {
    lines: AcmeOrderEnrichModelLine[];
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

export function isAcmeOrderEnrichModelLine(entry: unknown): entry is AcmeOrderEnrichModelLine {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return false
    }
    const o = entry as Record<string, unknown>
    if (typeof o.name !== 'string' || typeof o.description !== 'string') {
        return false
    }
    if (!Array.isArray(o.affinities)) {
        return false
    }
    if (o.affinities.length > ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE) {
        return false
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
    return o.lines.every((line) => isAcmeOrderEnrichModelLine(line))
}
