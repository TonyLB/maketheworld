import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

// Internal types for character events (using StandardComponent objects)
export type CharacterEventUpdate = {
    type: 'Character Updated' | 'Character Removed'
    characterId: `CHARACTER#${string}`
    component?: StandardComponent // The actual component object for internal processing
}

export type CharacterEventExternal = {
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
        const { characterId, component } = update
        
        // If we have a component object, serialize it to WML
        let wml: string
        if (component) {
            wml = schemaToWML([component.schema])
        } else {
            // Fallback to basic character WML
            const characterIdOnly = characterId.replace('CHARACTER#', '')
            wml = `<Character uuid=(${characterIdOnly}) />`
        }
        
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
        
        // Only handle character events
        if (!['Character Updated', 'Character Removed'].includes(detailType)) {
            return null
        }
        
        return {
            type: detailType as 'Character Updated' | 'Character Removed',
            characterId: externalUpdate.characterId,
            // Note: We can't deserialize the component object from WML here
            // This would require parsing the WML back to StandardComponent
            // For now, we'll rely on the component being available from other sources
        }
    }
}
