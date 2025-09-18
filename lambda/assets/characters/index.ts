import { AssetsDataSource } from '../dataSource/abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { isStandardComponentData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import getCurrentTimestamp from '../internalUtils/dateUtil'

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

export type ComponentEventPayload = StreamingEventPayload & {
    dataSourceKey: 'mtw.assets'
    event: {
        detailType: 'Component Updated' | 'Component Removed'
        streamKey: string
        update: any
        timestamp: number
    }
}

// Helper functions for character data source functionality
const isCharacterComponent = (component: any): boolean => {
    return component && 
           typeof component === 'object' && 
           component.tag?.toLowerCase() === 'character'
}

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
    event: ComponentEventPayload, 
    streamEvent: (params: { update: CharacterEventPayload, streamKey: string, detailType: string }) => Promise<void>
): Promise<void> => {
    const component = event.event.update?.component
    
    // Check if this is a character component
    if (!isCharacterComponent(component)) {
        return
    }

    const characterId = component.characterId
    const streamKey = event.event.streamKey

    if (event.detailType === 'Component Updated') {
        // Generate character updated event
        const wml = component.wml || `<Character uuid=(${characterId}) />`
        await streamEvent({
            update: {
                characterId,
                wml
            },
            streamKey,
            detailType: 'Character Updated'
        })
    } else if (event.detailType === 'Component Removed') {
        // Generate character removed event - convert Character WML to CharacterRemoved
        let wml = component.wml || `<Remove><Character uuid=(${characterId}) /></Remove>`
        
        await streamEvent({
            update: {
                characterId,
                wml
            },
            streamKey,
            detailType: 'Character Removed'
        })
    }
}

// Create the characters data source singleton
export const charactersDataSource = new AssetsDataSource<
    CharacterSnapshotPayload,
    CharacterEventPayload,
    ComponentEventPayload
>({
    dataSourceKey: 'mtw.assets.characters',
    replayable: true,
    subscribedEventTypeGuard: (event: StreamingEventPayload): event is ComponentEventPayload => {
        // Subscribe to mtw.assets component events that might be character changes
        return event.dataSourceKey === 'mtw.assets' && 
               ['Component Updated', 'Component Removed'].includes(event.detailType)
    },
    snapshotContentGenerator: generateCharacterSnapshot,
    receiveEvents: async ({ event, streamEvent }) => {
        // Check if this event should be processed by this data source
        const subscribedEventTypeGuard = (event: StreamingEventPayload): event is ComponentEventPayload => {
            return event.dataSourceKey === 'mtw.assets' && 
                   ['Component Updated', 'Component Removed'].includes(event.detailType)
        }
        
        if (!subscribedEventTypeGuard(event)) {
            return
        }
        await processComponentEvent(event, streamEvent)
    }
})

export default charactersDataSource
