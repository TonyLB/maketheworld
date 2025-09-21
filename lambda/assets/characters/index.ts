import { AssetsDataSource } from '../dataSource/abstract'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { isStandardComponentData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import getCurrentTimestamp from '../internalUtils/dateUtil'
import { CharacterEventSerializer, CharacterEventUpdate } from './serializers'
import { ComponentEventUpdate, isAssetsComponentEvent } from '../dataSource/serializers'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// Types for the characters data source
export type CharacterEventPayload = {
    characterId: `CHARACTER#${string}`
    wml: string // WML string containing character data
}

export type CharacterSnapshotPayload = {
    streamKey: string // assetId for this character stream
    characters: string // WML string containing character listings for this asset
    timestamp: number
}

// The characters data source subscribes to ComponentEventUpdate events from mtw.assets
// These come wrapped in StreamingEventPayload format on the messageBus

// Helper functions for character data source functionality

const generateCharacterSnapshot = async (assetId: string): Promise<CharacterSnapshotPayload> => {
    // Query for all character components in this asset
    const queryResult = await assetDB.query({
        IndexName: 'DataCategoryIndex',
        Key: { DataCategory: assetId },
        KeyConditionExpression: 'begins_with(AssetId, :prefix)',
        ExpressionAttributeValues: {
            ':prefix': 'CHARACTER#'
        },
        allFields: true
    })

    // Transform DynamoDB records to StandardComponentData format and create StandardCharacter instances
    const characterComponents = (queryResult || [])
        .map(character => {
            const { AssetId, DataCategory, ...rest } = character
            
            // Transform to StandardComponentData format
            const componentData = {
                universalKey: AssetId as ComponentUUID,
                tag: 'Character' as const,
                ...rest
            }
            
            // Validate the data format
            if (!isStandardComponentData(componentData)) {
                console.warn(`Invalid character component data for ${AssetId}:`, componentData)
                return undefined
            }
            
            // Create StandardCharacter instance
            return standardComponentFactory(componentData)
        })
        .filter(excludeUndefined)

    // Create a StandardForm with the asset and all character components
    const assetKey = assetId.replace('ASSET#', '') // Extract key from AssetUUID
    const standardForm = new StandardForm([
        { tag: 'Asset', key: assetKey, universalKey: assetId as ComponentUUID },
        ...characterComponents.map(component => component.toJSON())
    ])

    // Convert the entire StandardForm to WML
    const characterWML = schemaToWML([standardForm.schema])

    return {
        streamKey: assetId,
        characters: characterWML,
        timestamp: getCurrentTimestamp()
    }
}

const processComponentEvent = async (
    event: StreamingEventPayload, 
    streamEvent: (params: { update: CharacterEventUpdate, streamKey: string, detailType: string }) => Promise<void>
): Promise<void> => {
    const streamKey = event.event.streamKey
    const update = event.event.update

    // Check if this is a component event and if it's a character component
    if (!isAssetsComponentEvent(update)) {
        return
    }

    if (update.type === 'Component Updated') {
        // Check if this is a character component
        if (!(update.component instanceof StandardCharacter)) {
            return
        }

        // Generate character updated event with StandardComponent object
        await streamEvent({
            update: {
                type: 'Character Updated',
                component: update.component // Pass the StandardComponent object directly
            },
            streamKey,
            detailType: 'Character Updated'
        })
    } else if (update.type === 'Component Removed') {
        // Check if this is a character component (by componentId)
        if (!update.componentId || !update.componentId.startsWith('CHARACTER#')) {
            return
        }

        // Generate character removed event (no component object available)
        await streamEvent({
            update: {
                type: 'Character Removed',
                characterId: update.componentId as `CHARACTER#${string}` // Need characterId for removal events
            },
            streamKey,
            detailType: 'Character Removed'
        })
    }
}

// Create the characters data source singleton
export const charactersDataSource = new AssetsDataSource<
    CharacterSnapshotPayload,
    CharacterEventUpdate,
    StreamingEventPayload
>({
    dataSourceKey: 'mtw.assets.characters',
    replayable: true,
    eventSerializer: new CharacterEventSerializer(), // Handle character event serialization
    subscribedEventTypeGuard: (event: any): event is StreamingEventPayload => {
        // Subscribe to mtw.assets component events that might be character changes
        return event.dataSourceKey === 'mtw.assets' && 
               event.event && 
               typeof event.event === 'object' &&
               event.event.update &&
               typeof event.event.update === 'object' &&
               isAssetsComponentEvent(event.event.update)
    },
    snapshotContentGenerator: generateCharacterSnapshot,
    receiveEvents: async ({ events, streamEvent }) => {
        // Process component events in parallel - each event is independent
        await Promise.all(events.map(async (event) => {
            // Check if this event should be processed by this data source
            const subscribedEventTypeGuard = (event: any): event is StreamingEventPayload => {
                return event.dataSourceKey === 'mtw.assets' && 
                       event.event && 
                       typeof event.event === 'object' &&
                       event.event.update &&
                       typeof event.event.update === 'object' &&
                       isAssetsComponentEvent(event.event.update)
            }
            
            if (!subscribedEventTypeGuard(event)) {
                return
            }
            await processComponentEvent(event, streamEvent)
        }))
    }
})

export default charactersDataSource
