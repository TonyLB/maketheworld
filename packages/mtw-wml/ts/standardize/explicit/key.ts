import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { StandardEditableDataDelta, standardEditableFactory, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isRenderTree, RenderTree, renderTreeToSchema } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { isSchemaKey } from "@tonylb/mtw-base/ts/schema/components"
import { isLegalKey } from "../utils"

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

export const { constructorDelta: factory, typeguard: isStandardExplicitKeyData, merge, diff } = standardEditableFactory({
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
    diff: standardExplicitKeyDiff
})

const fromDelta = (delta: { add?: string, remove?: string }): StandardExplicitKeySimple | StandardExplicitKeyRemove | StandardExplicitKeyReplace | undefined => {
    const { add, remove } = delta
    if (add) {
        if (remove) {
            // fromDelta receives data from _delta.toJSON(), create payload instances
            const removeBase = new StandardExplicitKeySimpleBase(remove)
            const addBase = new StandardExplicitKeySimpleBase(add)
            return new StandardExplicitKeyReplace(removeBase, addBase)
        }
        return new StandardExplicitKeySimple(add)
    }
    if (remove) {
        return new StandardExplicitKeyRemove(remove)
    }
    return undefined
}

export class StandardExplicitKeySimple implements StandardEditableWrapper<StandardExplicitKeySimpleBase> {
    payload: StandardExplicitKeySimpleBase
    
