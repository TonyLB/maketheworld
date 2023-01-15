import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { LibraryAsset, LibraryCharacter } from '@tonylb/mtw-interfaces/dist/library'
import { CacheConstructor } from './baseClasses'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'

type PlayerLibrary = {
    Assets: Record<string, LibraryAsset>;
    Characters: Record<string, LibraryCharacter>
}

export class CachePlayerLibraryData {
    CharacterLibraries: Record<string, PlayerLibrary> = {}
    clear() {
        this.CharacterLibraries = {}
    }
    async get(player: string): Promise<PlayerLibrary> {
        if (!(player in this.CharacterLibraries)) {
            const Items = await assetDB.query({
                IndexName: 'PlayerIndex',
                player,
                KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
                ExpressionAttributeValues: {
                    ':dcPrefix': 'Meta::'
                },
                ExpressionAttributeNames: {
                    '#name': 'Name'
                },
                ProjectionFields: ['AssetId', 'DataCategory', 'Connected', 'RoomId', '#name', 'fileURL', 'FirstImpression', 'Pronouns', 'OneCoolThing', 'Outfit', 'scopedId']
            })
            const Characters = Items
                .filter(({ DataCategory }) => (DataCategory === 'Meta::Character'))
                .map(({ AssetId, Name, scopedId, fileName, fileURL, FirstImpression, Pronouns, OneCoolThing, Outfit }) => ({ CharacterId: AssetId as EphemeraCharacterId, Name, scopedId, fileName, fileURL, Pronouns, FirstImpression, OneCoolThing, Outfit }))
                .reduce((previous, item) => ({ ...previous, [item.CharacterId]: item }), {} as Record<string, LibraryCharacter>)
            const Assets = Items
                .filter(({ DataCategory }) => (DataCategory === 'Meta::Asset'))
                .map(({ AssetId, scopedId, Story, instance }) => ({ AssetId: splitType(AssetId)[1], scopedId, Story, instance }))
                .reduce((previous, item) => ({ ...previous, [item.AssetId]: item }), {} as Record<string, LibraryAsset>)            
            this.CharacterLibraries[player] = {
                Characters,
                Assets
            }
        }
        return this.CharacterLibraries[player] || { Characters: {}, Assets: {} }
    }
}

export const CachePlayerLibrary = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CachePlayerLibrary extends Base {
        PlayerLibrary: CachePlayerLibraryData = new CachePlayerLibraryData()

        override clear() {
            this.PlayerLibrary.clear()
            super.clear()
        }
    }
}

export default CachePlayerLibrary
