import recalculateComputes from '@tonylb/mtw-utilities/dist/executeCode/recalculateComputes'
import parseWMLFile from './parseWMLFile.js'
import globalizeDBEntries from "./globalize.js"
import initializeRooms, { initializeFeatures } from './initializeRooms.js'
import putAssetNormalized from './putAssetNormalized.js'
import AssetMetaData from './assetMetaData.js'
import mergeEntries from './mergeEntries.js'
import StateSynthesizer from './stateSynthesis.js'
import assetRender from '@tonylb/mtw-utilities/dist/perception/assetRender'
import AssetWorkspace, { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist'
import { isNormalAsset } from '@tonylb/mtw-wml/dist/normalize/baseClasses.js'
import { isNormalCharacter } from '@tonylb/mtw-wml/dist/normalize/baseClasses.js'
import { AssetKey } from '@tonylb/mtw-utilities/dist/types.js'
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'

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

type CacheItemTracker = {
    key: string;
    ephemeraId: string;
    tag: 'Asset' | 'Character';
    alreadyPresent: boolean;
}

//
// TODO: Extend cacheAsset to also cache characters where needed
//
export const cacheAsset = async (address: AssetWorkspaceAddress, options: CacheAssetOptions = {}): Promise<void> => {
    const { check = false, recursive = false, forceCache = false } = options

    const assetWorkspace = new AssetWorkspace(address)
    await assetWorkspace.loadJSON()
    let cacheItemStatus: CacheItemTracker[] = [
        ...Object.values(assetWorkspace.normal || {})
            .filter(isNormalAsset)
            .map(({ key, tag }) => ({
                key,
                tag,
                ephemeraId: AssetKey(key),
                alreadyPresent: false
            }))
    ]
    if (check) {
        const checkAsset = async (item: CacheItemTracker): Promise<CacheItemTracker> => {
            
            const { EphemeraId = null } = await ephemeraDB.getItem<{ EphemeraId: string }>({
                EphemeraId: item.ephemeraId,
                DataCategory: 'Meta::Asset',
            }) || {}
            return {
                ...item,
                alreadyPresent: Boolean(EphemeraId)
            }
        }
        cacheItemStatus = await Promise.all(cacheItemStatus.map(checkAsset))
        if (!cacheItemStatus.find(({ alreadyPresent }) => (!alreadyPresent))) {
            return
        }
    }
    const { instance } = await assetMetaData.fetch()
    //
    // Instanced stories are not directly cached, they are instantiated ... so
    // this would be a miscall, and should be ignored.
    //
    if (instance) {
        return
    }
    const secondPassNormal = await globalizeDBEntries(assetId, firstPassNormal)

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