    constructor(data: StandardExplicitKeySimpleBase | StandardEditableData<string> | RenderTree | GenericTree<SchemaTag> | string | StandardExplicitKeySimple) {
        // Handle cloning from another StandardExplicitKeySimple instance
        if (data instanceof StandardExplicitKeySimple) {
            this.payload = data.payload
            return
        }
        
        if (data instanceof StandardExplicitKeySimpleBase) {
            this.payload = data
            return
        }
        
        // Empty array is not allowed (unlike Parent)
        if (Array.isArray(data) && data.length === 0) {
            throw new Error('Key tag must contain a legalKey value')
        }
        
        const delta = factory(isRenderTree(data) ? renderTreeToSchema(data) : data)
        if (delta && delta.add && !delta.remove) {
            this.payload = delta.add
            return
        }
        throw new Error('Invalid data in StandardExplicitKeySimple')
    }
    get schema() {
        // Wrap the payload schema in a Key tag
        return [{ data: { tag: 'Key' as const }, children: this.payload.schema }]
    }
    nestedSchema(tag) {
        return [{ data: tag, children: this.schema }]
    }
    get _delta(): StandardEditableDataDelta<string> {
        return { add: this.payload.toJSON() }
    }
    clone() {
        return new StandardExplicitKeySimple(this.payload)
    }
    toJSON: () => StandardEditableData<string> = () => {
        return this.payload.toJSON()
    }
    get plain() { 
        return this.payload 
    }
    merge(other: StandardEditableWrapper<StandardExplicitKeySimpleBase>): StandardExplicitKeySimple | StandardExplicitKeyRemove | StandardExplicitKeyReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExplicitKeySimpleBase>): StandardExplicitKeySimple | StandardExplicitKeyRemove | StandardExplicitKeyReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardExplicitKeyRemove implements StandardEditableWrapper<StandardExplicitKeySimpleBase> {
    match: StandardExplicitKeySimpleBase
    constructor(data: StandardExplicitKeySimpleBase | StandardEditableData<string> | RenderTree | GenericTree<SchemaTag> | string) {
        if (data instanceof StandardExplicitKeySimpleBase) {
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
        throw new Error('Invalid data in StandardExplicitKeyRemove')
    }
    get schema() {
        return [{ data: { tag: 'Remove' as const }, children: [{ data: { tag: 'Key' as const }, children: this.match.schema }] }]
    }
    nestedSchema(tag) {
        return [{
            data: { tag: 'Remove' as const },
            children: [{ data: tag, children: [{ data: { tag: 'Key' as const }, children: this.match.schema }] }]
        }]
    }
    get _delta(): StandardEditableDataDelta<string> {
        return { remove: this.match.toJSON() }
    }
    clone() {
        return new StandardExplicitKeyRemove(this.match)
    }
    toJSON: () => StandardEditableData<string> = () => ({ tag: 'Remove' as const, match: this.match.toJSON() })
    get plain() { return this.match }
    merge(other: StandardEditableWrapper<StandardExplicitKeySimpleBase>): StandardExplicitKeySimple | StandardExplicitKeyRemove | StandardExplicitKeyReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExplicitKeySimpleBase>): StandardExplicitKeySimple | StandardExplicitKeyRemove | StandardExplicitKeyReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardExplicitKeyReplace implements StandardEditableWrapper<StandardExplicitKeySimpleBase> {
    match: StandardExplicitKeySimpleBase
    payload: StandardExplicitKeySimpleBase
    constructor(...args: [StandardEditableData<string> | RenderTree | GenericTree<SchemaTag> | string] | [StandardExplicitKeySimpleBase, StandardExplicitKeySimpleBase]) {
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
        throw new Error('Invalid data in StandardExplicitKeyReplace')
    }
    get schema() {
        return [{ data: { tag: 'Replace' as const }, children: [
            { data: { tag: 'ReplaceMatch' as const }, children: [{ data: { tag: 'Key' as const }, children: this.match.schema }] },
            { data: { tag: 'ReplacePayload' as const }, children: [{ data: { tag: 'Key' as const }, children: this.payload.schema }] }
        ] }]
    }
    nestedSchema(tag) {
        return [{
            data: { tag: 'Replace' as const },
            children: [
                {
                    data: { tag: 'ReplaceMatch' as const },
                    children: [{ data: tag, children: [{ data: { tag: 'Key' as const }, children: this.match.schema }] }]
                },
                {
                    data: { tag: 'ReplacePayload' as const },
                    children: [{ data: tag, children: [{ data: { tag: 'Key' as const }, children: this.payload.schema }] }]
                }
            ]
        }]
    }
    get _delta(): StandardEditableDataDelta<string> {
        return { remove: this.match.toJSON(), add: this.payload.toJSON() }
    }
    clone() {
        return new StandardExplicitKeyReplace(this.match, this.payload)
    }
    toJSON: () => StandardEditableData<string> = () => ({ 
        tag: 'Replace' as const,
        match: this.match.toJSON(),
        payload: this.payload.toJSON()
    })
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardExplicitKeySimpleBase>): StandardExplicitKeySimple | StandardExplicitKeyRemove | StandardExplicitKeyReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExplicitKeySimpleBase>): StandardExplicitKeySimple | StandardExplicitKeyRemove | StandardExplicitKeyReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardExplicitKey {
    _payload: StandardExplicitKeySimple | StandardExplicitKeyRemove | StandardExplicitKeyReplace | undefined;
    
    constructor(arg: any) {
        if (arg instanceof StandardExplicitKeySimple || arg instanceof StandardExplicitKeyRemove || arg instanceof StandardExplicitKeyReplace) {
            this._payload = arg
            return
        }
        // Handle cloning from another StandardExplicitKey instance
        if (arg instanceof StandardExplicitKey) {
            this._payload = arg._payload
            return
        }
        const delta = factory(isRenderTree(arg) ? renderTreeToSchema(arg) : arg)
        if (!delta) {
            // Empty Key tag is not allowed
            throw new Error('Key tag must contain a legalKey value')
        }
        if (delta.add) {
            if (delta.remove) {
                this._payload = new StandardExplicitKeyReplace(arg)
                return
            }
            this._payload = new StandardExplicitKeySimple(arg)
            return
        }
        if (delta.remove) {
            this._payload = new StandardExplicitKeyRemove(arg)
            return
        }
        // Empty delta - not allowed for Key
        throw new Error('Key tag must contain a legalKey value')
    }

    get schema(): GenericTree<SchemaTag> {
        if (!this._payload) {
            // Undefined payload - this should not happen in normal usage
            throw new Error('StandardExplicitKey must have a payload')
        }
        return this._payload.schema
    }

    nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        if (!this._payload) {
            // Undefined payload - this should not happen in normal usage
            throw new Error('StandardExplicitKey must have a payload')
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
        // Both have payloads - merge them
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            return new StandardExplicitKey(merged)
        }
        return undefined
    }
    diff(incoming: StandardExplicitKey | undefined): StandardExplicitKey | undefined {
        if (!incoming) {
            if (this._payload) {
                const reversedDelta = this._payload._delta
                if (reversedDelta) {
                    if (reversedDelta.add) {
                        return new StandardExplicitKey(new StandardExplicitKeyRemove(new StandardExplicitKeySimpleBase(reversedDelta.add)))
                    }
                    if (reversedDelta.remove) {
                        return new StandardExplicitKey(new StandardExplicitKeySimple(new StandardExplicitKeySimpleBase(reversedDelta.remove)))
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
            // This has no key, incoming has a key - return incoming as the diff
            return incoming
        }
        if (!incoming._payload) {
            // This has a key, incoming has no key - return removal of this
            const reversedDelta = this._payload._delta
            if (reversedDelta && reversedDelta.add) {
                return new StandardExplicitKey(new StandardExplicitKeyRemove(new StandardExplicitKeySimpleBase(reversedDelta.add)))
            }
            return undefined
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
        if (this._payload instanceof StandardExplicitKeySimple) {
            const currentValue = this._payload.payload.toJSON()
            const mapped = callback(currentValue)
            return new StandardExplicitKey(new StandardExplicitKeySimple(mapped))
        }
        if (this._payload instanceof StandardExplicitKeyRemove) {
            const currentValue = this._payload.match.toJSON()
            const mapped = callback(currentValue)
            // Remove constructor expects StandardEditableData format or StandardExplicitKeySimpleBase
            return new StandardExplicitKey(new StandardExplicitKeyRemove({ tag: 'Remove', match: mapped }))
        }
        if (this._payload instanceof StandardExplicitKeyReplace) {
            const matchValue = this._payload.match.toJSON()
            const payloadValue = this._payload.payload.toJSON()
            const mappedMatch = callback(matchValue)
            const mappedPayload = callback(payloadValue)
            const matchBase = new StandardExplicitKeySimpleBase(mappedMatch)
            const payloadBase = new StandardExplicitKeySimpleBase(mappedPayload)
            return new StandardExplicitKey(new StandardExplicitKeyReplace(matchBase, payloadBase))
        }
        throw new Error('Invalid StandardExplicitKey payload')
    }

    invert(): StandardExplicitKey {
        if (!this._payload) {
            // Undefined payload - return as-is (no inversion needed)
            return new StandardExplicitKey(this)
        }
        if (this._payload instanceof StandardExplicitKeySimple) {
            return new StandardExplicitKey(new StandardExplicitKeyRemove(this._payload.payload))
        }
        if (this._payload instanceof StandardExplicitKeyRemove) {
            return new StandardExplicitKey(new StandardExplicitKeySimple(this._payload.match))
        }
        if (this._payload instanceof StandardExplicitKeyReplace) {
            return new StandardExplicitKey(new StandardExplicitKeyReplace(this._payload.payload, this._payload.match))
        }
        throw new Error('Invalid StandardExplicitKey payload for invert')
    }
}
