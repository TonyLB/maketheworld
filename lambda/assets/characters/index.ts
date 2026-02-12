import { AssetsDataSource } from '../dataSource/abstract'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { isStandardComponentData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { ComponentUUID, isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import getCurrentTimestamp from '../internalUtils/dateUtil'
import { CharacterEventSerializer, CharacterEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/characters'
import { isAssetsComponentEvent, ComponentEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { StreamingEventHeader, StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'

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
    if (!isSchemaAssetUUID(assetId)) {
        console.warn(`Invalid asset ID: ${assetId}`)
        throw new Error(`Invalid asset ID: ${assetId}`)
    }
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
            const { component } = standardComponentFactory(componentData)
            return component
        })
        .filter(excludeUndefined)

    // Create a StandardForm with the asset and all character components
    const standardForm = new StandardForm([
        { tag: 'Asset', universalKey: assetId, topLevel: new ReferenceList(characterComponents.map(component => component.reference)).toJSON() },
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
    event: StreamingEventEnvelope<unknown>,
    streamEvent: (params: { update: CharacterEventUpdate, streamKey: string }) => Promise<void>
): Promise<void> => {
    const streamKey = event.header.streamKey
    const update = event.content as any

    // Check if this is a component event and if it's a character component
    if (!isAssetsComponentEvent(update)) {
        return
    }

    // For characters, both content edits and full removals are interesting.
    // We rely on the component type, not the specific update type, to decide.
    const component = (update as any).component
    if (!(component instanceof StandardCharacter)) {
        return
    }

    // Generate character updated event with StandardComponent object
    await streamEvent({
        update: {
            type: 'Character Updated',
            component
        },
        streamKey
    })
}

// Create the characters data source singleton
const CONTENT_HEADER_TYPES = new Set(['Component Updated', 'Component Removed'])

/** Payload types of events mtw.assets.characters subscribes to (mtw.assets component events). */
type CharactersSubscribedContent = ComponentEventUpdate

export const charactersDataSource = new AssetsDataSource<
    CharacterSnapshotPayload,
    CharacterEventUpdate,
    CharactersSubscribedContent
>({
    dataSourceKey: 'mtw.assets.characters',
    replayable: true,
    eventSerializer: new CharacterEventSerializer(), // Handle character event serialization
    subscribedEventTypeGuard: (header: StreamingEventHeader): boolean => {
        // Subscribe to mtw.assets component events that might be character changes
        return header.dataSourceKey === 'mtw.assets' && CONTENT_HEADER_TYPES.has(header.type)
    },
    snapshotContentGenerator: generateCharacterSnapshot,
    receiveEvents: async ({ events, streamEvent }) => {
        // Process component events in parallel - each event is independent
        await Promise.all(events.map(async (event) => {
            if (!isAssetsComponentEvent(event.content)) {
                return
            }
            await processComponentEvent(event, streamEvent)
        }))
    }
})

// Subscribe the DataSource to the messageBus for event processing
charactersDataSource.subscribe()

export default charactersDataSource
