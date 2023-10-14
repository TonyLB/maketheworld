import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses";
import { JSONFileCache } from "../internalCache/jsonFile";
import internalCache from "../internalCache";

export class FetchImportsJSONHelper {
    constructor() {

    }

    async get(assetId: EphemeraAssetId): Promise<JSONFileCache> {
        return await internalCache.JSONFile.get(assetId)
    }
}

