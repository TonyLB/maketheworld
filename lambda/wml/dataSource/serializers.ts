import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { nodeFromWML } from '@tonylb/mtw-wml/ts/schema'

/**
 * Serializer/Deserializer for WML format events
 * 
 * This handles the conversion between:
 * - Internal StandardForm objects (for messageBus communication)
 * - WML string format (for EventBridge transmission)
 */
export class WMLEventSerializer implements DataSourceEventSerializer<StandardForm, string> {
    /**
     * Serialize a StandardForm to WML string format
     * for EventBridge transmission
     */
    serialize({ update }: { update: StandardForm }): string {
        // Convert StandardForm to WML string
        return schemaToWML([update.schema])
    }

    /**
     * Deserialize a WML string back to StandardForm
     * for internal messageBus processing
     */
    deserialize(params: { dataSourceKey: string; detailType: string; streamKey: string; externalUpdate: string }): StandardForm | null {
        try {
            // Parse WML string back to StandardForm
            const schemaNode = nodeFromWML(params.externalUpdate)
            return new StandardForm(schemaNode)
        } catch (error) {
            throw new Error(`Failed to deserialize WML: ${error instanceof Error ? error.message : String(error)}`)
        }
    }
}
