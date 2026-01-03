import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { StandardEditableDataDelta, standardEditableFactory, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isRenderTree, RenderTree, renderTreeToSchema } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { ComponentUUID, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardKey } from "../keys/key"
import { StandardKeyData } from "../components/dataTypes/reference"
import { isLegalKey } from "../utils"

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

export const { constructorDelta: factory, typeguard: isStandardExplicitParentData, merge, diff } = standardEditableFactory({
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
    diff: standardExplicitParentDiff
})

const fromDelta = (delta: { add?: StandardKeyData | 'ASSET', remove?: StandardKeyData | 'ASSET' }): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined => {
    const { add, remove } = delta
    if (add) {
        if (remove) {
            // fromDelta receives data from _delta.toJSON(), create payload instances
            const removeBase = remove === 'ASSET' ? new StandardExplicitParentSimpleBase('ASSET') : new StandardExplicitParentSimpleBase(remove)
            const addBase = add === 'ASSET' ? new StandardExplicitParentSimpleBase('ASSET') : new StandardExplicitParentSimpleBase(add)
            return new StandardExplicitParentReplace(removeBase, addBase)
        }
        return new StandardExplicitParentSimple(add === 'ASSET' ? 'ASSET' : add)
    }
    if (remove) {
        return new StandardExplicitParentRemove(remove === 'ASSET' ? 'ASSET' : remove)
    }
    return undefined
}

export class StandardExplicitParentSimple implements StandardEditableWrapper<StandardExplicitParentSimpleBase> {
    payload: StandardExplicitParentSimpleBase
    
