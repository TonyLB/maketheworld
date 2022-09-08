import {
    mergeIntoDataRange
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import recalculateComputes from '@tonylb/mtw-utilities/dist/executeCode/recalculateComputes'
import initializeRooms, { initializeFeatures } from './initializeRooms.js'
import putAssetNormalized from './putAssetNormalized.js'
import StateSynthesizer from './stateSynthesis'
import assetRender from '@tonylb/mtw-utilities/dist/perception/assetRender'
import AssetWorkspace from '@tonylb/mtw-asset-workspace/dist/'
import {
    isNormalAsset,
    NormalItem,
    NormalForm,
    isNormalExit
} from '@tonylb/mtw-wml/dist/normalize/baseClasses.js'
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { EphemeraItem, EphemeraPushArgs } from './baseClasses'
import { objectEntryMap } from '../lib/objects.js'
import { conditionsFromContext } from './utilities'
import { isNormalAction } from '@tonylb/mtw-wml/dist/normalize.js'
import { AssetKey } from '@tonylb/mtw-utilities/dist/types.js'
import { CacheAssetMessage, MessageBus } from '../messageBus/baseClasses.js'

//
// TODO:
//
// Consider how to handle the various cases of change,
// in relation to the characters possibly occupying the rooms
//
// What does it mean when the underlying assets of a room change, in terms
// of notifying people in it?
//

type CacheAssetOptions = {
    check?: boolean;
    recursive?: boolean;
    forceCache?: boolean;
}

//
// Translates from normal form to a fetch-ready record to be stored in the Ephemera table.
//

//
// TODO(ISS1387): Translate features and actions in render links to their DB ID counterparts
//
const ephemeraItemFromNormal = (namespaceMap: AssetWorkspace["namespaceIdToDB"], normal: NormalForm) => (item: NormalItem): EphemeraItem | undefined => {
    const conditionsTransform = conditionsFromContext(normal)
    const EphemeraId = namespaceMap[item.key]
    if (!EphemeraId) {
        return undefined
    }
    switch(item.tag) {
        case 'Room':
            return {
                tag: 'Room',
                key: item.key,
                EphemeraId,
                appearances: item.appearances
                    .map((appearance) => ({
                        conditions: conditionsTransform(appearance.contextStack),
                        name: appearance.name || '',
                        render: appearance.render || [],
                        exits: appearance.contents
                            .filter(({ tag }) => (tag === 'Exit'))
                            .map(({ key }) => (normal[key]))
                            .filter(isNormalExit)
                            .map(({ to, name }) => ({
                                name: name || '',
                                to: namespaceMap[to]
                            }))
                    }))
            }
        case 'Feature':
            return {
                tag: 'Feature',
                key: item.key,
                EphemeraId,
                appearances: item.appearances
                    .map((appearance) => ({
                        conditions: conditionsTransform(appearance.contextStack),
                        name: appearance.name || '',
                        render: appearance.render || [],
                    }))
            }
        case 'Map':
            return {
                tag: 'Map',
                key: item.key,
                EphemeraId,
                appearances: item.appearances
                    .map((appearance) => ({
                        conditions: conditionsTransform(appearance.contextStack),
                        name: appearance.name || '',
                        fileURL: appearance.images.length > 0 ? appearance.images.slice(-1)[0] : '',
                        rooms: objectEntryMap(appearance.rooms, ([key, { x, y }]) => ({
                            EphemeraId: namespaceMap[key] || '',
                            x,
                            y
                        }))
                    }))
            }
        default:
            return undefined
    }
}


export const pushEphemera = async({
    EphemeraId,
    State,
    Dependencies = { room: [], computed: [] },
    Actions = {},
    mapCache = {},
    importTree = {},
    scopeMap = {}
}: EphemeraPushArgs) => {
    await ephemeraDB.putItem<EphemeraPushArgs & { DataCategory: 'Meta::Asset' }>({
        EphemeraId,
        DataCategory: 'Meta::Asset',
        State,
        Dependencies,
        Actions,
        mapCache,
        importTree,
        scopeMap
    })
}

//
// TODO: Extend cacheAsset to also cache characters where needed
//
export const cacheAssetMessage = async ({ payloads, messageBus }: { payloads: CacheAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    //
    // To avoid race conditions, Cache payloads are currently evaluated sequentially
    //
    for (const { address, options } of payloads) {
        const { check = false, recursive = false, forceCache = false } = options

        const assetWorkspace = new AssetWorkspace(address)
        await assetWorkspace.loadJSON()
        const assetItem = Object.values(assetWorkspace.normal || {}).find(isNormalAsset)
        if (!assetItem) {
            continue
        }
        if (check) {
            const assetEphemeraId = assetWorkspace.namespaceIdToDB[assetItem.key] || ''
            if (!assetEphemeraId) {
                continue
            }
            const { EphemeraId = null } = await ephemeraDB.getItem<{ EphemeraId: string }>({
                EphemeraId: assetEphemeraId,
                DataCategory: 'Meta::Asset',
            }) || {}
            if (Boolean(EphemeraId)) {
                continue
            }
        }
    
        //
        // Instanced stories are not directly cached, they are instantiated ... so
        // this would be a miscall, and should be ignored.
        //
        if (assetItem.instance) {
            continue
        }
        const assetId = assetItem.key
    
        const ephemeraExtractor = ephemeraItemFromNormal(assetWorkspace.namespaceIdToDB, assetWorkspace.normal || {})
        const ephemeraItems: EphemeraItem[] = Object.values(assetWorkspace.normal || {})
            .map(ephemeraExtractor)
            .filter((value: EphemeraItem | undefined): value is EphemeraItem => (Boolean(value)))
    
        const stateSynthesizer = new StateSynthesizer(assetWorkspace.namespaceIdToDB, assetWorkspace.normal || {})
    
        await Promise.all([
            stateSynthesizer.fetchFromEphemera(),
            putAssetNormalized({ assetId, normalForm: ephemeraItems }),
            mergeIntoDataRange({
                table: 'ephemera',
                search: { DataCategory: AssetKey(assetId) },
                items: ephemeraItems,
                mergeFunction: ({ current, incoming }) => {
                    if (!incoming) {
                        return 'delete'
                    }
                    if (!current) {
                        return incoming
                    }
                    if (JSON.stringify(current) === JSON.stringify(incoming)) {
                        return 'ignore'
                    }
                    else {
                        return incoming
                    }
                },
                extractKey: null
            }),
            //
            // TODO: Check whether there is a race-condition between mergeEntries and initializeRooms
            //
            initializeRooms(Object.values(ephemeraItems)
                .filter(({ tag }) => (['Room'].includes(tag)))
                .map(({ EphemeraId }) => EphemeraId)
            ),
            initializeFeatures(Object.values(ephemeraItems)
                .filter(({ tag }) => (['Feature'].includes(tag)))
                .map(({ EphemeraId }) => EphemeraId)
            ),
        ])
    
        stateSynthesizer.evaluateDefaults()
        await stateSynthesizer.fetchImportedValues()
        const { state } = recalculateComputes(
            stateSynthesizer.state,
            stateSynthesizer.dependencies,
            Object.entries(stateSynthesizer.state)
                .filter(([_, { computed }]) => (!computed))
                .map(([key]) => (key))
        )
        stateSynthesizer.state = state
    
        const mapCache = await assetRender({
            assetId,
            existingStatesByAsset: {
                [assetId]: state,
            },
            existingNormalFormsByAsset: {
                [assetId]: assetWorkspace.normal || {}
            }
        })
    
        const actions = Object.values(assetWorkspace.normal || {})
            .filter(isNormalAction)
            .reduce((previous, { key, src }) => ({
                ...previous,
                [key]: {
                    ...(previous[key] || {}),
                    src
                }
            }), {})
        await Promise.all([
            pushEphemera({
                EphemeraId: AssetKey(assetItem.key),
                State: stateSynthesizer.state,
                Dependencies: stateSynthesizer.dependencies,
                Actions: actions,
                mapCache,
                //
                // TODO: Refactor ancestry/descent layer of ephemera storage
                //
                importTree: {},
                scopeMap: assetWorkspace.namespaceIdToDB
            }),
            stateSynthesizer.updateImportedDependencies()
        ])
    }

}
