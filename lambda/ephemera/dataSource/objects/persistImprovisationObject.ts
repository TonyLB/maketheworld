import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { EMBEDDING_IMPROMPTU_DATA_CATEGORY } from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'
import type { EphemeraMetaObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { FacetListData } from '@tonylb/mtw-wml/ts/standardize/keys/abstract'
import type { SituationProseFacetPayloadType } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import type { MessageBus } from '../../messageBus/baseClasses'
import messageBus from '../../messageBus'
import { sendDeleteCacheRecords } from '../apiEphemera'
import { queryAllRenderCacheDataCategoriesForComponent } from '../renderCache/queryAllRenderCacheDataCategoriesForComponent'
import { invalidateImprovisationObjectCaches } from './invalidateImprovisationObjectCaches'

const META_OBJECT_DATA_CATEGORY = 'Meta::Object' as const

export type DeleteImprovisationObjectArgs = {
    objectId: EphemeraObjectId;
    affectedRoomIds?: EphemeraRoomId[];
}

export type PersistImprovisationObjectDependencies = {
    transactWrite?: typeof ephemeraDB.transactWrite;
    messageBus?: MessageBus;
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

const deleteTransactItemsForObject = (objectId: EphemeraObjectId) => [
    {
        Delete: {
            EphemeraId: objectId,
            DataCategory: IMPROVISATION_ASSET_ID,
        },
    },
    {
        Delete: {
            EphemeraId: objectId,
            DataCategory: META_OBJECT_DATA_CATEGORY,
        },
    },
    {
        Delete: {
            EphemeraId: objectId,
            DataCategory: EMBEDDING_IMPROMPTU_DATA_CATEGORY,
        },
    },
]

/**
 * Delete improvisation pair, Meta::Object, and EMBEDDING#IMPROMPTU rows for one OBJECT#.
 */
export const persistDeleteImprovisationObject = async (
    args: DeleteImprovisationObjectArgs,
    deps?: PersistImprovisationObjectDependencies
): Promise<{ ok: true; objectId: EphemeraObjectId } | { ok: false; errorMessage: string }> => {
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)
    const bus = deps?.messageBus ?? messageBus
    const queryRenderCacheDataCategories = deps?.queryRenderCacheDataCategories ?? queryAllRenderCacheDataCategoriesForComponent

    try {
        await transactWrite(deleteTransactItemsForObject(args.objectId))
        invalidateImprovisationObjectCaches({
            objectId: args.objectId,
            affectedRoomIds: args.affectedRoomIds,
            clearEmbedding: true,
        })
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
        return { ok: true, objectId: args.objectId }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, errorMessage: message }
    }
}
