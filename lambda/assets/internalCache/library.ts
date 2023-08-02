import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { legacyAssetDB as assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { LibraryAsset, LibraryCharacter } from '../mtw-interfaces/dist/library'
import { CacheConstructor } from './baseClasses'

type CacheLibraryKeys = 'Assets' | 'Characters'

export class CacheLibraryData {
    Assets?: Record<string, LibraryAsset>
    Characters?: Record<string, LibraryCharacter>
    clear() {
        this.Assets = undefined
        this.Characters = undefined
    }
    async set(override: { Assets: Record<string, LibraryAsset | undefined>; Characters: Record<string, LibraryCharacter | undefined>}) {
        if (typeof this.Assets === 'undefined' && typeof this.Characters === 'undefined') {
            await this.get('Assets')
        }
        Object.keys(override.Assets).forEach((key) => {
            const asset = override.Assets[key]
            if (this.Assets) {
                if (asset) {
                    this.Assets[key] = asset
                }
                else if (key in this.Assets) {
                    delete this.Assets[key]
                }
            }
        })
        Object.keys(override.Characters).forEach((key) => {
            const character = override.Characters[key]
            if (this.Characters) {
                if (character) {
                    this.Characters[key] = character
                }
                else if (key in this.Characters) {
                    delete this.Characters[key]
                }
            }
        })
    }
    async get(key: 'Assets'): Promise<LibraryAsset[]>
    async get(key: 'Characters'): Promise<LibraryCharacter[]>
    async get(key: CacheLibraryKeys): Promise<LibraryAsset[] | LibraryCharacter[]> {
        if (Object.keys(this.Assets || {}).length + Object.keys(this.Characters || {}).length === 0) {
            const Items = await assetDB.query({
                IndexName: 'ZoneIndex',
                zone: 'Library',
                KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
                ExpressionAttributeValues: {
                    ':dcPrefix': 'Meta::'
                },
                ExpressionAttributeNames: {
                    '#name': 'Name'
                },
                ProjectionFields: ['AssetId', 'DataCategory', 'Connected', 'RoomId', '#name', 'images', 'FirstImpression', 'Pronouns', 'OneCoolThing', 'Outfit']
            })
            this.Characters = Items
                .filter(({ DataCategory }) => (DataCategory === 'Meta::Character'))
                .map(({ AssetId, Name, scopedId, fileName, images, FirstImpression, Pronouns, OneCoolThing, Outfit }) => ({ CharacterId: AssetId, Name, scopedId, fileName, fileURL: images?.length ? images[0] : undefined, Pronouns, FirstImpression, OneCoolThing, Outfit }))
                .reduce((previous, item) => ({ ...previous, [item.CharacterId]: item }), {} as Record<string, LibraryCharacter>)
            this.Assets = Items
                .filter(({ DataCategory }) => (DataCategory === 'Meta::Asset'))
                .map(({ AssetId, scopedId, Story, instance }) => ({ AssetId: splitType(AssetId)[1], scopedId, Story, instance }))
                .reduce((previous, item) => ({ ...previous, [item.AssetId]: item }), {} as Record<string, LibraryAsset>)
        }
        return Object.values(this[key] || {})
    }
}

export const CacheLibrary = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheConnection extends Base {
        Library: CacheLibraryData = new CacheLibraryData()

        override clear() {
            this.Library.clear()
            super.clear()
        }
    }
}

export default CacheLibrary
