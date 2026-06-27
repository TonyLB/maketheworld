import {
    ComponentAggregateMergedCache,
    createComponentAggregateCacheHandler,
} from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import {
    createComponentDataCacheHandler,
    type ComponentDataCache,
} from '@tonylb/mtw-gateways/ts/assets/components/componentData'
import {
    ComponentExamplesMergedCache,
    createComponentExamplesCacheHandler,
} from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import {
    createImportVerticalMetaCacheHandler,
    type ImportVerticalMetaCache,
} from '@tonylb/mtw-gateways/ts/assets/components/verticals'
import {
    createRenderCacheCacheHandler,
    type RenderCacheCacheHandler,
} from '@tonylb/mtw-gateways/ts/ephemera/renderCache'
import {
    createImprovisationComponentDataCacheHandler,
    type ImprovisationComponentDataCache,
} from '@tonylb/mtw-gateways/ts/ephemera/improvisation'
import {
    createPositionsCacheHandler,
    type PositionsCacheHandler,
} from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import ObjectEphemeraMetaData from './objectEphemeraMeta'

class InternalCache {
    ComponentData: ComponentDataCache = createComponentDataCacheHandler(assetDB)
    ComponentVerticals: ImportVerticalMetaCache = createImportVerticalMetaCacheHandler(assetDB)
    ComponentAggregate: ComponentAggregateMergedCache
    ComponentExamples: ComponentExamplesMergedCache
    RenderCache: RenderCacheCacheHandler = createRenderCacheCacheHandler(ephemeraDB)
    ImprovisationComponentData: ImprovisationComponentDataCache = createImprovisationComponentDataCacheHandler(ephemeraDB)
    Positions: PositionsCacheHandler = createPositionsCacheHandler(ephemeraDB)
    ObjectEphemeraMeta: ObjectEphemeraMetaData = new ObjectEphemeraMetaData()

    constructor() {
        this.ComponentAggregate = createComponentAggregateCacheHandler({
            ComponentData: this.ComponentData,
            ComponentVerticals: this.ComponentVerticals,
        })
        this.ComponentExamples = createComponentExamplesCacheHandler({
            ComponentAggregate: this.ComponentAggregate,
        })
    }

    clear(): void {
        this.ComponentData.clear()
        this.ComponentVerticals.clear()
        this.ComponentAggregate.clear()
        this.ComponentExamples.clear()
        this.RenderCache.clear()
        this.ImprovisationComponentData.clear()
        this.Positions.clear()
        this.ObjectEphemeraMeta.clear()
    }

    async flush(): Promise<void> {
        await Promise.all([
            this.ComponentAggregate.flush(),
            this.ComponentExamples.flush(),
            this.RenderCache.flush(),
            this.ImprovisationComponentData.flush(),
            this.Positions.flush(),
        ])
    }
}

const internalCache = new InternalCache()
export default internalCache
