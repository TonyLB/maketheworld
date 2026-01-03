import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardComponent, NestedSchemaOptions } from "../baseClasses"
import StandardReference from "../reference"
import { StandardKey } from "../../keys/key"
import { isSchemaComponent, SchemaTag } from "@tonylb/mtw-base/ts/schema"

export const renderReference = ({ lookup, options }: { lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions }) => (reference: StandardReference): GenericTreeNode<SchemaTag> | undefined => {
    const found = lookup(reference.standardKey)
    if (!found) {
        return undefined
    }
    
    // Check if this is a Remove reference - if so, pass removeContext: true to nestedSchema
    // so the component knows to invert its contents for display in a remove context
    const isRemoveReference = reference.ref < 0
    const nestedOptions: NestedSchemaOptions = { 
        ...options, 
        key: reference.standardKey,
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
    
    // Include ref attribute from reference if it's non-default (ref !== 1)
    // This preserves ref={0} entries created for organizational purposes
    // Only add ref to component tags (not Asset or other non-component tags)
    if (reference.ref !== 1 && treeNodeTypeguard(isSchemaComponent)(nested)) {
        // Use type assertion to add ref property, matching the pattern in StandardReference._getPlainSchema
        const schemaData = { ...nested.data } as SchemaTag & { ref: number }
        schemaData.ref = reference.ref
        return {
            ...nested,
            data: schemaData
        }
    }
    
    return nested
}
