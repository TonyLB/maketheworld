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
import { CharacterEventSerializer, CharacterEventUpdate, CharacterSnapshotPayload } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/characters'
import { ComponentEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { CharactersSubscribedContent, isCharactersSubscribedEnvelope, isCharactersComponentEnvelope } from './subscribedEvents'

// Types for the characters data source
export type CharacterEventPayload = {
    characterId: `CHARACTER#${string}`
    wml: string // WML string containing character data
}

export type { CharacterSnapshotPayload } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/characters'

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
    event: StreamingEventEnvelope<ComponentEventUpdate>,
    streamEvent: (params: { update: CharacterEventUpdate; streamKey: string; header: { type: string } }) => Promise<void>
): Promise<void> => {
    const streamKey = event.header.streamKey
    const content = await event.getContent()

    // Content is already narrowed by envelope (Component Updated | Component Removed). We only care about StandardCharacter.
    const component = content.component
    if (!(component instanceof StandardCharacter)) {
        return
    }

    // Generate character updated event with StandardComponent object
    await streamEvent({
        update: { type: 'Character Updated', component },
        streamKey,
        header: { type: 'Character Updated' }
    })
}

// Create the characters data source singleton
export const charactersDataSource = new AssetsDataSource<
    CharacterSnapshotPayload,
    CharacterEventUpdate,
    CharactersSubscribedContent
>({
    dataSourceKey: 'mtw.assets.characters',
    outboundBusDelivery: 'publish',
    replayable: true,
    eventSerializer: new CharacterEventSerializer(), // Handle character event serialization
    subscribedEventTypeGuard: isCharactersSubscribedEnvelope,
    snapshotContentGenerator: generateCharacterSnapshot,
    receiveEvents: async ({ events, streamEvent, streamEnvelope }) => {
        // Route on envelope (header) first; only resolve content for component events
        await Promise.all(events.map(async (event) => {
            if (!isCharactersComponentEnvelope(event)) {
                return
            }
            await processComponentEvent(event, streamEvent)
        }))
    }
})

// Subscribe the DataSource to the messageBus for event processing
charactersDataSource.subscribe()

export default charactersDataSource
