import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { Graph } from "@tonylb/mtw-utilities/ts/graphStorage/utils/graph"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import internalCache from "../internalCache";

/**
 * Phase 1B: Simplified inheritance graph
 * Only stores asset key - address was never used by FetchImportsJSONHelper
 */
export class InheritanceGraph extends Graph<EphemeraAssetId, { key: EphemeraAssetId }, {}> {}

export class FetchImportsJSONHelper {
    _inheritanceGraph: InheritanceGraph
    constructor(inheritanceGraph: InheritanceGraph) {
        this._inheritanceGraph = inheritanceGraph
    }

    async get(assetId: EphemeraAssetId): Promise<StandardForm> {
        const node = this._inheritanceGraph.nodes[assetId]
        if (node) {
            return (await internalCache.AssetData.get([assetId]))?.[0]?.standardForm ?? new StandardForm(assetId)
        }
        else {
            return new StandardForm(assetId)
        }
    }
}

