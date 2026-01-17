import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { v2StandardEditableFactory, StandardEditablePayload } from "../../generics/editable"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isRenderTree, RenderTree, renderTreeToSchema } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { ComponentUUID, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardKey } from "../keys/key"
import { StandardKeyData } from "../keys/dataTypes/reference"
import { isLegalKey } from "../utils"
import { isSchemaTreeNode } from "../../schema"
import { stripWrapperTag } from "../../schema/utils"

//
// StandardExplicitParentSimpleBase holds the contents for a simple StandardExplicitParent
// Now stores a StandardKey or 'ASSET' sentinel, allowing both ComponentUUID and legalKey formats,
// plus explicit asset-level parentage
//
export class StandardExplicitParentSimpleBase implements StandardEditablePayload<StandardKeyData | 'ASSET'> {
    data: StandardKey | 'ASSET'
    get schema() {
        // Handle explicitly asset level case
        if (this.data === 'ASSET') {
            // Empty Parent tag (self-closing) - explicitly set to asset level
            return [{ data: { tag: 'Parent' as const }, children: [] }]
        }
        // Generate schema from StandardKey - use key if available, otherwise universalKey
        if (this.data.key) {
            // For local keys, generate a String tag with the key value
            return [{ data: { tag: 'String' as const, value: this.data.key }, children: [] }]
        }
        if (this.data.universalKey) {
            // For universal keys, generate a String tag with the universalKey value
            return [{ data: { tag: 'String' as const, value: this.data.universalKey }, children: [] }]
        }
        throw new Error('StandardExplicitParentSimpleBase must have either key, universalKey, or ASSET')
    }
    constructor(data: StandardKey | ComponentUUID | string | StandardKeyData | 'ASSET') {
        // Handle ASSET sentinel value
        if (data === 'ASSET') {
            this.data = 'ASSET'
            return
        }
        if (data instanceof StandardKey) {
            this.data = data
            return
        }
        // Handle string input - can be either ComponentUUID or legalKey
        if (typeof data === 'string') {
            if (isSchemaComponentUUID(data)) {
                this.data = new StandardKey(data)
                return
            }
            if (isLegalKey(data)) {
                this.data = new StandardKey({ key: data })
                return
            }
            throw new Error(`Invalid parent value: must be ComponentUUID, legalKey, or 'ASSET', got: ${data}`)
        }
        // Handle StandardKeyData object format
        if (typeof data === 'object' && data !== null) {
            this.data = new StandardKey(data)
            return
        }
        throw new Error(`Invalid argument to StandardExplicitParentSimpleBase constructor: ${data}`)
    }
    clone() {
        return new StandardExplicitParentSimpleBase(this.data)
    }
    toJSON: () => StandardKeyData | 'ASSET' = () => {
        if (this.data === 'ASSET') {
            return 'ASSET'
        }
        return this.data.toJSON()
    }
}

const payloadFactory = (props: StandardKeyData | 'ASSET' | GenericTree<SchemaTag>): StandardExplicitParentSimpleBase | undefined => {
    // Handle ASSET sentinel value
    if (props === 'ASSET') {
        return new StandardExplicitParentSimpleBase('ASSET')
    }
    // Handle StandardKeyData (string ComponentUUID or object with key/universalKey)
    if (typeof props === 'string') {
        // Can be ComponentUUID or legalKey
        if (isSchemaComponentUUID(props) || isLegalKey(props)) {
            return new StandardExplicitParentSimpleBase(props)
        }
        throw new Error(`Invalid parent value: must be ComponentUUID, legalKey, or 'ASSET', got: ${props}`)
    }
    if (typeof props === 'object' && !Array.isArray(props)) {
        // Handle StandardKeyData object format
        const key = new StandardKey(props)
        return new StandardExplicitParentSimpleBase(key)
    }
    // Handle schema tree - check if first element is a Parent tag
    if (Array.isArray(props) && props.length > 0) {
        const firstElement = props[0]
        // If first element is a Parent tag, extract its children
        if (firstElement.data && firstElement.data.tag === 'Parent') {
            const parentChildren = firstElement.children
            // Combine all String children from Parent tag
            const combinedValue = parentChildren
                .map(({ data }) => data)
                .filter(isSchemaString)
                .map(({ value }) => value)
                .join('')
            // Empty Parent tag (self-closing) - explicitly set to asset level
            if (combinedValue === '') {
                return new StandardExplicitParentSimpleBase('ASSET')
            }
            // Can be ComponentUUID or legalKey
            if (isSchemaComponentUUID(combinedValue) || isLegalKey(combinedValue)) {
                return new StandardExplicitParentSimpleBase(combinedValue)
            }
            throw new Error(`Parent tag content must be a ComponentUUID or legalKey, got: ${combinedValue}`)
        }
        // Handle direct String tag (not wrapped in Parent)
        if (props.length === 1 && isSchemaString(props[0].data)) {
            const combinedValue = props[0].data.value
            // Can be ComponentUUID or legalKey
            if (isSchemaComponentUUID(combinedValue) || isLegalKey(combinedValue)) {
                return new StandardExplicitParentSimpleBase(combinedValue)
            }
            throw new Error(`Parent tag content must be a ComponentUUID or legalKey, got: ${combinedValue}`)
        }
    }
    // Handle empty Parent tag (self-closing) - explicitly set to asset level
    if (Array.isArray(props) && props.length === 0) {
        return new StandardExplicitParentSimpleBase('ASSET')
    }
    throw new Error('Invalid argument in StandardExplicitParentSimpleBase constructor')
}

