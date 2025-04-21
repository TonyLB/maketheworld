import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { Graph } from "@tonylb/mtw-utilities/ts/graphStorage/utils/graph"
import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import internalCache from "../internalCache";

export class InheritanceGraph extends Graph<EphemeraAssetId, { key: EphemeraAssetId; address: AssetWorkspaceAddress }, {}> {}

export class FetchImportsJSONHelper {
    _inheritanceGraph: InheritanceGraph
    constructor(inheritanceGraph: InheritanceGraph) {
        this._inheritanceGraph = inheritanceGraph
    }

    async get(assetId: EphemeraAssetId): Promise<StandardForm> {
        const node = this._inheritanceGraph.nodes[assetId]
        if (node) {
            return (await internalCache.AssetData.get([assetId]))?.[0]?.standardForm ?? new StandardForm('')
        }
        else {
            return new StandardForm('')
        }
    }
}

