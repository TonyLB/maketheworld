/**
 * Outbound stream payloads for mtw.ephemera.coyoteGame (bus-only DataSource).
 */
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { isRenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { isEphemeraCharacterId, type EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

/**
 * Intermediate signal: LLM hypothesis work has begun. Pair with
 * {@link HypothesisGenerationResultPublishedPayload} via {@link hypothesisId}.
 */
export type HypothesisGenerationStartedPublishedPayload = {
    type: 'Hypothesis Generation Started';
    hypothesisId: string;
    characterId: EphemeraCharacterId;
}

/**
 * Terminal signal: hypothesis text is ready for delivery (e.g. perception / WorldMessage fan-in).
 */
export type HypothesisGenerationResultPublishedPayload = {
    type: 'Hypothesis Generation Result';
    hypothesisId: string;
    characterId: EphemeraCharacterId;
    renderTree: RenderTree;
}

export type CoyoteGamePublishedPayload =
    | HypothesisGenerationStartedPublishedPayload
    | HypothesisGenerationResultPublishedPayload

export const isHypothesisGenerationStartedPublishedPayload = (
    value: unknown
): value is HypothesisGenerationStartedPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Hypothesis Generation Started') {
        return false
    }
    if (typeof v.hypothesisId !== 'string' || v.hypothesisId.length === 0) {
        return false
    }
    if (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId)) {
        return false
    }
    return true
}

export const isHypothesisGenerationResultPublishedPayload = (
    value: unknown
): value is HypothesisGenerationResultPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Hypothesis Generation Result') {
        return false
    }
    if (typeof v.hypothesisId !== 'string' || v.hypothesisId.length === 0) {
        return false
    }
    if (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId)) {
        return false
    }
    if (!isRenderTree(v.renderTree)) {
        return false
    }
    return true
}
