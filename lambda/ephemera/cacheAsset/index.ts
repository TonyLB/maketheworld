import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'
import {
    EphemeraCharacter,
    EphemeraKeyMappingMixin,
    EphemeraPushArgs,
    EphemeraStateMappingMixin
} from './baseClasses'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { MessageBus } from '../messageBus/baseClasses'
import { mergeIntoEphemera, mergeIntoExamples } from './mergeIntoEphemera'
import {
    EphemeraAssetId,
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraId,
    EphemeraKnowledgeId,
    EphemeraRoomId,
    isEphemeraAssetId,
    isEphemeraFeatureId,
    isEphemeraId,
    isEphemeraKnowledgeId,
    isEphemeraRoomId
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import { CharacterMetaItem } from '../internalCache/characterMeta'
import ReadOnlyAssetWorkspace, { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { graphStorageDB } from '../dependentMessages/graphCache'
import topologicalSort from '@tonylb/mtw-utilities/ts/graphStorage/utils/graph/topologicalSort'
import GraphUpdate from '@tonylb/mtw-utilities/ts/graphStorage/update'
import { StateItemId, isStateItemId } from '../internalCache/baseClasses'
import { map } from '@tonylb/mtw-wml/ts/tree/map'
import { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardVariable from '@tonylb/mtw-wml/ts/standardize/components/variable'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import { isSchemaImage } from '@tonylb/mtw-base/ts/schema/image'
import { isSchemaImport } from '@tonylb/mtw-base/ts/schema/metaData'

export const pushEphemera = async({
    EphemeraId,
    scopeMap = {}
}: EphemeraPushArgs) => {
    await ephemeraDB.putItem({
        EphemeraId,
        DataCategory: 'Meta::Asset',
        scopeMap
    })
}

const pushCharacterEphemeraToInternalCache = async (character: EphemeraCharacter): Promise<CharacterMetaItem | undefined> => {
    const [previous, graph] = await Promise.all([
        internalCache.CharacterMeta.get(character.EphemeraId, { check: true }),
        internalCache.Graph.get((character.assets || []).map(AssetKey), 'back')
    ])
    if (!previous) {
        return undefined
    }
    const sortedAssets = topologicalSort(graph.filter({ keys: character.assets.map(AssetKey) }).reverse()).flat().map((assetId) => (assetId.split('#')?.[1] || '')).filter((value) => (value))
    const updated: CharacterMetaItem = {
        ...previous,
        Pronouns: character.Pronouns,
        Name: character.Name,
        assets: sortedAssets
    }
    internalCache.CharacterMeta.set(updated)
    return updated
}

export const pushCharacterEphemera = async (character: Omit<EphemeraCharacter, 'address' | 'Connected' | 'ConnectionIds'> & { address?: AssetWorkspaceAddress; Connected?: boolean; ConnectionIds?: string[] }, meta?: CharacterMetaItem) => {
    const updateKeys: (keyof EphemeraCharacter)[] = ['address', 'Pronouns', 'OneCoolThing', 'Outfit', 'fileURL', 'Color', 'player']
    await ephemeraDB.optimisticUpdate({
        Key: {
            EphemeraId: character.EphemeraId,
            DataCategory: 'Meta::Character'
        },
        updateKeys: [...updateKeys, 'assets', 'Name'],
        updateReducer: (draft) => {
            draft.Name = character.Name
            draft.assets = meta ? meta.assets : character.assets
            updateKeys.forEach((key) => {
                draft[key] = character[key]
            })
        },
    })
}

type CacheAssetArguments = {
    messageBus: MessageBus;
    assetId: EphemeraAssetId | EphemeraCharacterId;
    check?: boolean;
    updateOnly?: boolean;
}

//
// cacheAsset takes an Asset or Character Id (which must have had its address pre-populated in the internalCache.AssetAddress cache), looks it
// up in the cache, and uses the address to read in data from the S3 data lake, and cache that data appropriately in Ephemera table structures.
//
export const cacheAsset = async ({ assetId, messageBus, check = false, updateOnly = false }: CacheAssetArguments): Promise<void> => {

    const address = await internalCache.AssetAddress.get(assetId)
    if (typeof address === 'undefined') {
        return
    }
    const assetWorkspace = new ReadOnlyAssetWorkspace(address.address)
    await assetWorkspace.loadJSON()
    //
    // Process file if an Asset
    //
    if (assetWorkspace.standard) {
        const assetId = assetWorkspace.address.zone === 'Draft' ? `draft[${assetWorkspace.address.player}]` : assetWorkspace.standard.key
        if (check || updateOnly) {
            const assetEphemeraId = AssetKey(assetWorkspace.standard?.key ?? assetId)
            if (!(assetEphemeraId && isEphemeraAssetId(assetEphemeraId))) {
                return
            }
            const { EphemeraId = null } = await internalCache.AssetMeta.get(assetEphemeraId) || {}
            if ((check && Boolean(EphemeraId)) || (updateOnly && !Boolean(EphemeraId))) {
                return
            }
        }
    
        const ephemeraItems: (StandardComponentData & { EphemeraId: EphemeraId })[] = Object.values(assetWorkspace.standard.byId || {})
            .filter(excludeUndefined)
            .filter((component) => (!(component instanceof StandardExample)))
            .map((item) => {
                if (item instanceof StandardCharacter || item instanceof StandardVariable) {
                    return item.toJSON({ stripUniversalKey: true, stripUIFields: true })
                }
                //
                // Generate stateMapping from dependencies and assetWorkspace.universalKey (in case it is needed)
                //
                const dependencies = item.referencedKeys()
                    .filter(({ referenceType }) => (referenceType === 'Dependency'))
                    .map(({ key }) => (key))
                const stateMapping = dependencies.reduce<Record<string, StateItemId>>((previous, key) => {
                    const universalKey = assetWorkspace.standard?.byId?.[key]?.universalKey
                    if (universalKey && isStateItemId(universalKey)) {
                        return { ...previous, [key]: universalKey }
                    }
                    return previous
                }, {})
                //
                // Generate keyMapping from references and assetWorkspace.universalKey (in case it is needed)
                //
                const keysReferenced = item.referencedKeys()
                    .filter(({ referenceType }) => (referenceType !== 'Dependency'))
                    .map(({ key }) => (key))
                const keyMapping = keysReferenced.reduce<Record<string, EphemeraId>>((previous, key) => {
                    const universalKey = assetWorkspace.standard?.byId?.[key]?.universalKey
                    if (universalKey && isEphemeraId(universalKey)) {
                        return { ...previous, [key]: universalKey }
                    }
                    return previous
                }, {})
                return {
                    ...(
                        item instanceof StandardExample 
                            ? item.toNDJSON({ stripUniversalKey: true, stripUIFields: true })
                            : item.toJSON({ stripUniversalKey: true, stripUIFields: true })
                    ),
                    keyMapping,
                    stateMapping,
                    ...(item instanceof StandardMap
                        ? {
                            images: map(item.images, (node) => {
                                const { data, children } = node
                                if (isSchemaImage(data)) {
                                    const fileLookup = assetWorkspace.standard?.byId[data.key]?.fileName
                                    if (fileLookup) {
                                        return [{
                                            data: {
                                                ...data,
                                                fileURL: data.fileURL ?? fileLookup
                                            },
                                            children
                                        }]
                                    }
                                }
                                return [{ data, children }]
                            })
                        }
                        : {}
                    )
                }
            })
            .map((component) => ({ ...component, EphemeraId: assetWorkspace.standard?.byId?.[component.key]?.universalKey }))
            .filter((component): component is (StandardComponentData & EphemeraKeyMappingMixin & EphemeraStateMappingMixin & { EphemeraId: EphemeraId }) => (Boolean(component.EphemeraId && isEphemeraId(component.EphemeraId))))
    
        const graphUpdate = new GraphUpdate({ internalCache: internalCache._graphCache as any, dbHandler: graphStorageDB })

        const examplesByComponentUniversalKey = Object.values(assetWorkspace.standard.byId || {})
            .filter((item) => (item instanceof StandardExample))
            .reduce<Record<EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId, StandardExample[]>>((previous, example) => {
                const parentKey = example.key.split('.').slice(0, -1).join('.')
                if (!parentKey) {
                    return previous
                }
                const parentUniversalKey = assetWorkspace.standard?.byId?.[parentKey]?.universalKey
                if (!(parentUniversalKey && (isEphemeraRoomId(parentUniversalKey) || isEphemeraFeatureId(parentUniversalKey) || isEphemeraKnowledgeId(parentUniversalKey)))) {
                    return previous
                }
                return {
                    ...previous,
                    [parentUniversalKey]: [
                        ...(previous[parentUniversalKey] || []),
                        example
                    ]
                }
            }, {})
        await Promise.all([
            mergeIntoEphemera(assetId, ephemeraItems, graphUpdate),
            mergeIntoExamples(assetId, examplesByComponentUniversalKey)
        ])

        const assets = (assetWorkspace.standard?.metaData ?? [])
            .filter(treeNodeTypeguard(isSchemaImport))
            .map(({ data }) => (data.from))

        graphUpdate.setEdges([{
            itemId: AssetKey(assetId),
            edges: assets
                .map((from) => ({ target: AssetKey(from), context: '' })),
            options: { direction: 'back' }
        }])

        await Promise.all([
            graphUpdate.flush(),
            pushEphemera({
                EphemeraId: AssetKey(assetId),
                scopeMap: Object.values(assetWorkspace.standard?.byId || {})
                    .reduce<Record<string, string>>((previous, component) => ({
                        ...previous,
                        [component.key]: component.universalKey ?? component.key
                    }), {})
            })
        ])

        //
        // Use MessageBus to queue RoomHeader messages for any room that has a person to
        // report to
        //
        // TODO: Optimize RoomHeader messages to only deliver to characters who have
        // the asset that is being cached
        //
        Object.values(assetWorkspace.standard?.byId || {})
            .filter((item) => (item instanceof StandardRoom))
            .map(({ key }) => (assetWorkspace.standard?.byId?.[key]?.universalKey))
            .filter((value): value is string => (Boolean(value)))
            .filter(isEphemeraRoomId)
            .forEach((roomId) => {
                messageBus.send({
                    type: 'Perception',
                    ephemeraId: roomId,
                    header: true
                })
            })
    }

}
