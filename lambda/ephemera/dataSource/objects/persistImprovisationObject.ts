import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { IMPROVISATION_ASSET_ID, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { EMBEDDING_IMPROMPTU_DATA_CATEGORY } from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraMetaObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { FacetListData } from '@tonylb/mtw-wml/ts/standardize/keys/abstract'
import type { SituationProseFacetPayloadType } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'

import type { MessageBus } from '../../messageBus/baseClasses'
import messageBus from '../../messageBus'
import { sendDeleteCacheRecords } from '../apiEphemera'
import { queryAllRenderCacheDataCategoriesForComponent } from '../renderCache/queryAllRenderCacheDataCategoriesForComponent'
import { executeComponentDestruction } from '../positions/manipulation/membership/executeComponentDestruction'
import type { PositionsPublishedPayload } from '../positions/publishedEvents'
import { streamEventFromMessageBus as streamPositionsEventFromMessageBus } from '../positions/publishedEvents'
import { invalidateImprovisationObjectCaches } from './invalidateImprovisationObjectCaches'

const META_OBJECT_DATA_CATEGORY = 'Meta::Object' as const

export type DeleteImprovisationObjectArgs = {
    objectId: EphemeraObjectId;
    affectedRoomIds?: EphemeraRoomId[];
}

export type DestroyImprovisedObjectDependencies = {
    messageBus?: MessageBus;
    positionsStreamEvent?: StreamEventFunction<PositionsPublishedPayload>;
    executeDestruction?: typeof executeComponentDestruction;
    queryRenderCacheDataCategories?: typeof queryAllRenderCacheDataCategoriesForComponent;
}

/** The improvisation pair's merge body: what `ImprovisationComponentData` reads back. */
export type ImprovisationPairFields = {
    objectId: EphemeraObjectId;
    shortName: string;
    /** `SITUATION#DEFAULT` prose facet (Acme-generated); already-built merge-body shape. */
    situations?: FacetListData<SituationProseFacetPayloadType>;
    /** Short, reasoning-facing identity description (Acme-generated); absence is valid. */
    gloss?: string;
}

const pairOptionalFields = ({ situations, gloss }: ImprovisationPairFields) => ({
    ...(situations !== undefined && situations.length > 0 ? { situations } : {}),
    ...(gloss !== undefined && gloss.length > 0 ? { gloss } : {}),
})

export const improvisationPairPutItem = (fields: ImprovisationPairFields) => ({
    Put: {
        EphemeraId: fields.objectId,
        DataCategory: IMPROVISATION_ASSET_ID,
        tag: 'Object' as const,
        shortName: fields.shortName,
        ...pairOptionalFields(fields),
    },
})

/** The same pair body as a component, for seeding `ImprovisationComponentData` after a write. */
export const improvisationPairComponent = (fields: ImprovisationPairFields): StandardObject => (
    new StandardObject({
        tag: 'Object',
        universalKey: fields.objectId,
        shortName: fields.shortName,
        ...pairOptionalFields(fields),
    })
)

/** An improvised Object's `Meta::Object` fields, without its `ludicGraph` (the kernel owns that). */
export const improvisationMetaRow = (args: {
    objectId: EphemeraObjectId;
    stableKey: string;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
}): Omit<EphemeraMetaObject, 'ludicGraph'> => ({
    EphemeraId: args.objectId,
    DataCategory: META_OBJECT_DATA_CATEGORY,
    stableKey: args.stableKey,
    ...(args.tropeAffinities !== undefined ? { tropeAffinities: args.tropeAffinities } : {}),
    ...(args.tropeAffinitiesFailed === true ? { tropeAffinitiesFailed: true as const } : {}),
})

/** The pair and embedding rows an improvised Object owns; its `Meta::Object` row is the kernel's. */
const existenceDeleteItems = (objectId: EphemeraObjectId) => [
    { Delete: { EphemeraId: objectId, DataCategory: IMPROVISATION_ASSET_ID } },
    { Delete: { EphemeraId: objectId, DataCategory: EMBEDDING_IMPROMPTU_DATA_CATEGORY } },
]

/**
 * Destroys one improvised Object as one kernel commit: the placement clear, the `Meta::Object` row
 * (the kernel's `destroyComponent`), and the pair and `EMBEDDING#IMPROMPTU` rows (riding as
 * `existenceItems`). The kernel refuses while the Object still hosts anything of its own.
 */
export const destroyImprovisedObject = async (
    args: DeleteImprovisationObjectArgs,
    deps?: DestroyImprovisedObjectDependencies
): Promise<{ ok: true; objectId: EphemeraObjectId; froms: EphemeraMembershipHostId[] } | { ok: false; errorMessage: string }> => {
    const bus = deps?.messageBus ?? messageBus
    const streamEvent = deps?.positionsStreamEvent ?? streamPositionsEventFromMessageBus(bus)
    const executeDestruction = deps?.executeDestruction ?? executeComponentDestruction
    const queryRenderCacheDataCategories = deps?.queryRenderCacheDataCategories ?? queryAllRenderCacheDataCategoriesForComponent

    const result = await executeDestruction({
        objectId: args.objectId,
        existenceItems: existenceDeleteItems(args.objectId),
        messageBus: bus,
        streamEvent,
        afterPersist: (froms) => {
            invalidateImprovisationObjectCaches({
                objectId: args.objectId,
                affectedRoomIds: [
                    ...new Set([
                        ...(args.affectedRoomIds ?? []),
                        ...froms.filter((hostId): hostId is EphemeraRoomId => isEphemeraRoomId(hostId)),
                    ]),
                ],
                clearEmbedding: true,
            })
        },
    })
    if (!result.ok) {
        return { ok: false, errorMessage: result.errorMessage ?? `executeComponentDestruction failed for ${args.objectId}` }
    }

    try {
        const dataCategories = await queryRenderCacheDataCategories(args.objectId)
        if (dataCategories.length > 0) {
            sendDeleteCacheRecords(bus, args.objectId, { componentId: args.objectId, dataCategories })
        }
    }
    catch (renderCacheError) {
        const renderCacheErrorMessage = renderCacheError instanceof Error ? renderCacheError.message : String(renderCacheError)
        console.error('[dataSource/objects] render-cache cleanup failed after object delete', {
            objectId: args.objectId,
            errorMessage: renderCacheErrorMessage,
        })
    }
    return { ok: true, objectId: args.objectId, froms: result.froms }
}