    constructor(data: StandardExplicitParentSimpleBase | StandardEditableData<StandardKeyData | 'ASSET'> | RenderTree | GenericTree<SchemaTag> | StandardKeyData | 'ASSET' | StandardExplicitParentSimple) {
        // Handle cloning from another StandardExplicitParentSimple instance
        if (data instanceof StandardExplicitParentSimple) {
            this.payload = data.payload
            return
        }
        
        if (data instanceof StandardExplicitParentSimpleBase) {
            this.payload = data
            return
        }
        
        // Handle ASSET sentinel or empty array (explicitly asset level)
        if (data === 'ASSET' || (Array.isArray(data) && data.length === 0)) {
            this.payload = new StandardExplicitParentSimpleBase('ASSET')
            return
        }
        
        const delta = factory(isRenderTree(data) ? renderTreeToSchema(data) : data)
        if (delta && delta.add && !delta.remove) {
            this.payload = delta.add
            return
        }
        throw new Error('Invalid data in StandardExplicitParentSimple')
    }
    get schema() {
        // If payload schema is already a Parent tag (ASSET case), return it directly
        const payloadSchema = this.payload.schema
        if (payloadSchema.length === 1 && payloadSchema[0].data?.tag === 'Parent') {
            return payloadSchema
        }
        // Otherwise, wrap the payload schema in a Parent tag
        return [{ data: { tag: 'Parent' as const }, children: payloadSchema }]
    }
    nestedSchema(tag) {
        return [{ data: tag, children: this.schema }]
    }
    get _delta(): StandardEditableDataDelta<StandardKeyData | 'ASSET'> {
        return { add: this.payload.toJSON() }
    }
    clone() {
        return new StandardExplicitParentSimple(this.payload)
    }
    toJSON: () => StandardEditableData<StandardKeyData | 'ASSET'> = () => {
        return this.payload.toJSON()
    }
    get plain() { 
        return this.payload 
    }
    merge(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        // Normal merge - the delta system handles ASSET sentinel values
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        // Normal diff - the delta system handles ASSET sentinel values
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardExplicitParentRemove implements StandardEditableWrapper<StandardExplicitParentSimpleBase> {
    match: StandardExplicitParentSimpleBase
    constructor(data: StandardExplicitParentSimpleBase | StandardEditableData<StandardKeyData | 'ASSET'> | RenderTree | GenericTree<SchemaTag> | StandardKeyData | 'ASSET') {
        if (data instanceof StandardExplicitParentSimpleBase) {
            this.match = data
            return
        }
        const delta = factory(isRenderTree(data) ? renderTreeToSchema(data) : data)
        if (delta && !delta.add && delta.remove) {
            // Factory returns payload instances in delta
            this.match = delta.remove
            return
        }
        console.log(`Invalid data: ${JSON.stringify(data)}`)
        throw new Error('Invalid data in StandardExplicitParentRemove')
    }
    get schema() {
        return [{ data: { tag: 'Remove' as const }, children: [{ data: { tag: 'Parent' as const }, children: this.match.schema }] }]
    }
    nestedSchema(tag) {
        return [{
            data: { tag: 'Remove' as const },
            children: [{ data: tag, children: [{ data: { tag: 'Parent' as const }, children: this.match.schema }] }]
        }]
    }
    get _delta(): StandardEditableDataDelta<StandardKeyData | 'ASSET'> {
        return { remove: this.match.toJSON() }
    }
    clone() {
        return new StandardExplicitParentRemove(this.match)
    }
    toJSON: () => StandardEditableData<StandardKeyData | 'ASSET'> = () => ({ tag: 'Remove' as const, match: this.match.toJSON() })
    get plain() { return this.match }
    merge(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardExplicitParentReplace implements StandardEditableWrapper<StandardExplicitParentSimpleBase> {
    match: StandardExplicitParentSimpleBase
    payload: StandardExplicitParentSimpleBase
    constructor(...args: [StandardEditableData<StandardKeyData | 'ASSET'> | RenderTree | GenericTree<SchemaTag> | StandardKeyData | 'ASSET'] | [StandardExplicitParentSimpleBase, StandardExplicitParentSimpleBase]) {
        if (args.length === 2) {
            this.match = args[0]
            this.payload = args[1]
            return
        }
        const delta = factory(isRenderTree(args[0]) ? renderTreeToSchema(args[0]) : args[0])
        if (delta && delta.add && delta.remove) {
            // Factory returns payload instances in delta
            this.match = delta.remove
            this.payload = delta.add
            return
        }
        throw new Error('Invalid data in StandardExplicitParentReplace')
    }
    get schema() {
        return [{ data: { tag: 'Replace' as const }, children: [
            { data: { tag: 'ReplaceMatch' as const }, children: [{ data: { tag: 'Parent' as const }, children: this.match.schema }] },
            { data: { tag: 'ReplacePayload' as const }, children: [{ data: { tag: 'Parent' as const }, children: this.payload.schema }] }
        ] }]
    }
    nestedSchema(tag) {
        return [{
            data: { tag: 'Replace' as const },
            children: [
                {
                    data: { tag: 'ReplaceMatch' as const },
                    children: [{ data: tag, children: [{ data: { tag: 'Parent' as const }, children: this.match.schema }] }]
                },
                {
                    data: { tag: 'ReplacePayload' as const },
                    children: [{ data: tag, children: [{ data: { tag: 'Parent' as const }, children: this.payload.schema }] }]
                }
            ]
        }]
    }
    get _delta(): StandardEditableDataDelta<StandardKeyData | 'ASSET'> {
        return { remove: this.match.toJSON(), add: this.payload.toJSON() }
    }
    clone() {
        return new StandardExplicitParentReplace(this.match, this.payload)
    }
    toJSON: () => StandardEditableData<StandardKeyData | 'ASSET'> = () => ({ 
        tag: 'Replace' as const,
        match: this.match.toJSON(),
        payload: this.payload.toJSON()
    })
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardExplicitParent {
    _payload: StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined;
    
    constructor(arg: any) {
        if (arg instanceof StandardExplicitParentSimple || arg instanceof StandardExplicitParentRemove || arg instanceof StandardExplicitParentReplace) {
            this._payload = arg
            return
        }
        // Handle cloning from another StandardExplicitParent instance
        if (arg instanceof StandardExplicitParent) {
            this._payload = arg._payload
            return
        }
        const delta = factory(isRenderTree(arg) ? renderTreeToSchema(arg) : arg)
        if (!delta) {
            // Handle empty Parent tag (self-closing) - explicitly set to asset level
            // Create StandardExplicitParentSimple with 'ASSET' sentinel
            this._payload = new StandardExplicitParentSimple('ASSET')
            return
        }
        if (delta.add) {
            if (delta.remove) {
                this._payload = new StandardExplicitParentReplace(arg)
                return
            }
            this._payload = new StandardExplicitParentSimple(arg)
            return
        }
        if (delta.remove) {
            this._payload = new StandardExplicitParentRemove(arg)
            return
        }
        // Empty delta - explicitly set to asset level
        this._payload = new StandardExplicitParentSimple('ASSET')
    }

    get schema(): GenericTree<SchemaTag> {
        if (!this._payload) {
            return [{ data: { tag: 'Parent' as const }, children: [] }]
        }
        return this._payload.schema
    }

    nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        if (!this._payload) {
            return [{ data: tag, children: [{ data: { tag: 'Parent' as const }, children: [] }] }]
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
        // Both have payloads - let the delta system handle ASSET sentinel values
        // Note: Remove + Add with different values is valid for Replace operations (used in diff)
        // The underlying merge logic will handle conflicts appropriately
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            return new StandardExplicitParent(merged)
        }
        return undefined
    }
    diff(incoming: StandardExplicitParent | undefined): StandardExplicitParent | undefined {
        if (!incoming) {
            if (this._payload) {
                const reversedDelta = this._payload._delta
                if (reversedDelta) {
                    if (reversedDelta.add) {
                        // reversedDelta.add is StandardKeyData | 'ASSET' - constructor handles both
                        return new StandardExplicitParent(new StandardExplicitParentRemove(new StandardExplicitParentSimpleBase(reversedDelta.add)))
                    }
                    if (reversedDelta.remove) {
                        // reversedDelta.remove is StandardKeyData | 'ASSET' - constructor handles both
                        return new StandardExplicitParent(new StandardExplicitParentSimple(new StandardExplicitParentSimpleBase(reversedDelta.remove)))
                    }
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
            const reversedDelta = this._payload._delta
            if (reversedDelta && reversedDelta.add) {
                // reversedDelta.add is StandardKeyData | 'ASSET' - constructor handles both
                return new StandardExplicitParent(new StandardExplicitParentRemove(new StandardExplicitParentSimpleBase(reversedDelta.add)))
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
        if (this._payload instanceof StandardExplicitParentSimple && this._payload.payload.data === 'ASSET') {
            return this
        }
        if (!this._payload) {
            return this
        }
        if (this._payload instanceof StandardExplicitParentSimple) {
            const currentValue = this._payload.payload.toJSON()
            // Don't map ASSET sentinel
            if (currentValue === 'ASSET') {
                return this
            }
            const mapped = callback(currentValue)
            return new StandardExplicitParent(new StandardExplicitParentSimple(mapped))
        }
        if (this._payload instanceof StandardExplicitParentRemove) {
            const currentValue = this._payload.match.toJSON()
            // Don't map ASSET sentinel
            if (currentValue === 'ASSET') {
                return this
            }
            const mapped = callback(currentValue)
            // Remove constructor expects StandardEditableData format or StandardExplicitParentSimpleBase
            return new StandardExplicitParent(new StandardExplicitParentRemove({ tag: 'Remove', match: mapped }))
        }
        if (this._payload instanceof StandardExplicitParentReplace) {
            const matchValue = this._payload.match.toJSON()
            const payloadValue = this._payload.payload.toJSON()
            const mappedMatch = matchValue === 'ASSET' ? 'ASSET' : callback(matchValue)
            const mappedPayload = payloadValue === 'ASSET' ? 'ASSET' : callback(payloadValue)
            const matchBase = mappedMatch === 'ASSET' ? new StandardExplicitParentSimpleBase('ASSET') : new StandardExplicitParentSimpleBase(mappedMatch)
            const payloadBase = mappedPayload === 'ASSET' ? new StandardExplicitParentSimpleBase('ASSET') : new StandardExplicitParentSimpleBase(mappedPayload)
            return new StandardExplicitParent(new StandardExplicitParentReplace(matchBase, payloadBase))
        }
        throw new Error('Invalid StandardExplicitParent payload')
    }

    get standardKey(): StandardKey | 'ASSET' | undefined {
        if (!this._payload) return undefined
        if (this._payload instanceof StandardExplicitParentRemove) {
            return undefined
        }
        if (this._payload instanceof StandardExplicitParentSimple) {
            return this._payload.payload.data
        }
        if (this._payload instanceof StandardExplicitParentReplace) {
            // Outgoing payload (not match) is the "next" value
            return this._payload.payload.data
        }
        return undefined
    }

    invert(): StandardExplicitParent {
        if (!this._payload) {
            // Undefined/empty parent - return as-is (no inversion needed)
            return new StandardExplicitParent(this)
        }
        if (this._payload instanceof StandardExplicitParentSimple) {
            return new StandardExplicitParent(new StandardExplicitParentRemove(this._payload.payload))
        }
        if (this._payload instanceof StandardExplicitParentRemove) {
            return new StandardExplicitParent(new StandardExplicitParentSimple(this._payload.match))
        }
        if (this._payload instanceof StandardExplicitParentReplace) {
            return new StandardExplicitParent(new StandardExplicitParentReplace(this._payload.payload, this._payload.match))
        }
        throw new Error('Invalid StandardExplicitParent payload for invert')
    }

    
}
