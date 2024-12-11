import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { Graph } from "@tonylb/mtw-utilities/dist/graphStorage/utils/graph"
import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/ts/"
import AssetWorkspace from "@tonylb/mtw-asset-workspace/ts/"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"

export class InheritanceGraph extends Graph<EphemeraAssetId, { key: EphemeraAssetId; address: AssetWorkspaceAddress }, {}> {}

export class FetchImportsJSONHelper {
    _inheritanceGraph: InheritanceGraph
    constructor(inheritanceGraph: InheritanceGraph) {
        this._inheritanceGraph = inheritanceGraph
    }

    async get(assetId: EphemeraAssetId): Promise<StandardForm> {
        const node = this._inheritanceGraph.nodes[assetId]
        if (node) {
            const assetWorkspace = new AssetWorkspace(node.address)
            await assetWorkspace.loadJSON()
            return new StandardForm(assetWorkspace.standard ?? '')
        }
        else {
            return new StandardForm('')
        }
    }
}

