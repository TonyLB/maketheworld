import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
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
    serialize({ update }: { update: CharacterEventUpdate }): CharacterEventExternal {
        const characterId = update.component.universalKey as `CHARACTER#${string}`
        const wml = schemaToWML([update.component.schema])
        
        return {
            characterId,
            wml
        }
    }
    
    deserialize(params: { 
        dataSourceKey: string
        detailType: string
        streamKey: string
        externalUpdate: CharacterEventExternal 
    }): CharacterEventUpdate | null {
        const { detailType, externalUpdate } = params
        
        // Only handle character updated events
        if (detailType !== 'Character Updated') {
            return null
        }
        
        // Deserialize WML back to StandardComponent
        try {
            const schemaNode = nodeFromWML(externalUpdate.wml)
            const component = standardComponentFactory(schemaNode)
            
            if (!component) {
                return null
            }
            
            return {
                type: 'Character Updated',
                component
            }
        } catch (error) {
            // If WML parsing fails, return null
            console.warn('Failed to deserialize character WML:', error)
            return null
        }
    }
}
