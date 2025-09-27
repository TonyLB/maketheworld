import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import extractHeader from './extractHeader'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { 
    ContentHeadersEventUpdate, 
    ContentHeadersSnapshot, 
    ContentHeadersUpdate,
    isContentHeadersSnapshot,
    isContentHeadersUpdate
} from './baseClasses'
import { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'

// External event format (EventBridge) - using WML strings
export type ContentHeadersSnapshotExternal = {
    type: 'Snapshot Generated'
    assets: Array<{
        assetId: AssetUUID
        zone: Zone
        wml: string // Serialized to WML for external consumption
    }>
}

export type ContentHeadersUpdateExternal = {
    type: 'Headers Updated'
    assetId: AssetUUID
    zone: Zone
    wml: string // Serialized to WML for external consumption
}

export type ContentHeadersExternal = {
    type: 'Snapshot Generated' | 'Headers Updated'
    data: ContentHeadersSnapshotExternal | ContentHeadersUpdateExternal
}


/**
 * Event serializer for the mtw.assets.contentHeaders data source.
 * 
 * This serializer implements the serialization boundary between internal StandardForm objects
 * and external WML strings. Internal processing works with StandardForm objects for manipulation,
 * while external transmission uses WML strings for cross-service communication.
 */
export class ContentHeadersEventSerializer implements DataSourceEventSerializer<ContentHeadersEventUpdate, ContentHeadersExternal> {
    serialize(params: {
        dataSourceKey: string;
        detailType: string;
        streamKey: string;
        update: ContentHeadersEventUpdate;
    }): ContentHeadersExternal {
        const { update } = params
        
        if (isContentHeadersSnapshot(update)) {
            // Convert internal StandardForm objects to external WML strings
            const externalAssets = update.assets.map(asset => ({
                assetId: asset.assetId,
                zone: asset.zone,
                wml: schemaToWML([asset.standardForm.schema])
            }))
            
            return {
                type: 'Snapshot Generated',
                data: {
                    type: 'Snapshot Generated',
                    assets: externalAssets
                }
            }
        } else if (isContentHeadersUpdate(update)) {
            // Convert internal StandardForm object to external WML string
            return {
                type: 'Headers Updated',
                data: {
                    type: 'Headers Updated',
                    assetId: update.assetId,
                    zone: update.zone,
                    wml: schemaToWML([update.standardForm.schema])
                }
            }
        } else {
            throw new Error(`Unknown event type in ContentHeadersEventUpdate: ${JSON.stringify(update)}`)
        }
    }
    
    deserialize(params: { 
        dataSourceKey: string
        detailType: string
        streamKey: string
        externalUpdate: ContentHeadersExternal 
    }): ContentHeadersEventUpdate | null {
        const { externalUpdate } = params
        
        if (externalUpdate.type === 'Snapshot Generated') {
            const snapshotExternal = externalUpdate.data as ContentHeadersSnapshotExternal
            // Convert external WML strings to internal StandardForm objects
            const internalAssets = snapshotExternal.assets.map(asset => ({
                assetId: asset.assetId,
                zone: asset.zone,
                standardForm: new StandardForm(asset.wml)
            }))
            
            const result: ContentHeadersSnapshot = {
                type: 'Snapshot Generated',
                assets: internalAssets
            }
            return result
        } else if (externalUpdate.type === 'Headers Updated') {
            const updateExternal = externalUpdate.data as ContentHeadersUpdateExternal
            // Convert external WML string to internal StandardForm object
            const result: ContentHeadersUpdate = {
                type: 'Headers Updated',
                assetId: updateExternal.assetId,
                zone: updateExternal.zone,
                standardForm: new StandardForm(updateExternal.wml)
            }
            return result
        } else {
            throw new Error(`Unknown external event type: ${externalUpdate.type}`)
        }
    }
}

/**
 * Utility function to extract component metadata as a StandardForm.
 * 
 * This function takes a StandardComponent and extracts its header information,
 * returning it as a StandardForm object for internal processing.
 */
export const extractComponentMetadata = (component: StandardComponent): StandardForm | null => {
    const header = extractHeader(component)
    if (!header) {
        return null
    }
    
    // Create a StandardForm containing just the header component
    return new StandardForm([header.toJSON()])
}

/**
 * Utility function to create a content headers snapshot asset entry.
 * 
 * This function takes an asset ID, zone, and component and creates a properly
 * formatted asset entry for content headers snapshots using internal StandardForm representation.
 */
export const createContentHeadersAsset = (
    assetId: AssetUUID,
    zone: 'Canon' | 'Library' | 'Personal',
    component: StandardComponent
): { assetId: AssetUUID; zone: 'Canon' | 'Library' | 'Personal'; standardForm: StandardForm } | null => {
    const standardForm = extractComponentMetadata(component)
    if (!standardForm) {
        return null
    }
    
    return {
        assetId,
        zone,
        standardForm
    }
}

/**
 * Utility function to create a content headers update event.
 * 
 * This function takes an asset ID, zone, and component and creates a properly
 * formatted update event for content headers streaming using internal StandardForm representation.
 */
export const createContentHeadersUpdate = (
    assetId: AssetUUID,
    zone: 'Canon' | 'Library' | 'Personal',
    component: StandardComponent
): ContentHeadersUpdate | null => {
    const standardForm = extractComponentMetadata(component)
    if (!standardForm) {
        return null
    }
    
    return {
        type: 'Headers Updated',
        assetId,
        zone,
        standardForm
    }
}
