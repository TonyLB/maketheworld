import { componentTagFromUpperCase } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/abstract'
import { defaultComponentFromTag } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { AssetUUID, ComponentUUID, isSchemaAssetUUID, isSchemaComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { cacheKeyComponents } from './keys'

export const tagFromEphemeraWrappedId = (ephemeraId: string) => {
    const parts = ephemeraId.split('#')
    if (parts.length !== 2) {
        throw new Error(`Invalid ephemera ID format: ${ephemeraId}`)
    }
    return componentTagFromUpperCase(parts[0] as any)
}

export const defaultStoredEntryForCacheKey = (cacheKey: string): { assetId: AssetUUID; component: StandardComponent } => {
    if (typeof cacheKey !== 'string' || !cacheKey.includes('::')) {
        throw new Error('Invalid cache key format in ComponentData internalCache')
    }
    const { assetId, EphemeraId } = cacheKeyComponents(cacheKey as `${AssetUUID}::${ComponentUUID}`)
    if (!isSchemaComponentUUID(EphemeraId)) {
        throw new Error('Invalid EphemeraId in ComponentData internalCache')
    }
    if (!isSchemaAssetUUID(assetId)) {
        throw new Error('Invalid assetId in ComponentData internalCache')
    }
    const tag = tagFromEphemeraWrappedId(EphemeraId)
    const defaultData = defaultComponentFromTag(tag, undefined, EphemeraId)
    const { component: defaultComponent } = standardComponentFactory(defaultData)
    if (!defaultComponent) {
        throw new Error(`No default component found for tag ${tag} and EphemeraId ${EphemeraId}`)
    }
    return {
        assetId,
        component: defaultComponent,
    }
}
