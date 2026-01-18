import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { standardEditableFactory, StandardEditablePayload } from "../../generics/editable"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isRenderTree, renderTreeToSchema } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { isSchemaKey } from "@tonylb/mtw-base/ts/schema/components"
import { isLegalKey } from "../utils"
import { isSchemaTreeNode } from "../../schema"
import { stripWrapperTag } from "../../schema/utils"

//
// StandardExplicitKeySimpleBase holds the contents for a simple StandardExplicitKey
// Stores only legalKey values (no ComponentUUID, no 'ASSET' sentinel)
//
export class StandardExplicitKeySimpleBase implements StandardEditablePayload<string> {
    key: string
    get schema() {
        // Generate schema from key string
        return [{ data: { tag: 'String' as const, value: this.key }, children: [] }]
    }
    constructor(data: string) {
        // Reject ComponentUUID
        if (isSchemaComponentUUID(data)) {
            throw new Error(`Invalid key value: ComponentUUID not allowed, got: ${data}`)
        }
        // Must be legalKey
        if (!isLegalKey(data)) {
            throw new Error(`Invalid key value: must be legalKey, got: ${data}`)
        }
        this.key = data
    }
    clone() {
        return new StandardExplicitKeySimpleBase(this.key)
    }
    toJSON: () => string = () => {
        return this.key
    }
}

const payloadFactory = (props: string | GenericTree<SchemaTag>): StandardExplicitKeySimpleBase | undefined => {
    // Handle string input
    if (typeof props === 'string') {
        // Reject ComponentUUID
        if (isSchemaComponentUUID(props)) {
            throw new Error('Invalid key value: ComponentUUID not allowed')
        }
        // Must be legalKey
        if (!isLegalKey(props)) {
            throw new Error(`Invalid key value: must be legalKey, got: ${props}`)
        }
        return new StandardExplicitKeySimpleBase(props)
    }
    // Handle schema tree - check if first element is a Key tag
    if (Array.isArray(props) && props.length > 0) {
        const firstElement = props[0]
        // If first element is a Key tag, extract its children
        if (firstElement.data && isSchemaKey(firstElement.data)) {
            const keyChildren = firstElement.children
            // Combine all String children from Key tag
            const combinedValue = keyChildren
                .map(({ data }) => data)
                .filter(isSchemaString)
                .map(({ value }) => value)
                .join('')
            // Empty Key tag is not allowed
            if (combinedValue === '') {
                throw new Error('Key tag must contain a legalKey value')
            }
            // Reject ComponentUUID
            if (isSchemaComponentUUID(combinedValue)) {
                throw new Error(`Invalid key value: ComponentUUID not allowed`)
            }
            // Must be legalKey
            if (!isLegalKey(combinedValue)) {
                throw new Error(`Invalid key value: must be legalKey, got: ${combinedValue}`)
            }
            return new StandardExplicitKeySimpleBase(combinedValue)
        }
        // Handle direct String tag (not wrapped in Key)
        if (props.length === 1 && isSchemaString(props[0].data)) {
            const combinedValue = props[0].data.value
            // Reject ComponentUUID
            if (isSchemaComponentUUID(combinedValue)) {
                throw new Error(`Invalid key value: ComponentUUID not allowed`)
            }
            // Must be legalKey
            if (!isLegalKey(combinedValue)) {
                throw new Error(`Key tag content must be a legalKey, got: ${combinedValue}`)
            }
            return new StandardExplicitKeySimpleBase(combinedValue)
        }
    }
    // Empty array is not allowed (unlike Parent which allows empty for 'ASSET')
    if (Array.isArray(props) && props.length === 0) {
        throw new Error('Key tag must contain a legalKey value')
    }
    throw new Error('Invalid argument in StandardExplicitKeySimpleBase constructor')
}

// Key values can only be added if they match exactly (no partial matches)
const standardExplicitKeyAdd = (base: string, incoming: string): string => {
    // For Key, adding means replacing - they must match exactly
    if (base === incoming) {
        return base
    }
    // If they don't match, this is a conflict
    throw new MergeConflictError('Key values can only be merged if they match exactly. Conflicting key values are not allowed.')
}

