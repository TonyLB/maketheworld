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
    async set(player: string, override: { Assets: Record<string, LibraryAsset | undefined>; Characters: Record<string, LibraryCharacter | undefined>}) {
        if (!(player in this.CharacterLibraries)) {
            await this.get(player)
        }
        Object.keys(override.Assets).forEach((key) => {
            const asset = override.Assets[key]
            if (asset) {
                this.CharacterLibraries[player].Assets[key] = asset
            }
            else if (key in this.CharacterLibraries[player].Assets) {
                delete this.CharacterLibraries[player].Assets[key]
            }
        })
        Object.keys(override.Characters).forEach((key) => {
            const character = override.Characters[key]
            if (character) {
                this.CharacterLibraries[player].Characters[key] = character
            }
            else if (key in this.CharacterLibraries[player].Characters) {
                delete this.CharacterLibraries[player].Characters[key]
            }
        })
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
                ProjectionFields: ['AssetId', 'DataCategory', 'Connected', 'RoomId', '#name', 'images', 'FirstImpression', 'Pronouns', 'OneCoolThing', 'Outfit', 'scopedId']
            })
            const Characters = Items
                .filter(({ DataCategory }) => (DataCategory === 'Meta::Character'))
                .map(({ AssetId, Name, scopedId, fileName, images, FirstImpression, Pronouns, OneCoolThing, Outfit }) => ({ CharacterId: AssetId as EphemeraCharacterId, Name, scopedId, fileName, fileURL: images?.length ? images[0] : undefined, Pronouns, FirstImpression, OneCoolThing, Outfit }))
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
