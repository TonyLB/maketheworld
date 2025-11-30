import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { StandardEditableDataDelta, standardEditableFactory, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isRenderTree, RenderTree, renderTreeToSchema } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { ComponentUUID, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardKey } from "../components/reference"
import { StandardKeyData } from "../components/dataTypes/reference"
import { isLegalKey } from "../utils"

//
// StandardExplicitParentSimpleBase holds the contents for a simple StandardExplicitParent
// Now stores a StandardKey instead of ComponentUUID, allowing both ComponentUUID and legalKey formats
//
export class StandardExplicitParentSimpleBase implements StandardEditablePayload<StandardKeyData> {
    data: StandardKey
    get schema() {
        // Generate schema from StandardKey - use key if available, otherwise universalKey
        if (this.data.key) {
            // For local keys, generate a String tag with the key value
            return [{ data: { tag: 'String' as const, value: this.data.key }, children: [] }]
        }
        if (this.data.universalKey) {
            // For universal keys, generate a String tag with the universalKey value
            return [{ data: { tag: 'String' as const, value: this.data.universalKey }, children: [] }]
        }
        throw new Error('StandardExplicitParentSimpleBase must have either key or universalKey')
    }
    constructor(data: StandardKey | ComponentUUID | string | StandardKeyData) {
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
            throw new Error(`Invalid parent value: must be ComponentUUID or legalKey, got: ${data}`)
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
    toJSON: () => StandardKeyData = () => this.data.toJSON()
}

const payloadFactory = (props: StandardKeyData | GenericTree<SchemaTag>): StandardExplicitParentSimpleBase | undefined => {
    // Handle StandardKeyData (string ComponentUUID or object with key/universalKey)
    if (typeof props === 'string') {
        // Can be ComponentUUID or legalKey
        if (isSchemaComponentUUID(props) || isLegalKey(props)) {
            return new StandardExplicitParentSimpleBase(props)
        }
        throw new Error(`Invalid parent value: must be ComponentUUID or legalKey, got: ${props}`)
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
            // Empty Parent tag (self-closing)
            if (combinedValue === '') {
                return undefined
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
    // Handle empty Parent tag (self-closing) - return undefined to represent no parent
    if (Array.isArray(props) && props.length === 0) {
        return undefined
    }
    throw new Error('Invalid argument in StandardExplicitParentSimpleBase constructor')
}

// Parent values can only be added if they match exactly (no partial matches)
const standardExplicitParentAdd = (base: StandardKeyData, incoming: StandardKeyData): StandardKeyData => {
    const baseKey = new StandardKey(base)
    const incomingKey = new StandardKey(incoming)
    // For Parent, adding means replacing - they must match exactly
    if (baseKey.equals(incomingKey)) {
        return base
    }
    // If they don't match, the incoming value replaces the base
    return incoming
}

// Parent values can only be removed if they match exactly (no partial matches)
const standardExplicitParentSubtract = (base: StandardKeyData, incoming: StandardKeyData): { add?: StandardKeyData, remove?: StandardKeyData } => {
    const baseKey = new StandardKey(base)
    const incomingKey = new StandardKey(incoming)
    // Only allow exact matches - partial matches are error conditions
    if (baseKey.equals(incomingKey)) {
        // Exact match: remove the value entirely
        return {}
    }
    // Partial matches are not allowed for Parent values
    throw new MergeConflictError('Parent values can only be removed or replaced if they match exactly. Partial matches are not allowed.')
}

// Parent values can only be diffed if they match exactly (no partial matches)
const standardExplicitParentDiff = (base: StandardKeyData, incoming: StandardKeyData): { add?: StandardKeyData, remove?: StandardKeyData } => {
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
    typeguard: (value: any): value is StandardKeyData => {
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

const fromDelta = (delta: { add?: StandardKeyData, remove?: StandardKeyData }): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined => {
    const { add, remove } = delta
    if (add) {
        if (remove) {
            // Convert StandardKeyData to StandardKey for construction
            const removeKey = typeof remove === 'string' ? remove : new StandardKey(remove)
            const addKey = typeof add === 'string' ? add : new StandardKey(add)
            return new StandardExplicitParentReplace(new StandardExplicitParentSimpleBase(removeKey), new StandardExplicitParentSimpleBase(addKey))
        }
        const addKey = typeof add === 'string' ? add : new StandardKey(add)
        return new StandardExplicitParentSimple(new StandardExplicitParentSimpleBase(addKey))
    }
    if (remove) {
        const removeKey = typeof remove === 'string' ? remove : new StandardKey(remove)
        return new StandardExplicitParentRemove(new StandardExplicitParentSimpleBase(removeKey))
    }
    return undefined
}

export class StandardExplicitParentSimple implements StandardEditableWrapper<StandardExplicitParentSimpleBase> {
    payload: StandardExplicitParentSimpleBase
    constructor(data: StandardExplicitParentSimpleBase | StandardEditableData<StandardKeyData> | RenderTree | GenericTree<SchemaTag> | StandardKeyData) {
        if (data instanceof StandardExplicitParentSimpleBase) {
            this.payload = data
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
        return [{ data: { tag: 'Parent' as const }, children: this.payload.schema }]
    }
    nestedSchema(tag) {
        return [{ data: tag, children: this.schema }]
    }
    get _delta(): StandardEditableDataDelta<StandardKeyData> {
        return { add: this.payload.toJSON() }
    }
    clone() {
        return new StandardExplicitParentSimple(this.payload)
    }
    toJSON: () => StandardEditableData<StandardKeyData> = () => this.payload.toJSON()
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardExplicitParentRemove implements StandardEditableWrapper<StandardExplicitParentSimpleBase> {
    match: StandardExplicitParentSimpleBase
    constructor(data: StandardExplicitParentSimpleBase | StandardEditableData<StandardKeyData> | RenderTree | GenericTree<SchemaTag> | StandardKeyData) {
        if (data instanceof StandardExplicitParentSimpleBase) {
            this.match = data
            return
        }
        const delta = factory(isRenderTree(data) ? renderTreeToSchema(data) : data)
        if (delta && !delta.add && delta.remove) {
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
    get _delta(): StandardEditableDataDelta<StandardKeyData> {
        return { remove: this.match.toJSON() }
    }
    clone() {
        return new StandardExplicitParentRemove(this.match)
    }
    toJSON: () => StandardEditableData<StandardKeyData> = () => ({ tag: 'Remove' as const, match: this.match.toJSON() })
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
    constructor(...args: [StandardEditableData<StandardKeyData> | RenderTree | GenericTree<SchemaTag> | StandardKeyData] | [StandardExplicitParentSimpleBase, StandardExplicitParentSimpleBase]) {
        if (args.length === 2) {
            this.match = args[0]
            this.payload = args[1]
            return
        }
        const delta = factory(isRenderTree(args[0]) ? renderTreeToSchema(args[0]) : args[0])
        if (delta && delta.add && delta.remove) {
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
    get _delta(): StandardEditableDataDelta<StandardKeyData> {
        return { remove: this.match.toJSON(), add: this.payload.toJSON() }
    }
    clone() {
        return new StandardExplicitParentReplace(this.match, this.payload)
    }
    toJSON: () => StandardEditableData<StandardKeyData> = () => ({ 
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
    _payload: StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace;
    
    constructor(arg: any) {
        if (arg instanceof StandardExplicitParentSimple || arg instanceof StandardExplicitParentRemove || arg instanceof StandardExplicitParentReplace) {
            this._payload = arg
            return
        }
        const delta = factory(isRenderTree(arg) ? renderTreeToSchema(arg) : arg)
        if (!delta) {
            // Handle empty Parent tag (self-closing) - represents no parent
            // Return undefined payload to indicate no parent value
            this._payload = undefined as any
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
        // Empty delta - no parent value
        this._payload = undefined as any
    }

    get schema(): GenericTree<SchemaTag> {
        if (!this._payload) {
            // Empty Parent tag (self-closing)
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

    toJSON(): StandardEditableData<StandardKeyData> | undefined {
        if (!this._payload) {
            return undefined
        }
        return this._payload.toJSON()
    }

    merge(incoming: StandardExplicitParent): StandardExplicitParent | undefined {
        if (!this._payload && !incoming._payload) {
            return undefined
        }
        if (!this._payload) {
            return incoming
        }
        if (!incoming._payload) {
            return this
        }
        // Check for Remove + Add mismatch (Parent-specific constraint)
        const thisDelta = this._payload._delta
        const incomingDelta = incoming._payload._delta
        if (thisDelta.remove && incomingDelta.add) {
            const removeKey = new StandardKey(thisDelta.remove)
            const addKey = new StandardKey(incomingDelta.add)
            if (!removeKey.equals(addKey)) {
                // For Parent values, Remove + Add with different values is an error
                throw new MergeConflictError('Parent values can only be removed or replaced if they match exactly. Partial matches are not allowed.')
            }
        }
        if (incomingDelta.remove && thisDelta.add) {
            const removeKey = new StandardKey(incomingDelta.remove)
            const addKey = new StandardKey(thisDelta.add)
            if (!removeKey.equals(addKey)) {
                // For Parent values, Remove + Add with different values is an error
                throw new MergeConflictError('Parent values can only be removed or replaced if they match exactly. Partial matches are not allowed.')
            }
        }
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
                        const addKey = typeof reversedDelta.add === 'string' ? reversedDelta.add : new StandardKey(reversedDelta.add)
                        return new StandardExplicitParent(new StandardExplicitParentRemove(new StandardExplicitParentSimpleBase(addKey)))
                    }
                    if (reversedDelta.remove) {
                        const removeKey = typeof reversedDelta.remove === 'string' ? reversedDelta.remove : new StandardKey(reversedDelta.remove)
                        return new StandardExplicitParent(new StandardExplicitParentSimple(new StandardExplicitParentSimpleBase(removeKey)))
                    }
                }
            }
            return undefined
        }
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
                const addKey = typeof reversedDelta.add === 'string' ? reversedDelta.add : new StandardKey(reversedDelta.add)
                return new StandardExplicitParent(new StandardExplicitParentRemove(new StandardExplicitParentSimpleBase(addKey)))
            }
            return undefined
        }
        const diffResult = this._payload.diff(incoming._payload)
        if (diffResult) {
            return new StandardExplicitParent(diffResult)
        }
        return undefined
    }
    mapContents(callback: (incoming: StandardKeyData) => StandardKeyData): StandardExplicitParent {
        if (!this._payload) {
            return this
        }
        if (this._payload instanceof StandardExplicitParentSimple) {
            const mapped = callback(this._payload.payload.toJSON())
            return new StandardExplicitParent(new StandardExplicitParentSimple(mapped))
        }
        if (this._payload instanceof StandardExplicitParentRemove) {
            const mapped = callback(this._payload.match.toJSON())
            // Remove constructor expects StandardEditableData format or StandardExplicitParentSimpleBase
            return new StandardExplicitParent(new StandardExplicitParentRemove({ tag: 'Remove', match: mapped }))
        }
        if (this._payload instanceof StandardExplicitParentReplace) {
            const mappedMatch = callback(this._payload.match.toJSON())
            const mappedPayload = callback(this._payload.payload.toJSON())
            const matchBase = new StandardExplicitParentSimpleBase(mappedMatch)
            const payloadBase = new StandardExplicitParentSimpleBase(mappedPayload)
            return new StandardExplicitParent(new StandardExplicitParentReplace(matchBase, payloadBase))
        }
        throw new Error('Invalid StandardExplicitParent payload')
    }
}