// Key values can only be removed if they match exactly (no partial matches)
// However, when used in merge context (via addDelta), mismatched values represent a Replace operation
// and should return a delta indicating the base value should be kept (can't subtract)
const standardExplicitKeySubtract = (base: string, incoming: string): { add?: string, remove?: string } => {
    // Only allow exact matches - partial matches are error conditions
    if (base === incoming) {
        // Exact match: remove the value entirely
        return {}
    }
    // Different values - this is a Replace operation
    // Return delta keeping base value (can't subtract different value)
    return { add: base }
}

// Key values can only be diffed if they match exactly (no partial matches)
const standardExplicitKeyDiff = (base: string, incoming: string): { add?: string, remove?: string } => {
    if (base === incoming) {
        // No difference
        return {}
    }
    // Different values: replace base with incoming
    return { remove: base, add: incoming }
}

export const { 
    EditableClass, 
    PlainClass, 
    RemoveClass, 
    ReplaceClass, 
    dataTypeguard: isStandardExplicitKeyData 
} = standardEditableFactory({
    typeguard: (value: any): value is string => {
        // Only accept legalKey strings
        if (typeof value === 'string') {
            // Reject ComponentUUID
            if (isSchemaComponentUUID(value)) {
                return false
            }
            // Only accept legalKey strings
            return !!isLegalKey(value)
        }
        return false
    },
    payloadFactory: payloadFactory,
    payload: StandardExplicitKeySimpleBase,
    add: standardExplicitKeyAdd,
    subtract: standardExplicitKeySubtract,
    diff: standardExplicitKeyDiff,
    validateReplace: (baseAdd: string, incomingAdd: string, incomingRemove: string) => {
        // For keys, Replace is valid if baseAdd matches incomingRemove (valid rename)
        // This validates that we're replacing the correct base value, not changing it incorrectly
        if (baseAdd !== incomingRemove) {
            throw new MergeConflictError('Key Replace operation must match baseAdd with incomingRemove. Conflicting key values are not allowed.')
        }
    }
}, 'StandardExplicitKey')


export class StandardExplicitKey {
    _payload: InstanceType<typeof EditableClass>;
    
    constructor(arg: any) {
        // Handle existing StandardExplicitKey instance (for cloning)
        if (arg instanceof StandardExplicitKey) {
            this._payload = arg._payload
            return
        }
        
        // Handle existing v2 instance
        if (arg instanceof EditableClass) {
            this._payload = arg
            return
        }
        
        // Convert RenderTree to GenericTree<SchemaTag> if needed
        let convertedArg = isRenderTree(arg) ? renderTreeToSchema(arg) : arg
        
        // Strip "Key" wrapper tag if present using centralized utility
        if (Array.isArray(convertedArg) && convertedArg.every(isSchemaTreeNode)) {
            convertedArg = stripWrapperTag(convertedArg, 'Key')
        }
        
        // Use EditableClass.create() for dispatch
        this._payload = EditableClass.create(convertedArg)
        
        // Validate that payload exists (Key cannot be empty)
        if (!this._payload) {
            throw new Error('Key tag must contain a legalKey value')
        }
    }

    get payload(): InstanceType<typeof EditableClass> {
        return this._payload
    }

    get schema(): GenericTree<SchemaTag> {
        if (!this._payload) {
            throw new Error('StandardExplicitKey must have a payload')
        }
        // Wrap payload schema in Key tag
        if (this._payload instanceof PlainClass) {
            return [{ data: { tag: 'Key' as const }, children: this._payload.schema }]
        }
        if (this._payload instanceof RemoveClass) {
            const match = (this._payload as any).match
            return [{ 
                data: { tag: 'Remove' as const }, 
                children: [{ data: { tag: 'Key' as const }, children: match?.schema ?? [] }] 
            }]
        }
        if (this._payload instanceof ReplaceClass) {
            const match = (this._payload as any).match
            const payload = (this._payload as any).payload
            return [{ 
                data: { tag: 'Replace' as const }, 
                children: [
                    { data: { tag: 'ReplaceMatch' as const }, children: [{ data: { tag: 'Key' as const }, children: match?.schema ?? [] }] },
                    { data: { tag: 'ReplacePayload' as const }, children: [{ data: { tag: 'Key' as const }, children: payload?.schema ?? [] }] }
                ]
            }]
        }
        return this._payload.schema
    }

    nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        if (!this._payload) {
            throw new Error('StandardExplicitKey must have a payload')
        }
        
        // Wrap payload schema in Key tag, then in the provided tag
        if (this._payload instanceof PlainClass) {
            return [{ data: tag, children: [{ data: { tag: 'Key' as const }, children: this._payload.schema }] }]
        }
        if (this._payload instanceof RemoveClass) {
            const match = (this._payload as any).match
            return [{
                data: tag,
                children: [{
                    data: { tag: 'Remove' as const },
                    children: [{ data: { tag: 'Key' as const }, children: match?.schema ?? [] }]
                }]
            }]
        }
        if (this._payload instanceof ReplaceClass) {
            const match = (this._payload as any).match
            const payload = (this._payload as any).payload
            return [{
                data: tag,
                children: [{
                    data: { tag: 'Replace' as const },
                    children: [
                        { data: { tag: 'ReplaceMatch' as const }, children: [{ data: { tag: 'Key' as const }, children: match?.schema ?? [] }] },
                        { data: { tag: 'ReplacePayload' as const }, children: [{ data: { tag: 'Key' as const }, children: payload?.schema ?? [] }] }
                    ]
                }]
            }]
        }
        return this._payload.nestedSchema(tag)
    }

    toJSON(): StandardEditableData<string> | undefined {
        if (!this._payload) {
            return undefined
        }
        return this._payload.toJSON()
    }

    merge(incoming: StandardExplicitKey): StandardExplicitKey | undefined {
        if (!this._payload) {
            return incoming
        }
        if (!incoming._payload) {
            return this
        }
        
        // Use the v2 factory's merge - validateReplace handles key rename validation
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            return new StandardExplicitKey(merged)
        }
        return undefined
    }
    diff(incoming: StandardExplicitKey | undefined): StandardExplicitKey | undefined {
        if (!incoming) {
            if (this._payload) {
                const inverted = this._payload.invert()
                return new StandardExplicitKey(inverted)
            }
            return undefined
        }
        if (!this._payload) {
            // This has no key, incoming has a key - return incoming as the diff
            return incoming
        }
        if (!incoming._payload) {
            // This has a key, incoming has no key - return removal of this
            const inverted = this._payload.invert()
            return new StandardExplicitKey(inverted)
        }
        // Both have payloads - diff them
        const diffResult = this._payload.diff(incoming._payload)
        if (diffResult) {
            return new StandardExplicitKey(diffResult)
        }
        return undefined
    }
    mapContents(callback: (incoming: string) => string): StandardExplicitKey {
        if (!this._payload) {
            return this
        }
        if (this._payload instanceof PlainClass) {
            const currentValue = this._payload.plain?.toJSON() ?? ''
            const mapped = callback(currentValue)
            return new StandardExplicitKey(mapped)
        }
        if (this._payload instanceof RemoveClass) {
            const matchValue = (this._payload as any).match?.toJSON() ?? ''
            const mapped = callback(matchValue)
            return new StandardExplicitKey({ tag: 'Remove', match: mapped })
        }
        if (this._payload instanceof ReplaceClass) {
            const matchValue = (this._payload as any).match?.toJSON() ?? ''
            const payloadValue = (this._payload as any).payload?.toJSON() ?? ''
            return new StandardExplicitKey({
                tag: 'Replace',
                match: callback(matchValue),
                payload: callback(payloadValue)
            })
        }
        throw new Error('Invalid StandardExplicitKey payload')
    }

    invert(): StandardExplicitKey {
        if (!this._payload) {
            return new StandardExplicitKey(this)
        }
        const inverted = this._payload.invert()
        return new StandardExplicitKey(inverted)
    }
}
