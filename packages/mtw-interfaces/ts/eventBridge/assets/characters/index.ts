// Characters Sub-source Event Contracts
// 
// This file contains event types, type guards, and serializers for the Characters sub-source.
// Migrated from lambda/assets/characters/serializers.ts

import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { schemaToWML, nodeFromWML } from '@tonylb/mtw-wml/ts/schema'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'

// Internal types for character events (no type; discrimination by header)
export type CharacterEventUpdate = CharacterUpdatedEvent

export type CharacterUpdatedEvent = {
    component: StandardComponent
}

export type CharacterEventExternal = CharacterUpdatedEventExternal

export type CharacterUpdatedEventExternal = {
    type: 'Character Updated'
    characterId: `CHARACTER#${string}`
    wml: string // WML string containing character data
}

// Snapshot types for mtw.assets.characters replayable data source
export type CharacterSnapshotPayload = {
    streamKey: string
    characters: string // WML string containing character listings for this asset
    timestamp: number
}

export type CharacterSnapshotExternal = {
    characters: string
}

/**
 * Event serializer for character events in the mtw.assets.characters data source.
 * 
 * This serializer handles the conversion between internal StandardComponent objects
 * and external EventBridge-compatible event formats for character-specific events.
 * Also supports snapshot serialize/deserialize for replayable character streams.
 */
export class CharacterEventSerializer implements DataSourceEventSerializer<
    CharacterEventUpdate,
    CharacterEventExternal,
    CharacterSnapshotPayload,
    CharacterSnapshotExternal
> {
    serialize(params: {
        content: CharacterEventUpdate | CharacterSnapshotPayload;
        header: StreamingEventHeader;
    }): CharacterEventExternal | CharacterSnapshotExternal {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            return this.serializeSnapshot(content as CharacterSnapshotPayload)
        }
        if (header.type !== 'Character Updated') {
            throw new Error(`Unknown character event type: ${header.type}`)
        }
        const characterId = (content as CharacterEventUpdate).component.universalKey as `CHARACTER#${string}`
        const wml = schemaToWML([(content as CharacterEventUpdate).component.schema])
        return {
            type: 'Character Updated',
            characterId,
            wml
        }
    }

    serializeSnapshot(snapshot: CharacterSnapshotPayload): CharacterSnapshotExternal {
        return { characters: snapshot.characters }
    }

    async deserializeSnapshot(externalSnapshot: CharacterSnapshotExternal): Promise<CharacterSnapshotPayload | null> {
        if (typeof externalSnapshot.characters !== 'string') {
            return null
        }
        return {
            streamKey: '', // Caller supplies from header
            characters: externalSnapshot.characters,
            timestamp: 0 // Caller supplies from header
        }
    }
    
    async deserialize(params: {
        content: CharacterEventExternal | CharacterSnapshotExternal;
        header: StreamingEventHeader;
    }): Promise<CharacterEventUpdate | CharacterSnapshotPayload | null> {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            const result = await this.deserializeSnapshot(content as CharacterSnapshotExternal)
            if (!result) return null
            return {
                ...result,
                streamKey: header.streamKey,
                timestamp: header.timestamp
            }
        }
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
                component
            }
        } catch (error) {
            // If WML parsing fails, return null
            console.warn('Failed to deserialize character WML:', error)
            return null
        }
    }
}
