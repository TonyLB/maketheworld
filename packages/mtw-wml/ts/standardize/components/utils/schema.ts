import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { StandardComponent, NestedSchemaOptions } from "../baseClasses"
import StandardReference, { StandardKey } from "../reference"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"

export const renderReference = ({ lookup, options }: { lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions }) => (reference: StandardReference): GenericTreeNode<SchemaTag> | undefined => {
    const found = lookup(reference._payload.plain.standardKey)
    if (!found) {
        return undefined
    }
    
    // Check if this is a Remove reference - if so, pass removeContext: true to nestedSchema
    // so the component knows to invert its contents for display in a remove context
    const isRemoveReference = reference._payload.ref < 0
    const nestedOptions: NestedSchemaOptions = { 
        ...options, 
        key: reference._payload.plain.standardKey,
        removeContext: isRemoveReference ? !(options.removeContext ?? false) : options.removeContext,
        organization: options.organization  // Pass organization through to nested calls
    }
    const nested = found.nestedSchema(lookup, nestedOptions)
    
    // If it's a Remove reference, wrap the result in a Remove tag
    if (isRemoveReference) {
        return {
            data: { tag: 'Remove' as const },
            children: [nested]
        }
    }
    
    return nested
}
