import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { FacetListData } from '@tonylb/mtw-wml/ts/standardize/keys/abstract'
import type { SituationProseFacetPayloadType } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'

import type { MessageBus } from '../../messageBus/baseClasses'
import { executeMembershipTransfer } from '../positions/manipulation/membership/executeObjectMove'
import type { PositionsPublishedPayload } from '../positions/publishedEvents'
import { buildShortNameSemanticEmbedding } from './embedding/buildShortNameSemanticEmbedding'
import {
    persistDeleteImprovisationObject,
    persistSpawnImprovisationObject,
} from './persistImprovisationObject'
import { streamSpawnCompensationProblem } from './problemReports'

export type SpawnImprovisationObjectRow = {
    objectId: EphemeraObjectId;
    shortName: string;
    stableKey: string;
    targetRoomId: EphemeraRoomId;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
    /** `SITUATION#DEFAULT` prose facet (Acme-generated); already-built merge-body shape, no generation here. */
    situations?: FacetListData<SituationProseFacetPayloadType>;
}

export type SpawnOneImprovisationObjectDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    buildEmbedImpl?: typeof buildShortNameSemanticEmbedding;
    spawnImpl?: typeof persistSpawnImprovisationObject;
    applyMembershipImpl?: typeof executeMembershipTransfer;
    deleteImpl?: typeof persistDeleteImprovisationObject;
    streamProblemReport?: typeof streamSpawnCompensationProblem;
}

/**
 * Two-step spawn coordinator: existence rows, then room placement via manipulation kernel.
 */
export const spawnOneImprovisationObject = async (
    args: SpawnImprovisationObjectRow,
    deps: SpawnOneImprovisationObjectDependencies
): Promise<{ ok: true; objectId: EphemeraObjectId } | { ok: false; errorMessage: string }> => {
    const buildEmbed = deps.buildEmbedImpl ?? buildShortNameSemanticEmbedding
    const spawnImpl = deps.spawnImpl ?? persistSpawnImprovisationObject
    const applyMembershipImpl = deps.applyMembershipImpl ?? executeMembershipTransfer
    const deleteImpl = deps.deleteImpl ?? persistDeleteImprovisationObject
    const streamProblemReport = deps.streamProblemReport ?? streamSpawnCompensationProblem

    const embedResult = await buildEmbed(args.shortName)
    const spawnArgs = {
        objectId: args.objectId,
        shortName: args.shortName,
        stableKey: args.stableKey,
        tropeAffinities: args.tropeAffinities,
        tropeAffinitiesFailed: args.tropeAffinitiesFailed,
        situations: args.situations,
        ...(embedResult.success ? { embedding: embedResult.embedding } : {}),
    }
    if (!embedResult.success) {
        console.error('[mtw.ephemera.objects] shortName embed failed; spawning without embedding', {
            objectId: args.objectId,
            shortName: args.shortName,
            errorMessage: embedResult.errorMessage,
        })
    }

    const spawnResult = await spawnImpl(spawnArgs)
    if (!spawnResult.ok) {
        return spawnResult
    }

    const placeResult = await applyMembershipImpl({
        entityId: args.objectId,
        target: args.targetRoomId,
        messageBus: deps.messageBus,
        streamEvent: deps.streamEvent,
    })
    if (!placeResult.ok) {
        const placementError = placeResult.errorMessage ?? 'executeMembershipTransfer failed'
        const deleteResult = await deleteImpl({
            objectId: args.objectId,
            affectedRoomIds: [args.targetRoomId],
        })
        if (!deleteResult.ok) {
            const deleteError = deleteResult.errorMessage ?? 'persistDeleteImprovisationObject failed'
            console.error('[mtw.ephemera.objects] spawn placement failed; compensation delete failed', {
                objectId: args.objectId,
                placementError,
                deleteError,
            })
            await streamProblemReport({
                objectId: args.objectId,
                targetRoomId: args.targetRoomId,
                placementError,
                deleteError,
                sourceOperation: 'spawnOneImprovisationObject',
                attemptCount: 1,
            })
        }
        return { ok: false, errorMessage: placementError }
    }

    return { ok: true, objectId: args.objectId }
}

export type ApplyObjectsAddFailure = {
    objectId: EphemeraObjectId;
    stableKey: string;
    errorMessage: string;
}

export type SpawnImprovisationObjectsBatchResult = {
    createdIds: EphemeraObjectId[];
    addFailures: ApplyObjectsAddFailure[];
}

export type SpawnImprovisationObjectsBatchDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    spawnOneImpl?: typeof spawnOneImprovisationObject;
}

/**
 * Per-object batch isolation (S3): continue on failure; collect createdIds and addFailures.
 */
export const spawnImprovisationObjectsBatch = async (
    rows: SpawnImprovisationObjectRow[],
    deps: SpawnImprovisationObjectsBatchDependencies
): Promise<SpawnImprovisationObjectsBatchResult> => {
    const spawnOne = deps.spawnOneImpl ?? spawnOneImprovisationObject

    const outcomes = await Promise.all(
        rows.map(async (row) => {
            const spawnResult = await spawnOne(row, {
                messageBus: deps.messageBus,
                streamEvent: deps.streamEvent,
            })
            return { row, spawnResult }
        })
    )

    return outcomes.reduce<SpawnImprovisationObjectsBatchResult>(
        (acc, { row, spawnResult }) => {
            if (!spawnResult.ok) {
                return {
                    ...acc,
                    addFailures: [...acc.addFailures, {
                        objectId: row.objectId,
                        stableKey: row.stableKey,
                        errorMessage: spawnResult.errorMessage,
                    }],
                }
            }
            return {
                ...acc,
                createdIds: [...acc.createdIds, spawnResult.objectId],
            }
        },
        { createdIds: [], addFailures: [] }
    )
}
