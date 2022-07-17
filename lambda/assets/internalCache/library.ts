import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
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
                ProjectionFields: ['AssetId', 'DataCategory', 'Connected', 'RoomId', '#name', 'fileURL', 'FirstImpression', 'Pronouns', 'OneCoolThing', 'Outfit']
            })
            this.Characters = Items
                .filter(({ DataCategory }) => (DataCategory === 'Meta::Character'))
                .map(({ AssetId, Name, scopedId, fileName, fileURL, FirstImpression, Pronouns, OneCoolThing, Outfit }) => ({ CharacterId: splitType(AssetId)[1], Name, scopedId, fileName, fileURL, Pronouns, FirstImpression, OneCoolThing, Outfit }))
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
