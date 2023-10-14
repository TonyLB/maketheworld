import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses";
import { JSONFileCache } from "../internalCache/jsonFile";
import internalCache from "../internalCache";
import { Graph } from "@tonylb/mtw-utilities/dist/graphStorage/utils/graph";
import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace";

export class InheritanceGraph extends Graph<EphemeraAssetId, { key: EphemeraAssetId; address: AssetWorkspaceAddress }, {}> {}

export class FetchImportsJSONHelper {
    _inheritanceGraph: InheritanceGraph
    constructor(inheritanceGraph: InheritanceGraph) {
        this._inheritanceGraph = inheritanceGraph
    }

    async get(assetId: EphemeraAssetId): Promise<JSONFileCache> {
        return await internalCache.JSONFile.get(assetId)
    }
}

