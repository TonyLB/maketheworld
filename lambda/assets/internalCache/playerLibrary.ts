import { splitType } from '@tonylb/mtw-utilities/ts/types'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { LibraryAsset, LibraryCharacter } from '@tonylb/mtw-interfaces/ts/library'
import { CacheConstructor } from './baseClasses'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

type PlayerLibrary = {
    Assets: Record<string, LibraryAsset>;
    Characters: Record<string, LibraryCharacter>;
    draftURL: string;
}

export class CachePlayerLibraryData {
    PlayerLibraries: Record<string, PlayerLibrary> = {}
    clear() {
        this.PlayerLibraries = {}
    }
    async set(player: string, override: { Assets: Record<string, LibraryAsset | undefined>; Characters: Record<string, LibraryCharacter | undefined>}) {
        if (!(player in this.PlayerLibraries)) {
            await this.get(player)
        }
        Object.keys(override.Assets).forEach((key) => {
            const asset = override.Assets[key]
            if (asset) {
                this.PlayerLibraries[player].Assets[key] = asset
            }
            else if (key in this.PlayerLibraries[player].Assets) {
                delete this.PlayerLibraries[player].Assets[key]
            }
        })
        Object.keys(override.Characters).forEach((key) => {
            const character = override.Characters[key]
            if (character) {
                this.PlayerLibraries[player].Characters[key] = character
            }
            else if (key in this.PlayerLibraries[player].Characters) {
                delete this.PlayerLibraries[player].Characters[key]
            }
        })
    }
    async get(player: string): Promise<PlayerLibrary> {
        if (!(player in this.PlayerLibraries)) {
            const Items = await assetDB.query({
                IndexName: 'PlayerIndex',
                Key: {
                    player
                },
                KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
                ExpressionAttributeValues: {
                    ':dcPrefix': 'Meta::'
                },
                ProjectionFields: ['AssetId', 'DataCategory', 'Connected', 'RoomId', 'Name', 'fileURL', 'Pronouns', 'zone', 'shortName', 'summary']
            })
            const Characters = {} as Record<string, LibraryCharacter>
            const Assets = Items
                .filter(({ DataCategory }) => (DataCategory === 'Meta::Asset'))
                .map(({ AssetId, Story, instance, zone, shortName, summary }) => ({ AssetId: splitType(AssetId)[1], Story, instance, zone, ShortName: shortName, Summary: summary }))
                .reduce((previous, item) => ({ ...previous, [item.AssetId]: item }), {} as Record<string, LibraryAsset>)
            this.PlayerLibraries[player] = {
                Characters,
                Assets,
                draftURL: ''
            }
        }
        return this.PlayerLibraries[player] || { Characters: {}, Assets: {}, draftURL: '' }
    }
}
