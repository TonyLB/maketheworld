import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { JSONFileCache } from "../internalCache/jsonFile"
import { Graph } from "@tonylb/mtw-utilities/dist/graphStorage/utils/graph"
import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace"
import ReadOnlyAssetWorkspace from "@tonylb/mtw-asset-workspace/dist/readOnly"

export class InheritanceGraph extends Graph<EphemeraAssetId, { key: EphemeraAssetId; address: AssetWorkspaceAddress }, {}> {}

export class FetchImportsJSONHelper {
    _inheritanceGraph: InheritanceGraph
    constructor(inheritanceGraph: InheritanceGraph) {
        this._inheritanceGraph = inheritanceGraph
    }

    async get(assetId: EphemeraAssetId): Promise<JSONFileCache> {
        const node = this._inheritanceGraph.nodes[assetId]
        if (node) {
            const assetWorkspace = new ReadOnlyAssetWorkspace(node.address)
            await assetWorkspace.loadJSON()
            return {
                normal: assetWorkspace.normal || {},
                namespaceIdToDB: assetWorkspace.namespaceIdToDB || {}
            }    
        }
        else {
            return {
                normal: {},
                namespaceIdToDB: {}
            }
        }
    }
}

