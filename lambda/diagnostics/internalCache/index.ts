import {
    createAuthoritativeComponentDataCacheHandler,
    type AuthoritativeComponentDataCache,
} from '@tonylb/mtw-gateways/ts/assets/components/assetMeta'
import {
    createImportVerticalMetaCacheHandler,
    type ImportVerticalMetaCache,
} from '@tonylb/mtw-gateways/ts/assets/components/verticals'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

class InternalCache {
    ComponentData: AuthoritativeComponentDataCache = createAuthoritativeComponentDataCacheHandler(assetDB)
    ComponentVerticals: ImportVerticalMetaCache = createImportVerticalMetaCacheHandler(assetDB)

    clear(): void {
        this.ComponentData.clear()
        this.ComponentVerticals.clear()
    }
}

const internalCache = new InternalCache()
export default internalCache
