import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'
import {
    EphemeraCharacter
} from './baseClasses'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { MessageBus } from '../messageBus/baseClasses'
import {
    EphemeraAssetId,
    EphemeraCharacterId,
    EphemeraRoomId,
    isEphemeraAssetId
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import { CharacterMetaItem } from '../internalCache/characterMeta'
import ReadOnlyAssetWorkspace, { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { graphStorageDB } from '../dependentMessages/graphCache'
import GraphUpdate from '@tonylb/mtw-utilities/ts/graphStorage/update'
import { excludeUndefined, unique } from '@tonylb/mtw-utilities/ts/lists'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'

export const pushCharacterEphemera = async (character: Omit<EphemeraCharacter, 'address' | 'Connected' | 'ConnectionIds'> & { address?: AssetWorkspaceAddress; Connected?: boolean; ConnectionIds?: string[] }, meta?: CharacterMetaItem) => {
    const updateKeys: (keyof EphemeraCharacter)[] = ['address', 'Pronouns', 'fileURL', 'Color', 'player']
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
    
        const graphUpdate = new GraphUpdate({ internalCache: internalCache._graphCache as any, dbHandler: graphStorageDB })

        const assets = unique(
            (assetWorkspace.standard?._components ?? [])
                .map((component) => (component._from))
                .filter(excludeUndefined)
        )

        graphUpdate.setEdges([{
            itemId: AssetKey(assetId),
            edges: assets
                .map((from) => ({ target: from, context: '' })),
            options: { direction: 'back' }
        }])

        await Promise.all([
            graphUpdate.flush(),
        ])

        //
        // Use MessageBus to queue RoomHeader messages for any room that has a person to
        // report to
        //
        // TODO: Optimize RoomHeader messages to only deliver to characters who have
        // the asset that is being cached
        //
        const components = assetWorkspace.standard?._components || []
        components
            .filter((item) => (item instanceof StandardRoom))
            .map((room) => (room.universalKey))
            .filter((value): value is EphemeraRoomId => (Boolean(value)))
            .forEach((roomId) => {
                messageBus.send({
                    type: 'Perception',
                    ephemeraId: roomId,
                    header: true
                })
            })
    }

}
