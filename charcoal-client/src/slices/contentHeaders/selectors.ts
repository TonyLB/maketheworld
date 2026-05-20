// Content Headers Selectors
//
// Helper selectors to extract and filter content headers data from the materialized view

import { contentHeadersSelectors } from './index'
import { ContentHeadersSnapshot } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/contentHeaders'
import { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardImage from '@tonylb/mtw-wml/ts/standardize/components/image'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'

/**
 * Get the materialized view from the contentHeaders data source
 */
export const getContentHeadersMaterializedView = (state: any): ContentHeadersSnapshot | null => {
    const streams = contentHeadersSelectors.getSubscribedStreams(state)
    const globalStream = streams['global']
    return globalStream?.materializedView ?? null
}

/**
 * Get assets filtered by zone
 */
export const getContentHeadersByZone = (state: any, zone: Zone): Array<{
    assetId: AssetUUID
    zone: Zone
    standardForm: any
}> => {
    const materializedView = getContentHeadersMaterializedView(state)
    if (!materializedView) {
        return []
    }
    return materializedView.assets.filter(asset => asset.zone === zone)
}

/**
 * Get components for a specific asset
 */
export const getComponentsForAsset = (state: any, assetId: AssetUUID): readonly StandardComponent[] => {
    const materializedView = getContentHeadersMaterializedView(state)
    if (!materializedView) {
        return []
    }
    const asset = materializedView.assets.find(a => a.assetId === assetId)
    if (!asset) {
        return []
    }
    return asset.standardForm.components || []
}

/**
 * Group components by type
 */
export type ComponentGroup = {
    type: 'Room' | 'Feature' | 'Knowledge' | 'Map' | 'Image' | 'Character'
    components: StandardComponent[]
}

export const groupComponentsByType = (components: StandardComponent[]): ComponentGroup[] => {
    const groups: ComponentGroup[] = [
        { type: 'Room', components: [] },
        { type: 'Feature', components: [] },
        { type: 'Knowledge', components: [] },
        { type: 'Map', components: [] },
        { type: 'Image', components: [] },
        { type: 'Character', components: [] }
    ]

    components.forEach(component => {
        if (component instanceof StandardRoom) {
            groups[0].components.push(component)
        } else if (component instanceof StandardFeature) {
            groups[1].components.push(component)
        } else if (component instanceof StandardKnowledge) {
            groups[2].components.push(component)
        } else if (component instanceof StandardMap) {
            groups[3].components.push(component)
        } else if (component instanceof StandardImage) {
            groups[4].components.push(component)
        } else if (component instanceof StandardCharacter) {
            groups[5].components.push(component)
        }
    })

    // Filter out empty groups
    return groups.filter(group => group.components.length > 0)
}
