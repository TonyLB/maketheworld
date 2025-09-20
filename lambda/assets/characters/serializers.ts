import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

// Internal types for character events (using StandardComponent objects)
export type CharacterEventUpdate = CharacterUpdatedEvent | CharacterRemovedEvent

export type CharacterUpdatedEvent = {
    type: 'Character Updated'
    component: StandardComponent // The actual component object for internal processing
}

export type CharacterRemovedEvent = {
    type: 'Character Removed'
    characterId: `CHARACTER#${string}` // Only needed for removal events where component is not available
}

export type CharacterEventExternal = CharacterUpdatedEventExternal | CharacterRemovedEventExternal

export type CharacterUpdatedEventExternal = {
    characterId: `CHARACTER#${string}`
    wml: string // WML string containing character data
}

export type CharacterRemovedEventExternal = {
    characterId: `CHARACTER#${string}`
    // No wml field for removal events - just need to identify what was removed
}

/**
 * Event serializer for character events in the mtw.assets.characters data source.
 * 
 * This serializer handles the conversion between internal StandardComponent objects
 * and external EventBridge-compatible event formats for character-specific events.
 */
export class CharacterEventSerializer implements DataSourceEventSerializer<CharacterEventUpdate, CharacterEventExternal> {
    serialize({ update }: { update: CharacterEventUpdate }): CharacterEventExternal {
        if (update.type === 'Character Updated') {
            const characterId = update.component.universalKey as `CHARACTER#${string}`
            const wml = schemaToWML([update.component.schema])
            
            return {
                characterId,
                wml
            } as CharacterUpdatedEventExternal
        } else {
            // Character Removed event - no WML content needed, just the characterId
            return {
                characterId: update.characterId
            } as CharacterRemovedEventExternal
        }
    }
    
    deserialize(params: { 
        dataSourceKey: string
        detailType: string
        streamKey: string
        externalUpdate: CharacterEventExternal 
    }): CharacterEventUpdate | null {
        const { detailType, externalUpdate } = params
        
        // Only handle character events
        if (!['Character Updated', 'Character Removed'].includes(detailType)) {
            return null
        }
        
        if (detailType === 'Character Updated') {
            // Note: We can't deserialize the component object from WML here
            // This would require parsing the WML back to StandardComponent
            // For now, we'll return null since we can't reconstruct the component
            return null
        } else {
            // Character Removed event
            return {
                type: 'Character Removed',
                characterId: externalUpdate.characterId
            }
        }
    }
}