// Parent values can only be added if they match exactly (no partial matches)
const standardExplicitParentAdd = (base: StandardKeyData | 'ASSET', incoming: StandardKeyData | 'ASSET'): StandardKeyData | 'ASSET' => {
    // Handle ASSET sentinel values
    if (base === 'ASSET' && incoming === 'ASSET') {
        return 'ASSET'
    }
    if (base === 'ASSET' || incoming === 'ASSET') {
        // Different values (one is ASSET, one is not) - conflict
        throw new MergeConflictError('Parent values can only be merged if they match exactly. Conflicting parent values are not allowed.')
    }
    const baseKey = new StandardKey(base)
    const incomingKey = new StandardKey(incoming)
    // For Parent, adding means replacing - they must match exactly
    if (baseKey.equals(incomingKey)) {
        return base
    }
    // If they don't match, this is a conflict
    throw new MergeConflictError('Parent values can only be merged if they match exactly. Conflicting parent values are not allowed.')
}

// Parent values can only be removed if they match exactly (no partial matches)
// However, when used in merge context (via addDelta), mismatched values represent a Replace operation
// and should return a delta indicating the base value should be kept (can't subtract)
const standardExplicitParentSubtract = (base: StandardKeyData | 'ASSET', incoming: StandardKeyData | 'ASSET'): { add?: StandardKeyData | 'ASSET', remove?: StandardKeyData | 'ASSET' } => {
    // Handle ASSET sentinel values
    if (base === 'ASSET' && incoming === 'ASSET') {
        // Exact match: remove the value entirely
        return {}
    }
    if (base === 'ASSET' || incoming === 'ASSET') {
        // Different values (one is ASSET, one is not) - this is a Replace operation
        // Return delta keeping base value (can't subtract different value)
        return { add: base }
    }
    const baseKey = new StandardKey(base)
    const incomingKey = new StandardKey(incoming)
    // Only allow exact matches - partial matches are error conditions
    if (baseKey.equals(incomingKey)) {
        // Exact match: remove the value entirely
        return {}
    }
    // Different values - this is a Replace operation
    // Return delta keeping base value (can't subtract different value)
    return { add: base }
}

