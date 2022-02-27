import {
    assetDB,
    ephemeraDB
} from '/opt/utilities/dynamoDB/index.js'
import { splitType, AssetKey } from '/opt/utilities/types.js'

export class AssetMetaData extends Object {
    constructor(assetId) {
        super()
        this.assetId = assetId
    }

    async fetch() {
        const { fileName = '', importTree = {}, instance } = await assetDB.getItem({
            AssetId: AssetKey(this.assetId),
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['fileName', 'importTree', 'instance']
        })
        this.fileName = fileName
        this.importTree = importTree
        this.instance = instance
        return { fileName, importTree, instance }
    }

    async checkEphemera() {
        if (this.ephemeraChecked === undefined) {
            const { EphemeraId = null } = await ephemeraDB.getItem({
                EphemeraId: AssetKey(this.assetId),
                DataCategory: 'Meta::Asset',
            })
            this.ephemeraChecked = Boolean(EphemeraId)
        }
        return this.ephemeraChecked
    }

    async pushEphemera() {
        await ephemeraDB.putItem({
            EphemeraId: AssetKey(this.assetId),
            DataCategory: 'Meta::Asset',
            State: this.state || {},
            Dependencies: this.dependencies || {
                room: [],
                computed: []
            },
            Actions: this.actions || {},
            importTree: this.importTree || {},
            scopeMap: this.scopeMap
        })
    }
}

export default AssetMetaData
