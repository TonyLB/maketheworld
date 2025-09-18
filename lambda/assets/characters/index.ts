import { AssetsDataSource } from '../dataSource/abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

// Types for the characters data source
export type CharacterEventPayload = {
    characterId: string
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
        }
    })

    // Generate WML character listings from query results
    const characterWML = (queryResult || [])
        .map(character => {
            const characterId = character.AssetId.replace('CHARACTER#', '')
            const shortName = character.ShortName || 'Unnamed Character'
            return `<Character key="${characterId}"><ShortName>${shortName}</ShortName></Character>`
        })
        .join('\n')

    return {
        streamKey: assetId,
        characters: characterWML,
        timestamp: Date.now()
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

    const characterId = component.characterId || 'unknown-character'
    const streamKey = event.event.streamKey

    if (event.event.detailType === 'Component Updated') {
        // Generate character updated event
        const wml = component.wml || `<Character key="${characterId}"><ShortName>Unnamed Character</ShortName></Character>`
        await streamEvent({
            update: {
                characterId,
                wml
            },
            streamKey,
            detailType: 'Character Updated'
        })
    } else if (event.event.detailType === 'Component Removed') {
        // Generate character removed event - convert Character WML to CharacterRemoved
        let wml = component.wml || `<Character key="${characterId}"><ShortName>Unnamed Character</ShortName></Character>`
        // Convert Character tags to CharacterRemoved tags
        wml = wml.replace(/<Character\b/g, '<CharacterRemoved').replace(/<\/Character>/g, '</CharacterRemoved>')
        
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