// Parent values can only be diffed if they match exactly (no partial matches)
const standardExplicitParentDiff = (base: StandardKeyData | 'ASSET', incoming: StandardKeyData | 'ASSET'): { add?: StandardKeyData | 'ASSET', remove?: StandardKeyData | 'ASSET' } => {
    // Handle ASSET sentinel values
    if (base === 'ASSET' && incoming === 'ASSET') {
        // No difference
        return {}
    }
    if (base === 'ASSET' || incoming === 'ASSET') {
        // Different values: replace base with incoming
        return { remove: base, add: incoming }
    }
    const baseKey = new StandardKey(base)
    const incomingKey = new StandardKey(incoming)
    if (baseKey.equals(incomingKey)) {
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
    dataTypeguard: isStandardExplicitParentData 
} = v2StandardEditableFactory({
    typeguard: (value: any): value is StandardKeyData | 'ASSET' => {
        // Accept ASSET sentinel value
        if (value === 'ASSET') {
            return true
        }
        // Accept ComponentUUID string, legalKey string, or StandardKeyData object
        if (typeof value === 'string') {
            return isSchemaComponentUUID(value) || !!isLegalKey(value)
        }
        // Check for StandardKeyData object format
        if (typeof value === 'object' && value !== null) {
            return ('key' in value || 'universalKey' in value) && !('tag' in value)
        }
        return false
    },
    payloadFactory: payloadFactory,
    payload: StandardExplicitParentSimpleBase,
    add: standardExplicitParentAdd,
    subtract: standardExplicitParentSubtract,
    diff: standardExplicitParentDiff,
    validateReplace: (baseAdd: StandardKeyData | 'ASSET', incomingAdd: StandardKeyData | 'ASSET', incomingRemove: StandardKeyData | 'ASSET') => {
        // For parents, Replace is valid if baseAdd matches incomingRemove (valid rename)
        // Handle ASSET sentinel values
        if (baseAdd === 'ASSET' || incomingRemove === 'ASSET') {
            if (baseAdd !== incomingRemove) {
                throw new MergeConflictError('Parent Replace operation must match baseAdd with incomingRemove. Conflicting parent values are not allowed.')
            }
            return
        }
        // Compare StandardKey values using equals()
        const baseKey = new StandardKey(baseAdd)
        const incomingRemoveKey = new StandardKey(incomingRemove)
        if (!baseKey.equals(incomingRemoveKey)) {
            throw new MergeConflictError('Parent Replace operation must match baseAdd with incomingRemove. Conflicting parent values are not allowed.')
        }
    }
}, 'StandardExplicitParent')


export class StandardExplicitParent {
    _payload: InstanceType<typeof EditableClass>;
    
    constructor(arg: any) {
        // Handle existing StandardExplicitParent instance (for cloning)
        if (arg instanceof StandardExplicitParent) {
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
        
        // Strip "Parent" wrapper tag if present using centralized utility
        if (Array.isArray(convertedArg) && convertedArg.every(isSchemaTreeNode)) {
            convertedArg = stripWrapperTag(convertedArg, 'Parent')
        }
        
        // Use EditableClass.create() for dispatch
        // Handle empty Parent tag (self-closing) - explicitly set to asset level
        if (Array.isArray(convertedArg) && convertedArg.length === 0) {
            this._payload = PlainClass.create('ASSET')
            return
        }
        
        const created = EditableClass.create(convertedArg)
        // EditableClass.create() returns undefined for empty trees, which we treat as 'ASSET'
        if (!created) {
            this._payload = PlainClass.create('ASSET')
            return
        }
        
        this._payload = created
    }

    get schema(): GenericTree<SchemaTag> {
        if (!this._payload) {
            return [{ data: { tag: 'Parent' as const }, children: [] }]
        }
        // Wrap payload schema in Parent tag
        const payloadSchema = this._payload.schema
        if (this._payload instanceof PlainClass) {
            // For ASSET case, payload.schema already includes Parent tag with empty children
            // For other cases, wrap in Parent tag
            const firstNode = payloadSchema[0]
            if (firstNode?.data?.tag === 'Parent') {
                return payloadSchema
            }
            return [{ data: { tag: 'Parent' as const }, children: payloadSchema }]
        }
        if (this._payload instanceof RemoveClass) {
            const match = (this._payload as any).match
            return [{
                data: { tag: 'Remove' as const },
                children: [{ data: { tag: 'Parent' as const }, children: match?.schema ?? [] }]
            }]
        }
        if (this._payload instanceof ReplaceClass) {
            const match = (this._payload as any).match
            const payload = (this._payload as any).payload
            return [{
                data: { tag: 'Replace' as const },
                children: [
                    { data: { tag: 'ReplaceMatch' as const }, children: [{ data: { tag: 'Parent' as const }, children: match?.schema ?? [] }] },
                    { data: { tag: 'ReplacePayload' as const }, children: [{ data: { tag: 'Parent' as const }, children: payload?.schema ?? [] }] }
                ]
            }]
        }
        return this._payload.schema
    }

    nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        if (!this._payload) {
            return [{ data: tag, children: [{ data: { tag: 'Parent' as const }, children: [] }] }]
        }
        
        // Wrap payload schema in Parent tag, then in the provided tag
        if (this._payload instanceof PlainClass) {
            return [{ data: tag, children: [{ data: { tag: 'Parent' as const }, children: this._payload.schema }] }]
        }
        if (this._payload instanceof RemoveClass) {
            const match = (this._payload as any).match
            return [{
                data: tag,
                children: [{
                    data: { tag: 'Remove' as const },
                    children: [{ data: { tag: 'Parent' as const }, children: match?.schema ?? [] }]
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
                        { data: { tag: 'ReplaceMatch' as const }, children: [{ data: { tag: 'Parent' as const }, children: match?.schema ?? [] }] },
                        { data: { tag: 'ReplacePayload' as const }, children: [{ data: { tag: 'Parent' as const }, children: payload?.schema ?? [] }] }
                    ]
                }]
            }]
        }
        return this._payload.nestedSchema(tag)
    }

    toJSON(): StandardEditableData<StandardKeyData | 'ASSET'> | undefined {
        if (!this._payload) {
            return undefined
        }
        // Return 'ASSET' directly for explicitly asset level (clearer than null)
        return this._payload.toJSON()
    }

    merge(incoming: StandardExplicitParent): StandardExplicitParent | undefined {
        // Handle undefined cases
        if (!this._payload && !incoming._payload) {
            return undefined
        }
        if (!this._payload) {
            return incoming
        }
        if (!incoming._payload) {
            return this
        }
        
        // Use the v2 factory's merge - validateReplace handles parent rename validation
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            return new StandardExplicitParent(merged)
        }
        return undefined
    }
    diff(incoming: StandardExplicitParent | undefined): StandardExplicitParent | undefined {
        if (!incoming) {
            if (this._payload) {
                const inverted = this._payload.invert()
                if (inverted) {
                    return new StandardExplicitParent(inverted)
                }
            }
            return undefined
        }
        // Handle undefined cases
        if (!this._payload && !incoming._payload) {
            return undefined
        }
        if (!this._payload) {
            // This has no parent, incoming has a parent - return incoming as the diff
            return incoming
        }
        if (!incoming._payload) {
            // This has a parent, incoming has no parent - return removal of this
            const inverted = this._payload.invert()
            if (inverted) {
                return new StandardExplicitParent(inverted)
            }
            return undefined
        }
        // Both have payloads - let the delta system handle ASSET sentinel values
        const diffResult = this._payload.diff(incoming._payload)
        if (diffResult) {
            return new StandardExplicitParent(diffResult)
        }
        return undefined
    }
    mapContents(callback: (incoming: StandardKeyData | 'ASSET') => StandardKeyData | 'ASSET'): StandardExplicitParent {
        // Explicitly asset level doesn't need mapping
        if (this._payload instanceof PlainClass) {
            const plainValue = this._payload.plain?.toJSON()
            if (plainValue === 'ASSET') {
                return this
            }
            const mapped = callback(plainValue!)
            return new StandardExplicitParent(mapped)
        }
        if (!this._payload) {
            return this
        }
        if (this._payload instanceof RemoveClass) {
            const matchValue = (this._payload as any).match?.toJSON() ?? ''
            // Don't map ASSET sentinel
            if (matchValue === 'ASSET') {
                return this
            }
            const mapped = callback(matchValue)
            return new StandardExplicitParent({ tag: 'Remove', match: mapped })
        }
        if (this._payload instanceof ReplaceClass) {
            const matchValue = (this._payload as any).match?.toJSON() ?? ''
            const payloadValue = (this._payload as any).payload?.toJSON() ?? ''
            const mappedMatch = matchValue === 'ASSET' ? 'ASSET' : callback(matchValue)
            const mappedPayload = payloadValue === 'ASSET' ? 'ASSET' : callback(payloadValue)
            return new StandardExplicitParent({
                tag: 'Replace',
                match: mappedMatch,
                payload: mappedPayload
            })
        }
        throw new Error('Invalid StandardExplicitParent payload')
    }

    get standardKey(): StandardKey | 'ASSET' | undefined {
        if (!this._payload) return undefined
        if (this._payload instanceof RemoveClass) {
            return undefined
        }
        if (this._payload instanceof PlainClass) {
            const plainValue = this._payload.plain?.data
            return plainValue
        }
        if (this._payload instanceof ReplaceClass) {
            // Outgoing payload (not match) is the "next" value
            const payloadValue = (this._payload as any).payload?.data
            return payloadValue
        }
        return undefined
    }

    invert(): StandardExplicitParent {
        if (!this._payload) {
            // Undefined/empty parent - return as-is (no inversion needed)
            return new StandardExplicitParent(this)
        }
        const inverted = this._payload.invert()
        return new StandardExplicitParent(inverted)
    }

    
}
