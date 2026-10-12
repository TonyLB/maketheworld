import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { isEphemeraObjectEmbedding } from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'
import { isEphemeraMetaObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { FacetListData } from '@tonylb/mtw-wml/ts/standardize/keys/abstract'
import type { SituationProseFacetPayloadType } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'

import type { MessageBus } from '../../messageBus/baseClasses'
import { executeComponentCreation } from '../positions/manipulation/membership/executeComponentCreation'
import type { PositionsPublishedPayload } from '../positions/publishedEvents'
import { buildShortNameSemanticEmbedding } from './embedding/buildShortNameSemanticEmbedding'
import { objectEmbeddingPutItem } from './embedding/objectEmbeddingPutItem'
import { invalidateImprovisationObjectCaches } from './invalidateImprovisationObjectCaches'
import {
    improvisationMetaRow,
    improvisationPairComponent,
    improvisationPairPutItem,
} from './persistImprovisationObject'

export type SpawnImprovisationObjectRow = {
    objectId: EphemeraObjectId;
    shortName: string;
    stableKey: string;
    targetRoomId: EphemeraRoomId;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
    /** `SITUATION#DEFAULT` prose facet (Acme-generated); already-built merge-body shape, no generation here. */
    situations?: FacetListData<SituationProseFacetPayloadType>;
    /** Short, reasoning-facing identity description (Acme-generated); absence is valid. */
    gloss?: string;
}

export type SpawnOneImprovisationObjectDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    buildEmbedImpl?: typeof buildShortNameSemanticEmbedding;
    createImpl?: typeof executeComponentCreation;
}

/**
 * Spawn and place as one kernel commit (contract S1): the existence rows ride the same transaction
 * as `createComponent` (the `Meta::Object` row, born holding a hostless remainder) and the
 * placement that re-points that remainder into the room. A failed placement writes nothing, so
 * there is nothing to compensate for.
 */
export const spawnOneImprovisationObject = async (
    args: SpawnImprovisationObjectRow,
    deps: SpawnOneImprovisationObjectDependencies
): Promise<{ ok: true; objectId: EphemeraObjectId } | { ok: false; errorMessage: string }> => {
    const buildEmbed = deps.buildEmbedImpl ?? buildShortNameSemanticEmbedding
    const createImpl = deps.createImpl ?? executeComponentCreation

    const meta = improvisationMetaRow(args)
    if (!isEphemeraMetaObject(meta)) {
        return { ok: false, errorMessage: `Invalid Meta::Object payload for ${args.objectId}` }
    }

    const embedResult = await buildEmbed(args.shortName)
    if (!embedResult.success) {
        console.error('[mtw.ephemera.objects] shortName embed failed; spawning without embedding', {
            objectId: args.objectId,
            shortName: args.shortName,
            errorMessage: embedResult.errorMessage,
        })
    }
    const embedding = embedResult.success ? embedResult.embedding : undefined
    const embeddingItem = embedding ? objectEmbeddingPutItem({ objectId: args.objectId, embedding }) : undefined
    if (embeddingItem && !isEphemeraObjectEmbedding(embeddingItem.Put)) {
        return { ok: false, errorMessage: `Invalid EMBEDDING#IMPROMPTU payload for ${args.objectId}` }
    }

    const createResult = await createImpl({
        objectId: args.objectId,
        meta,
        target: args.targetRoomId,
        existenceItems: [
            improvisationPairPutItem(args),
            ...(embeddingItem ? [embeddingItem] : []),
        ],
        messageBus: deps.messageBus,
        streamEvent: deps.streamEvent,
        afterPersist: () => invalidateImprovisationObjectCaches({
            objectId: args.objectId,
            affectedRoomIds: [args.targetRoomId],
            pairComponent: improvisationPairComponent(args),
            metaRow: meta,
            ...(embedding ? { embedding } : { clearEmbedding: true }),
        }),
    })
    if (!createResult.ok) {
        return { ok: false, errorMessage: createResult.errorMessage ?? 'executeComponentCreation failed' }
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
