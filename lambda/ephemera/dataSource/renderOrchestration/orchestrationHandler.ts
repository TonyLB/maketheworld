/**
 * Render orchestration handler: {@link findRender} after {@link intakeRenderRequested} (see `./requestIntake.ts`).
 * Outcomes are published on **`mtw.ephemera.renderOrchestration`** via `streamEvent` only (no conversation / legacy bus).
 *
 * {@link orchestrateRenderRequest} is the unified entry for passive single-item orchestration.
 *
 * Lives under `dataSource/renderOrchestration/` so ingress, intake, and orchestration (`findRender`, `generateRoomPreview`, …)
 * stay co-located with planning docs (`AGENT.planning.md`, etc.) in this directory.
 */
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { perspectiveMatches, computePerspectiveKey as defaultComputePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { RenderRequested } from '../../messageBus/baseClasses'
import { isEphemeraCacheDynamoItem, type EphemeraCacheComponentId, type EphemeraCacheDynamoItem, type EphemeraCacheMarkState } from '../renderCache/baseClasses'
import { markStatesEqual } from '../renderCache/utils/markState'
import { isRenderResolveInputSuccess } from './baseClasses'
import { getIntakeOrchestrationErrorIfAny } from './intakeErrors'
import { buildOrchestrationRouting } from './orchestrationRouting'
import {
    publishRenderOrchestrationStreamEvent,
    type RenderOrchestrationPublishedPayload,
} from './publishedEvents'
import { findRender } from './findRender'
import { generateRoomPreview } from './generateRoomPreview'
import type { RunWithSingleFlight } from './singleFlightRenderGeneration'
import { intakeRenderRequested } from './requestIntake'
import type { RequestIntakeDependencies } from './requestIntake'
import { clearPerspectivePointer as clearCatalogPerspectivePointer } from '../renderCache/perspectivePointer'
import { ensureAuthoredCatalog } from '../renderCache/ensureAuthoredCatalog'
import internalCache from '../../internalCache'

export type OrchestrationHandlerDependencies = {
    getCacheRecordById?: (componentId: EphemeraCacheComponentId, cacheId: EphemeraCacheId) => Promise<EphemeraCacheDynamoItem | undefined>;
    getExactMatch?: (input: {
        componentId: EphemeraCacheComponentId;
        proposedMarkState: EphemeraCacheMarkState;
        perspective: Perspective;
    }) => Promise<EphemeraCacheDynamoItem | null>;
    clearPerspectivePointer?: (componentId: EphemeraCacheComponentId, perspectiveKey: string) => Promise<void>;
    computePerspectiveKey?: typeof defaultComputePerspectiveKey;
    markStatesEqual?: typeof markStatesEqual;
    /** Override for tests; default is {@link generateRoomPreview}. */
    generateRoomPreview?: typeof generateRoomPreview;
    /** Tests: {@link passThroughSingleFlight} from `./singleFlightRenderGeneration`; omit in production. */
    runWithSingleFlight?: RunWithSingleFlight;
    /** Tests: override hydrate preflight; default is {@link ensureAuthoredCatalog}. */
    ensureAuthoredCatalog?: typeof ensureAuthoredCatalog;
};

export type OrchestrationPipelineDependencies = RequestIntakeDependencies & OrchestrationHandlerDependencies

type OrchestrationHandlerDepsResolved = {
    getCacheRecordById: NonNullable<OrchestrationHandlerDependencies['getCacheRecordById']>;
    getExactMatch: NonNullable<OrchestrationHandlerDependencies['getExactMatch']>;
    clearPerspectivePointer: NonNullable<OrchestrationHandlerDependencies['clearPerspectivePointer']>;
    computePerspectiveKey: NonNullable<OrchestrationHandlerDependencies['computePerspectiveKey']>;
    markStatesEqual: NonNullable<OrchestrationHandlerDependencies['markStatesEqual']>;
    generateRoomPreview: typeof generateRoomPreview;
    runWithSingleFlight: RunWithSingleFlight | undefined;
    ensureAuthoredCatalog: typeof ensureAuthoredCatalog;
};

export const defaultGetCacheRecordById = async (
    componentId: EphemeraCacheComponentId,
    cacheId: EphemeraCacheId
): Promise<EphemeraCacheDynamoItem | undefined> => {
    const item = await ephemeraDB.getItem({
        Key: { EphemeraId: componentId, DataCategory: cacheId },
        getAllFields: true
    })
    return isEphemeraCacheDynamoItem(item) ? item : undefined
}

export const defaultClearPerspectivePointer = async (componentId: EphemeraCacheComponentId, perspectiveKey: string): Promise<void> => {
    await clearCatalogPerspectivePointer(componentId, perspectiveKey)
}

/**
 * Single-item orchestration: intake, stream-only error handling, and {@link findRender}.
 */
export const orchestrateRenderRequest = async (
    {
        payload,
        streamEvent,
    }: {
        payload: RenderRequested;
        streamEvent: StreamEventFunction<RenderOrchestrationPublishedPayload>;
    },
    _deps?: OrchestrationPipelineDependencies
): Promise<void> => {
    const orchDeps: OrchestrationHandlerDepsResolved = {
        getCacheRecordById: _deps?.getCacheRecordById ?? defaultGetCacheRecordById,
        getExactMatch: _deps?.getExactMatch ?? ((input) => internalCache.RenderCache.getExactMatch(input)),
        clearPerspectivePointer: _deps?.clearPerspectivePointer ?? defaultClearPerspectivePointer,
        computePerspectiveKey: _deps?.computePerspectiveKey ?? defaultComputePerspectiveKey,
        markStatesEqual: _deps?.markStatesEqual ?? markStatesEqual,
        generateRoomPreview: _deps?.generateRoomPreview ?? generateRoomPreview,
        runWithSingleFlight: _deps?.runWithSingleFlight,
        ensureAuthoredCatalog: _deps?.ensureAuthoredCatalog ?? ensureAuthoredCatalog,
    }

    const streamKey = payload.componentId
    const perspectiveKeyIngress = orchDeps.computePerspectiveKey(payload.perspective.assetStack)
    console.log('[mtw.ephemera.renderOrchestration] Render Requested', {
        componentId: payload.componentId,
        characterId: payload.characterId,
        perspectiveKey: perspectiveKeyIngress,
        allowGeneration: payload.allowGeneration,
        hasGenerationContextWml: Boolean(payload.generationContextWml),
    })

    const intake = await intakeRenderRequested(payload, _deps)

    const intakeErr = getIntakeOrchestrationErrorIfAny(intake)
    if (intakeErr) {
        console.log('[mtw.ephemera.renderOrchestration] Render Requested intake error', {
            componentId: payload.componentId,
            errorCode: intakeErr.errorCode,
            errorMessage: intakeErr.errorMessage,
        })
        const routing = buildOrchestrationRouting(payload.componentId, payload.perspective, orchDeps.computePerspectiveKey)
        await publishRenderOrchestrationStreamEvent(streamEvent, streamKey, {
            type: 'Orchestration Error',
            ...routing,
            errorCode: intakeErr.errorCode,
            errorMessage: intakeErr.errorMessage,
        })
        return
    }

    if (!isRenderResolveInputSuccess(intake)) {
        console.log('[mtw.ephemera.renderOrchestration] Render Requested intake: unexpected non-success', {
            componentId: payload.componentId,
        })
        return
    }

    const pkAfterIntake = orchDeps.computePerspectiveKey(intake.perspective.assetStack)
    console.log('[mtw.ephemera.renderOrchestration] Render Requested intake ok', {
        componentId: intake.componentId,
        perspectiveKey: pkAfterIntake,
        perspectiveAssetStack: intake.perspective.assetStack,
        hasPointerHint: intake.pointerHint !== undefined,
    })

    await orchDeps.ensureAuthoredCatalog({
        componentId: intake.componentId,
        perspective: intake.perspective,
    })

    const publishOrchestration = async (content: RenderOrchestrationPublishedPayload) => {
        await publishRenderOrchestrationStreamEvent(streamEvent, streamKey, content)
    }

    await findRender(intake, {
        getExactMatch: orchDeps.getExactMatch,
        getCacheRecordById: orchDeps.getCacheRecordById,
        clearPerspectivePointer: orchDeps.clearPerspectivePointer,
        computePerspectiveKey: orchDeps.computePerspectiveKey,
        markStatesEqual: orchDeps.markStatesEqual,
        perspectiveMatches,
        publishOrchestration,
        generateRoomPreview: orchDeps.generateRoomPreview,
        runWithSingleFlight: orchDeps.runWithSingleFlight,
    })
}
