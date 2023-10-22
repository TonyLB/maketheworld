import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { Graph } from "@tonylb/mtw-utilities/dist/graphStorage/utils/graph"
import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace"
import ReadOnlyAssetWorkspace from "@tonylb/mtw-asset-workspace/dist/readOnly"
import { NamespaceMapping } from "@tonylb/mtw-asset-workspace/ts/readOnly"
import { NormalForm } from "@tonylb/mtw-normal"

type JSONFileCache = {
    normal: NormalForm;
    namespaceIdToDB: NamespaceMapping;
}

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
                namespaceIdToDB: assetWorkspace.namespaceIdToDB || []
            }    
        }
        else {
            return {
                normal: {},
                namespaceIdToDB: []
            }
        }
    }
}

