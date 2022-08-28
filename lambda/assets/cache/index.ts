import recalculateComputes from '@tonylb/mtw-utilities/dist/executeCode/recalculateComputes'
import globalizeDBEntries from "./globalize.js"
import initializeRooms, { initializeFeatures } from './initializeRooms.js'
import putAssetNormalized from './putAssetNormalized.js'
import mergeEntries from './mergeEntries.js'
import StateSynthesizer from './stateSynthesis.js'
import assetRender from '@tonylb/mtw-utilities/dist/perception/assetRender'
import AssetWorkspace, { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist'
import {
    isNormalAsset,
    NormalItem,
    NormalForm,
    isNormalCondition,
    NormalReference,
    isNormalExit
} from '@tonylb/mtw-wml/dist/normalize/baseClasses.js'
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { EphemeraCondition, EphemeraItem } from './baseClasses'
import { objectEntryMap, objectMap } from '../lib/objects.js'

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
    const conditionsFromContext = (contextStack: NormalReference[]): EphemeraCondition[] => (
        contextStack
            .filter(({ tag }) => (tag === 'Condition'))
            .map(({ key }) => (normal[key]))
            .filter(isNormalCondition)
            .map((condition) => ({
                dependencies: condition.dependencies,
                if: condition.if
            }))
    )
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
                        conditions: conditionsFromContext(appearance.contextStack),
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
                        conditions: conditionsFromContext(appearance.contextStack),
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
                        conditions: conditionsFromContext(appearance.contextStack),
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

//
// TODO: Extend cacheAsset to also cache characters where needed
//
export const cacheAsset = async (address: AssetWorkspaceAddress, options: CacheAssetOptions = {}): Promise<void> => {
    const { check = false, recursive = false, forceCache = false } = options

    const assetWorkspace = new AssetWorkspace(address)
    await assetWorkspace.loadJSON()
    const assetItem = Object.values(assetWorkspace.normal || {}).find(isNormalAsset)
    if (!assetItem || !assetWorkspace.namespaceIdToDB[assetItem.key]) {
        return
    }
    const assetEphemeraId = assetWorkspace.namespaceIdToDB[assetItem.key] || ''
    if (check) {
        const { EphemeraId = null } = await ephemeraDB.getItem<{ EphemeraId: string }>({
            EphemeraId: assetEphemeraId,
            DataCategory: 'Meta::Asset',
        }) || {}
        if (Boolean(EphemeraId)) {
            return
        }
    }

    //
    // Instanced stories are not directly cached, they are instantiated ... so
    // this would be a miscall, and should be ignored.
    //
    if (assetItem.instance) {
        return
    }

    const ephemeraExtractor = ephemeraItemFromNormal(assetWorkspace.namespaceIdToDB, assetWorkspace.normal || {})
    const ephemeraItems: EphemeraItem[] = Object.values(assetWorkspace.normal || {})
        .map(ephemeraExtractor)
        .filter((value: EphemeraItem | undefined): value is EphemeraItem => (Boolean(value)))

    const stateSynthesizer = new StateSynthesizer(assetId, secondPassNormal)

    await Promise.all([
        stateSynthesizer.fetchFromEphemera(),
        putAssetNormalized({ assetId, normalForm: secondPassNormal }),
        mergeEntries(assetId, secondPassNormal),
        //
        // TODO: Check whether there is a race-condition between mergeEntries and initializeRooms
        //
        initializeRooms(Object.values(secondPassNormal)
            .filter(({ tag }) => (['Room'].includes(tag)))
            .map(({ EphemeraId }) => EphemeraId)
        ),
        initializeFeatures(Object.values(secondPassNormal)
            .filter(({ tag }) => (['Feature'].includes(tag)))
            .map(({ EphemeraId }) => EphemeraId)
        ),
    ])

    assetMetaData.dependencies = stateSynthesizer.dependencies
    
    stateSynthesizer.evaluateDefaults()
    await stateSynthesizer.fetchImportedValues()
    const { state } = recalculateComputes(
        stateSynthesizer.state,
        assetMetaData.dependencies,
        Object.entries(stateSynthesizer.state)
            .filter(([_, { computed }]) => (!computed))
            .map(([key]) => (key))
    )
    assetMetaData.state = state

    assetMetaData.mapCache = await assetRender({
        assetId,
        existingStatesByAsset: {
            [assetId]: state,
        },
        existingNormalFormsByAsset: {
            [assetId]: secondPassNormal
        }
    })

    assetMetaData.actions = Object.values(secondPassNormal)
        .filter(({ tag }) => (tag === 'Action'))
        .reduce((previous, { key, src }) => ({
            ...previous,
            [key]: {
                ...(previous[key] || {}),
                src
            }
        }), {})
    await Promise.all([
        assetMetaData.pushEphemera(),
        stateSynthesizer.updateImportedDependencies()
    ])
}
