// Characters Sub-source Event Contracts
// 
// This file contains event types, type guards, and serializers for the Characters sub-source.
// Migrated from lambda/assets/characters/serializers.ts

import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { schemaToWML, nodeFromWML } from '@tonylb/mtw-wml/ts/schema'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'

// Internal types for character events (using StandardComponent objects)
export type CharacterEventUpdate = CharacterUpdatedEvent

export type CharacterUpdatedEvent = {
    type: 'Character Updated'
    component: StandardComponent // The actual component object for internal processing
}

export type CharacterEventExternal = CharacterUpdatedEventExternal

export type CharacterUpdatedEventExternal = {
    type: 'Character Updated'
    characterId: `CHARACTER#${string}`
    wml: string // WML string containing character data
}

/**
 * Event serializer for character events in the mtw.assets.characters data source.
 * 
 * This serializer handles the conversion between internal StandardComponent objects
 * and external EventBridge-compatible event formats for character-specific events.
 */
export class CharacterEventSerializer implements DataSourceEventSerializer<CharacterEventUpdate, CharacterEventExternal> {
    serialize(params: {
        content: CharacterEventUpdate;
        header: StreamingEventHeader;
    }): CharacterEventExternal {
        const { content, header } = params
        if (header.type !== 'Character Updated') {
            throw new Error(`Unknown character event type: ${header.type}`)
        }
        const characterId = content.component.universalKey as `CHARACTER#${string}`
        const wml = schemaToWML([content.component.schema])
        return {
            type: 'Character Updated',
            characterId,
            wml
        }
    }
    
    deserialize(params: {
        content: CharacterEventExternal;
        header: StreamingEventHeader;
    }): CharacterEventUpdate | null {
        const { content, header } = params
        
        // Only handle character updated events (header is authoritative for routing)
        if (header.type !== 'Character Updated') {
            return null
        }
        
        // Deserialize WML back to StandardComponent
        try {
            const schemaNode = nodeFromWML(content.wml)
            const { component } = standardComponentFactory(schemaNode)
            
            if (!component) {
                return null
            }
            
            return {
                // Treat payload type as derived from header.type
                type: header.type,
                component
            }
        } catch (error) {
            // If WML parsing fails, return null
            console.warn('Failed to deserialize character WML:', error)
            return null
        }
    }
}
