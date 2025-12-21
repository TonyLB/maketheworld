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
    // #region agent log
    const refValue = reference._payload.ref;
    fetch('http://127.0.0.1:7242/ingest/3e0dcc50-5f2b-4d0c-a479-a8fcebe97cf4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'schema.ts:14',message:'renderReference check',data:{refValue,key:reference.key,universalKey:reference.universalKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const isRemoveReference = reference._payload.ref < 0
    const nestedOptions: NestedSchemaOptions = { 
        ...options, 
        key: reference._payload.plain.standardKey,
        removeContext: isRemoveReference ? !(options.removeContext ?? false) : options.removeContext
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
