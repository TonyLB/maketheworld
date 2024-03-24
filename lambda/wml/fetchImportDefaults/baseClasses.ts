import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { Graph } from "@tonylb/mtw-utilities/dist/graphStorage/utils/graph"
import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/ts/"
import AssetWorkspace from "@tonylb/mtw-asset-workspace/ts/"
import { NamespaceMapping } from "@tonylb/mtw-asset-workspace/ts/readOnly"
import { SerializableStandardForm } from "@tonylb/mtw-wml/ts/standardize/baseClasses"

type JSONFileCache = {
    standard: SerializableStandardForm;
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
            const assetWorkspace = new AssetWorkspace(node.address)
            await assetWorkspace.loadJSON()
            return {
                standard: assetWorkspace.standard ?? { key: '', tag: 'Asset', byId: {}, metaData: [] },
                namespaceIdToDB: assetWorkspace.namespaceIdToDB || []
            }    
        }
        else {
            return {
                standard: { key: '', tag: 'Asset', byId: {}, metaData: [] },
                namespaceIdToDB: []
            }
        }
    }
}

