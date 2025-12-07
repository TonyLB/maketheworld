import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { ComponentUUID, isSchemaComponent, isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { ComponentTag, componentTagFromUpperCase } from "./dataTypes/abstract";
import { isStandardKeyData, isStandardReferencePayloadData, StandardKeyData, StandardReferenceData } from "./dataTypes/reference";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { StandardEditableDataDelta, standardEditableFactory, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { ReferenceFormat } from "./utils/references";
import { editableListClassFactory, EditableListItem } from "./editableList";

export class StandardKey implements StandardEditablePayload<StandardKeyData> {
    key?: string;
    universalKey?: ComponentUUID;
    constructor(data: string | { key?: string; universalKey?: ComponentUUID } | StandardKeyData | StandardReferenceData | StandardKey) {
        // Handle StandardKey instance directly (for cloning)
        if (data instanceof StandardKey) {
            this.key = data.key
            this.universalKey = data.universalKey
            return
        }
        
        if (typeof data === 'string') {
            if (!isSchemaComponentUUID(data)) {
                console.log(`Invalid StandardKeyData passed to StandardKey: ${JSON.stringify(data, null, 4)}`)
                throw new Error('Invalid StandardKeyData passed to StandardKey')
            }
            this.universalKey = data
        }
        else {
            if (!data.key && !data.universalKey) {
                throw new Error('StandardKey must have a key or universalKey')
            }
            this.key = data.key
            this.universalKey = data.universalKey
        }
    }
    get tag(): ComponentTag | undefined {
        if (typeof this.universalKey === 'undefined') {
            return undefined
        }
        const [upcaseTag] = this.universalKey.split('#')
        return componentTagFromUpperCase(upcaseTag as Uppercase<ComponentTag>)
    }
    get schema() {
        const tag = this.tag
        if (tag === undefined) {
            throw new Error('StandardKey.schema requires tag to be derivable from universalKey')
        }
        return [{
            data: {
                tag,
                key: this.key,
                uuid: this.universalKey
            } as SchemaTag,
            children: []
        }]
    }
    clone() {
        return new StandardKey(this)
    }
    toJSON: () => StandardKeyData = () => {
        // StandardKeyData preserves both key and universalKey (unlike StandardReferenceData which requires tag)
        if (this.universalKey && !this.key) {
            return this.universalKey
        }
        if (this.key) {
            return { key: this.key, universalKey: this.universalKey }
        }
        throw new Error('StandardKey must have a universalKey or key')
    }
    withKey(key: string): StandardKey {
        const returnValue = this.clone()
        returnValue.key = key
        return returnValue
    }
    // context support has been removed; hierarchical relationships are handled at the component level
    
    equals(other: StandardKey): boolean {
        //
        // Returns if the two objects share either the same key or the same universalKey,
        // and have no other differences
        //
        // Compare tags if both can be derived
        const thisTag = this.tag
        const otherTag = other.tag
        if (thisTag !== undefined && otherTag !== undefined && thisTag !== otherTag) {
            return false
        }
        if (this.universalKey && other.universalKey && this.universalKey !== other.universalKey) {
            return false
        }
        if (this.key && other.key && this.key !== other.key) {
            return false
        }
        if (this.key === other.key || this.universalKey === other.universalKey) {
            return true
        }
        return false
    }

    merge(other: StandardKey): StandardKey {
        const returnValue = this.clone()
        if (other.key) {
            returnValue.key = other.key
        }
        if (other.universalKey && returnValue.universalKey && returnValue.universalKey !== other.universalKey) {
            throw new MergeConflictError('Mismatched universalKeys in StandardKey merge')
        }
        if (other.universalKey) {
            returnValue.universalKey = other.universalKey
        }
        return returnValue
    }

    get plain(): StandardKey {
        return this.clone()
    }

    toFormat(format: ReferenceFormat): StandardKey {
        if (format === 'both') {
            return this.clone()
        }
        const returnValue = this.clone()
        if (format === 'key') {
            if (returnValue.key) {
                returnValue.universalKey = undefined
            }
        }
        else {
            if (returnValue.universalKey) {
                returnValue.key = undefined
            }
        }
        return returnValue
    }
}

// StandardReferencePayload: Payload class that stores StandardReferenceData (including tag)
export class StandardReferencePayload implements StandardEditablePayload<StandardReferenceData> {
    key?: string
    universalKey?: ComponentUUID
    _tag: ComponentTag // Required - stored in payload for StandardReferenceData
    
    constructor(data: StandardReferenceData | GenericTree<SchemaTag> | StandardReferencePayload) {
        // Handle cloning
        if (data instanceof StandardReferencePayload) {
            this.key = data.key
            this.universalKey = data.universalKey
            this._tag = data._tag
            return
        }
        
        // Handle ComponentUUID string
        if (typeof data === 'string') {
            // Runtime fail-safe: TypeScript narrows to ComponentUUID, but validate at runtime
            if (!isSchemaComponentUUID(data)) {
                throw new Error('Invalid StandardReferenceData passed to StandardReferencePayload')
            }
            this.universalKey = data
            // Derive tag from ComponentUUID
            const [upcaseTag] = data.split('#')
            const derivedTag = componentTagFromUpperCase(upcaseTag as Uppercase<ComponentTag>)
            if (!derivedTag) {
                throw new Error('Cannot derive tag from ComponentUUID')
            }
            this._tag = derivedTag
            return
        }
        
        // Handle StandardReferenceData object
        if (isStandardReferencePayloadData(data)) {
            this.key = data.key
            this.universalKey = data.universalKey
            // Runtime fail-safe: TypeScript requires tag in object form, but validate at runtime
            if (!data.tag && !data.universalKey) {
                throw new Error('StandardReferenceData object form requires tag')
            }
            this._tag = data.tag ?? deriveTagFromReferenceData(data)
            return
        }
        
        // Handle GenericTree<SchemaTag>
        if (Array.isArray(data) && data.length === 1) {
            const node = data[0]
            if (!treeNodeTypeguard(isSchemaComponent)(node)) {
                throw new Error('Invalid GenericTree<SchemaTag> in StandardReferencePayload constructor')
            }
            const { key, uuid, tag } = node.data
            this.key = key
            this.universalKey = uuid
            if (!tag) {
                throw new Error('Schema node requires tag for StandardReferencePayload')
            }
            this._tag = tag
            return
        }
        
        throw new Error('Invalid argument in StandardReferencePayload constructor')
    }
    
    get tag(): ComponentTag {
        return this._tag
    }
    
    get standardKey(): StandardKey {
        return new StandardKey(this.key ? { key: this.key, universalKey: this.universalKey } : this.universalKey as ComponentUUID)
    }
    
    get schema() {
        return [{
            data: {
                tag: this._tag,
                key: this.key,
                uuid: this.universalKey
            } as SchemaTag,
            children: []
        }]
    }
    
    clone() {
        return new StandardReferencePayload(this)
    }
    
    toJSON: () => StandardReferenceData = () => {
        if (!this.key && this.universalKey) {
            // If only universalKey, return ComponentUUID string form
            return this.universalKey
        }
        if (this.key) {
            // Object form - tag is required
            return { key: this.key, universalKey: this.universalKey, tag: this._tag }
        }
        throw new Error('StandardReferencePayload must have a universalKey or key')
    }
}

const payloadFactory = (props: StandardReferenceData | GenericTree<SchemaTag>): StandardReferencePayload | undefined => {
    try {
        return new StandardReferencePayload(props)
    } catch (error) {
        return undefined
    }
}

export const standardReferenceDeserialize = (incoming: StandardReferenceData): Exclude<StandardReferenceData, string> => {
    if (typeof incoming === 'string') {
        if (!isSchemaComponentUUID(incoming)) {
            throw new Error('Invalid StandardReferenceData passed to standardReferenceDeserialize')
        }
        // Return object form with tag derived from ComponentUUID
        const [upcaseTag] = incoming.split('#')
        const tag = componentTagFromUpperCase(upcaseTag as Uppercase<ComponentTag>)
        return { universalKey: incoming, key: '', tag }
    }
    return incoming;
}

export const standardReferenceSerialize = (incoming: StandardReferenceData): StandardReferenceData => {
    if (typeof incoming === 'string') {
        if (!isSchemaComponentUUID(incoming)) {
            throw new Error('Invalid StandardReferenceData passed to standardReferenceSerialize')
        }
        return incoming
    }
    const { universalKey, key } = incoming
    if (key) {
        return incoming
    }
    if (!universalKey) {
        throw new Error('StandardReferenceData must have a universalKey or key')
    }
    return universalKey
}

const standardReferenceAdd = (base: StandardReferenceData, incoming: StandardReferenceData): StandardReferenceData => {
    return incoming
}

const standardReferenceSubtract = (base: StandardReferenceData, incoming: StandardReferenceData): { add?: StandardReferenceData; remove?: StandardReferenceData } => {
    const baseDeserialized = standardReferenceDeserialize(base)
    const incomingDeserialized = standardReferenceDeserialize(incoming)
    if ((baseDeserialized.key && incomingDeserialized.key && baseDeserialized.key === incomingDeserialized.key) ||
        (baseDeserialized.universalKey && incomingDeserialized.universalKey && baseDeserialized.universalKey === incomingDeserialized.universalKey)) {
        return { add: undefined, remove: undefined }
    }
    else {
        console.log(`Conflict in subtract operation: base=${JSON.stringify(base)}, incoming=${JSON.stringify(incoming)}`)
        throw new MergeConflictError('Conflict during subtract operation')
    }
}

const standardReferenceDiff = (base: StandardReferenceData, incoming: StandardReferenceData): { add?: StandardReferenceData, remove?: StandardReferenceData } => {
    const baseDeserialized = standardReferenceDeserialize(base)
    const incomingDeserialized = standardReferenceDeserialize(incoming)
    if ((baseDeserialized.key && incomingDeserialized.key && baseDeserialized.key === incomingDeserialized.key) ||
        (baseDeserialized.universalKey && incomingDeserialized.universalKey && baseDeserialized.universalKey === incomingDeserialized.universalKey)) {
        return { add: undefined, remove: undefined }
    }
    else {
        return { add: standardReferenceSerialize(incoming), remove: standardReferenceSerialize(base) }
    }
}

export const { constructorDelta: factory, typeguard: isStandardReferenceData, merge, diff } = standardEditableFactory({
    typeguard: isStandardReferencePayloadData,
    payloadFactory: payloadFactory,
    payload: StandardReferencePayload,
    add: standardReferenceAdd,
    subtract: standardReferenceSubtract,
    diff: standardReferenceDiff
})

// Helper function to derive tag from various data sources
const deriveTagFromReferenceData = (
    data: StandardReferenceData | StandardKey | undefined,
    explicitTag?: ComponentTag
): ComponentTag | undefined => {
    // If explicit tag is provided, use it
    if (explicitTag) {
        return explicitTag
    }
    
    // If data is StandardKey, try to derive from it
    if (data instanceof StandardKey) {
        return data.tag
    }
    
    // If data is StandardReferenceData object with tag, use it
    if (typeof data === 'object' && data !== null && 'tag' in data && data.tag) {
        return data.tag
    }
    
    // If data is ComponentUUID string, derive from prefix
    if (typeof data === 'string' && isSchemaComponentUUID(data)) {
        const [upcaseTag] = data.split('#')
        return componentTagFromUpperCase(upcaseTag as Uppercase<ComponentTag>)
    }
    
    // If data is object with universalKey, derive from it
    if (typeof data === 'object' && data !== null && 'universalKey' in data) {
        const obj = data as { universalKey?: ComponentUUID }
        if (obj.universalKey) {
            const [upcaseTag] = obj.universalKey.split('#')
            return componentTagFromUpperCase(upcaseTag as Uppercase<ComponentTag>)
        }
    }
    
    return undefined
}

const fromDelta = (delta: StandardEditableDataDelta<StandardReferenceData>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined => {
    const { add, remove } = delta
    if (add) {
        const addPayload = new StandardReferencePayload(add)
        if (remove) {
            const removePayload = new StandardReferencePayload(remove)
            return new StandardReferenceReplace(removePayload, addPayload)
        }
        return new StandardReferenceSimple(addPayload)
    }
    if (remove) {
        const removePayload = new StandardReferencePayload(remove)
        return new StandardReferenceRemove(removePayload)
    }
    return undefined
}

export class StandardReferenceSimple implements StandardEditableWrapper<StandardReferencePayload> {
    payload: StandardReferencePayload
    constructor(
        data: StandardReferencePayload | StandardKey | StandardEditableData<StandardReferenceData> | GenericTree<SchemaTag> | string,
        explicitTag?: ComponentTag
    ) {
        // Handle StandardReferencePayload directly
        if (data instanceof StandardReferencePayload) {
            this.payload = data
            return
        }
        
        // Handle StandardKey with explicit tag - convert to StandardReferencePayload
        if (data instanceof StandardKey) {
            const derivedTag = explicitTag ?? deriveTagFromReferenceData(data)
            if (!derivedTag) {
                throw new Error(`StandardReferenceSimple requires derivable tag. Data: ${JSON.stringify(data)}`)
            }
            const keyData = data.toJSON() // Returns StandardKeyData
            // Convert StandardKeyData to StandardReferenceData
            const referenceData: StandardReferenceData = typeof keyData === 'string' 
                ? keyData 
                : { ...keyData, tag: derivedTag }
            this.payload = new StandardReferencePayload(referenceData)
            return
        }
        
        // Handle StandardKeyData (plain object) with explicit tag - convert to StandardReferencePayload
        if (explicitTag && isStandardKeyData(data)) {
            // Convert StandardKeyData to StandardReferenceData by adding the tag
            const referenceData: StandardReferenceData = typeof data === 'string'
                ? data
                : { ...data, tag: explicitTag }
            this.payload = new StandardReferencePayload(referenceData)
            return
        }
        
        // Handle StandardReferenceData or GenericTree - use factory
        const delta = factory(data)
        if (delta && delta.add && !delta.remove) {
            this.payload = delta.add
            return
        }
        throw new Error('Invalid data in StandardReferenceSimple')
    }
    get universalKey() {
        return this.payload.universalKey
    }
    get key() {
        return this.payload.key
    }
    get standardKey(): StandardKey {
        // Delegate to payload's standardKey getter
        return this.payload.standardKey
    }
    get tag() {
        return this.payload.tag
    }
    get context() {
        // context has been removed from StandardKey; retained for backward compatibility (always undefined)
        return undefined
    }
    get schema() {
        return this.payload.schema
    }
    nestedSchema(tag) {
        return [{ data: tag, children: this.schema }]
    }
    get _delta(): StandardEditableDataDelta<StandardReferenceData> {
        return { add: this.payload.toJSON() }
    }
    clone() {
        return new StandardReferenceSimple(this.payload)
    }
    toJSON: () => StandardEditableData<StandardReferenceData> = () => {
        return this.payload.toJSON()
    }
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardReferencePayload>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardReferencePayload>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    withKey(key: string): StandardReferenceSimple {
        const returnValue = this.clone()
        const payloadJSON = returnValue.payload.toJSON()
        const updatedData: StandardReferenceData = typeof payloadJSON === 'string' 
            ? payloadJSON 
            : { ...payloadJSON, key }
        returnValue.payload = new StandardReferencePayload(updatedData)
        return returnValue
    }
    equals(other: StandardReferenceSimple): boolean {
        return this.payload.key === other.payload.key && this.payload.universalKey === other.payload.universalKey
    }
}

export class StandardReferenceRemove implements StandardEditableWrapper<StandardReferencePayload> {
    match: StandardReferencePayload
    constructor(
        data: StandardReferencePayload | StandardKey | StandardEditableData<StandardReferenceData> | GenericTree<SchemaTag> | string,
        explicitTag?: ComponentTag
    ) {
        // Handle StandardReferencePayload directly
        if (data instanceof StandardReferencePayload) {
            this.match = data
            return
        }
        
        // Handle StandardKey with explicit tag - convert to StandardReferencePayload
        if (data instanceof StandardKey) {
            const derivedTag = explicitTag ?? deriveTagFromReferenceData(data)
            if (!derivedTag) {
                throw new Error(`StandardReferenceRemove requires derivable tag. Data: ${JSON.stringify(data)}`)
            }
            const keyData = data.toJSON() // Returns StandardKeyData
            // Convert StandardKeyData to StandardReferenceData
            const referenceData: StandardReferenceData = typeof keyData === 'string' 
                ? keyData 
                : { ...keyData, tag: derivedTag }
            this.match = new StandardReferencePayload(referenceData)
            return
        }
        
        // Handle StandardReferenceData or GenericTree - use factory
        const delta = factory(data)
        if (delta && !delta.add && delta.remove) {
            this.match = new StandardReferencePayload(delta.remove)
            return
        }
        console.log(`Invalid data: ${JSON.stringify(data)}`)
        throw new Error('Invalid data in StandardReferenceRemove')
    }
    get schema() {
        return [{ data: { tag: 'Remove' as const }, children: this.match.schema }]
    }
    get key() {
        return this.match.key
    }
    get universalKey() {
        return this.match.universalKey
    }
    get context() {
        // context has been removed from StandardKey; retained for backward compatibility (always undefined)
        return undefined
    }
    get tag() {
        return this.match.tag
    }
    nestedSchema(tag) {
        return [{
            data: { tag: 'Remove' as const },
            children: [{ data: tag, children: this.match.schema }]
        }]
    }
    get _delta(): StandardEditableDataDelta<StandardReferenceData> {
        return { remove: this.match.toJSON() }
    }
    clone() {
        return new StandardReferenceRemove(this.match)
    }
    toJSON: () => StandardEditableData<StandardReferenceData> = () => {
        return { tag: 'Remove' as const, match: this.match.toJSON() }
    }
    get plain() { return this.match }
    merge(other: StandardEditableWrapper<StandardReferencePayload>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardReferencePayload>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    withKey(key: string): StandardReferenceRemove {
        const returnValue = this.clone()
        const matchJSON = returnValue.match.toJSON()
        const updatedData: StandardReferenceData = typeof matchJSON === 'string' 
            ? matchJSON 
            : { ...matchJSON, key }
        returnValue.match = new StandardReferencePayload(updatedData)
        return returnValue
    }
}

export class StandardReferenceReplace implements StandardEditableWrapper<StandardReferencePayload> {
    match: StandardReferencePayload
    payload: StandardReferencePayload
    constructor(
        ...args: [StandardReferencePayload, StandardReferencePayload] | [StandardKey, StandardKey, ComponentTag] | [StandardKey, StandardKey] | [StandardEditableData<StandardReferenceData> | GenericTree<SchemaTag> | string, ComponentTag?]
    ) {
        // Handle StandardReferencePayload directly
        if (args.length === 2 && args[0] instanceof StandardReferencePayload && args[1] instanceof StandardReferencePayload) {
            this.match = args[0]
            this.payload = args[1]
            return
        }
        
        // Handle StandardKey with explicit tag
        if (args.length === 3 && args[0] instanceof StandardKey && args[1] instanceof StandardKey && typeof args[2] === 'string') {
            const tag = args[2] as ComponentTag
            const matchKeyData = args[0].toJSON()
            const payloadKeyData = args[1].toJSON()
            const matchData: StandardReferenceData = typeof matchKeyData === 'string' 
                ? matchKeyData 
                : { ...matchKeyData, tag }
            const payloadData: StandardReferenceData = typeof payloadKeyData === 'string' 
                ? payloadKeyData 
                : { ...payloadKeyData, tag }
            this.match = new StandardReferencePayload(matchData)
            this.payload = new StandardReferencePayload(payloadData)
            return
        }
        
        // Handle two StandardKeys - derive tag from payload
        if (args.length === 2 && args[0] instanceof StandardKey && args[1] instanceof StandardKey) {
            const derivedTag = deriveTagFromReferenceData(args[1])
            if (!derivedTag) {
                throw new Error('StandardReferenceReplace requires derivable tag from payload StandardKey')
            }
            const matchKeyData = args[0].toJSON()
            const payloadKeyData = args[1].toJSON()
            const matchData: StandardReferenceData = typeof matchKeyData === 'string' 
                ? matchKeyData 
                : { ...matchKeyData, tag: derivedTag }
            const payloadData: StandardReferenceData = typeof payloadKeyData === 'string' 
                ? payloadKeyData 
                : { ...payloadKeyData, tag: derivedTag }
            this.match = new StandardReferencePayload(matchData)
            this.payload = new StandardReferencePayload(payloadData)
            return
        }
        
        // Handle StandardReferenceData or GenericTree - use factory
        // At this point, StandardKey cases have been handled, so data should be StandardReferenceData | GenericTree | string
        const data = args[0]
        if (data instanceof StandardKey) {
            throw new Error('StandardKey should have been handled in previous cases')
        }
        const delta = factory(data)
        if (delta && delta.add && delta.remove) {
            this.match = new StandardReferencePayload(delta.remove)
            this.payload = new StandardReferencePayload(delta.add)
            return
        }
        throw new Error('Invalid data in StandardReferenceReplace')
    }
    get schema() {
        return [{ data: { tag: 'Replace' as const }, children: [
            { data: { tag: 'ReplaceMatch' as const }, children: this.match.schema },
            { data: { tag: 'ReplacePayload' as const }, children: this.payload.schema }
        ] }]
    }
    get key() {
        return this.payload.key
    }
    get universalKey() {
        return this.payload.universalKey
    }
    get context() {
        // context has been removed from StandardKey; retained for backward compatibility (always undefined)
        return undefined
    }
    get tag() {
        return this.payload.tag
    }
    nestedSchema(tag) {
        return [{
            data: { tag: 'Replace' as const },
            children: [
                {
                    data: { tag: 'ReplaceMatch' as const },
                    children: [{ data: tag, children: this.match.schema }]
                },
                {
                    data: { tag: 'ReplacePayload' as const },
                    children: [{ data: tag, children: this.payload.schema }]
                }
            ]
        }]
    }
    get _delta(): StandardEditableDataDelta<StandardReferenceData> {
        return { remove: this.match.toJSON(), add: this.payload.toJSON() }
    }
    clone() {
        return new StandardReferenceReplace(this.match, this.payload)
    }
    toJSON: () => StandardEditableData<StandardReferenceData> = () => {
        return { 
            tag: 'Replace' as const,
            match: this.match.toJSON(),
            payload: this.payload.toJSON()
        }
    }
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardReferencePayload>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardReferencePayload>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    withKey(key: string): StandardReferenceReplace {
        const returnValue = this.clone()
        const payloadJSON = returnValue.payload.toJSON()
        const matchJSON = returnValue.match.toJSON()
        const updatedPayloadData: StandardReferenceData = typeof payloadJSON === 'string' 
            ? payloadJSON 
            : { ...payloadJSON, key }
        const updatedMatchData: StandardReferenceData = typeof matchJSON === 'string' 
            ? matchJSON 
            : { ...matchJSON, key }
        returnValue.payload = new StandardReferencePayload(updatedPayloadData)
        returnValue.match = new StandardReferencePayload(updatedMatchData)
        return returnValue
    }
}

export class StandardReference {
    _payload: StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace;
    
    constructor(arg: any, explicitTag?: ComponentTag) {
        // Handle wrapper instances directly
        if (arg instanceof StandardReferenceSimple || arg instanceof StandardReferenceRemove || arg instanceof StandardReferenceReplace) {
            this._payload = arg
            return
        }
        
        // Handle (key, tag) pattern: new StandardReference(key, 'Room')
        if (explicitTag !== undefined) {
            // Create StandardReferenceSimple with the key and tag
            this._payload = new StandardReferenceSimple(arg, explicitTag)
            return
        }
        
        // Fall back to factory pattern for single argument
        const delta = factory(arg)
        if (!delta) {
            console.log(`Invalid argument to StandardReference constructor: ${JSON.stringify(arg)}`)
            throw new Error('Invalid argument to StandardReference constructor')
        }
        // Convert payload instances to data for fromDelta
        const dataDelta: StandardEditableDataDelta<StandardReferenceData> = {
            add: delta.add?.toJSON(),
            remove: delta.remove?.toJSON()
        }
        const payload = fromDelta(dataDelta)
        if (!payload) {
            throw new Error('Invalid argument to StandardReference constructor')
        }
        this._payload = payload
    }

    get schema(): GenericTree<SchemaTag> {
        return this._payload.schema
    }
    get key(): string | undefined {
        return this._payload.key
    }
    get universalKey(): ComponentUUID | undefined {
        return this._payload.universalKey
    }
    get tag(): ComponentTag | undefined {
        return this._payload.tag
    }

    clone(): StandardReference {
        return new StandardReference(this._payload.clone())
    }

    nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        return this._payload.nestedSchema(tag)
    }

    toJSON(): StandardEditableData<StandardReferenceData> {
        return this._payload.toJSON()
    }

    merge(incoming: StandardReference): StandardReference | undefined {
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            return new StandardReference(merged)
        }
        return undefined
    }
    diff(incoming: StandardReference | undefined): StandardReference | undefined {
        if (incoming) {
            const diff = this._payload.diff(incoming._payload)
            if (diff) {
                return new StandardReference(diff)
            }
            return undefined
        }
        else {
            const reversedDelta = this._payload._delta
            if (reversedDelta) {
                if (reversedDelta.add) {
                    return new StandardReference(new StandardReferenceRemove(new StandardKey(reversedDelta.add)))
                }
                if (reversedDelta.remove) {
                    return new StandardReference(new StandardReferenceSimple(reversedDelta.remove))
                }
            }
            return undefined
        }
    }
    mapContents(callback: (incoming: StandardReferenceData) => StandardReferenceData): StandardReference {
        if (this._payload instanceof StandardReferenceSimple) {
            const payloadReferenceData = this._payload.payload.toJSON()
            return new StandardReference(callback(payloadReferenceData))
        }
        if (this._payload instanceof StandardReferenceRemove) {
            const matchReferenceData = this._payload.match.toJSON()
            return new StandardReference(new StandardReferenceRemove(new StandardReferencePayload(callback(matchReferenceData))))
        }
        if (this._payload instanceof StandardReferenceReplace) {
            const matchReferenceData = this._payload.match.toJSON()
            const payloadReferenceData = this._payload.payload.toJSON()
            return new StandardReference(new StandardReferenceReplace(
                new StandardReferencePayload(callback(matchReferenceData)), 
                new StandardReferencePayload(callback(payloadReferenceData))
            ))
        }
        throw new Error('Invalid StandardReference payload')
    }

    withKey(key: string): StandardReference {
        const returnValue = this.clone()
        returnValue._payload = this._payload.withKey(key)
        return returnValue
    }

    plain(): StandardReferenceSimple {
        // Return StandardReferenceSimple representing the plain reference (without edit operations)
        // This is consistent with other StandardEditableWrapper patterns where plain returns the payload
        const payloadData = this._payload.plain
        return new StandardReferenceSimple(payloadData)
    }

    _delta(): StandardEditableDataDelta<StandardReferenceData> | undefined {
        return this._payload._delta
    }

    equal(other: StandardReference): boolean {
        if (this._payload instanceof StandardReferenceSimple && other._payload instanceof StandardReferenceSimple) {
            return this._payload.standardKey.equals(other._payload.standardKey)
        }
        if (this._payload instanceof StandardReferenceRemove && other._payload instanceof StandardReferenceRemove) {
            return this._payload.match.standardKey.equals(other._payload.match.standardKey)
        }
        if (this._payload instanceof StandardReferenceReplace && other._payload instanceof StandardReferenceReplace) {
            return this._payload.match.standardKey.equals(other._payload.match.standardKey) &&
                   this._payload.payload.standardKey.equals(other._payload.payload.standardKey)
        }
        return false
    }

    sameKey(other: any): boolean {
        // Compare what each reference points to (plain value) for list matching
        if (!(other instanceof StandardReference)) {
            return false
        }
        const baseMatchPayload = this._payload instanceof StandardReferenceSimple
            ? this._payload
            : this._payload.match
        return baseMatchPayload.standardKey.equals(other.plain().standardKey)
    }

    invert(): StandardReference {
        if (this._payload instanceof StandardReferenceSimple) {
            return new StandardReference(new StandardReferenceRemove(this._payload.payload))
        }
        if (this._payload instanceof StandardReferenceRemove) {
            return new StandardReference(new StandardReferenceSimple(this._payload.match))
        }
        if (this._payload instanceof StandardReferenceReplace) {
            return new StandardReference(new StandardReferenceReplace(this._payload.payload, this._payload.match))
        }
        throw new Error('Invalid StandardReference payload for invert')
    }

    lookup(arg: StandardKey[] | ((key: StandardKey) => StandardKey | undefined)): StandardReference {
        const callback = typeof arg === 'function' ? arg : (key: StandardKey) => {
            return arg.find((item) => item.equals(key))
        }
        if (this._payload instanceof StandardReferenceSimple) {
            const currentKey = this._payload.standardKey
            const lookedUpKey = callback(currentKey)
            // Only clone if no lookup found a match (lookedUpKey is undefined or same object reference)
            if (!lookedUpKey || lookedUpKey === currentKey) {
                return this.clone()
            }
            // Extract properties directly from looked-up key to preserve both key and universalKey
            const tag = this._payload.tag
            const referenceData: StandardReferenceData = lookedUpKey.universalKey && !lookedUpKey.key
                ? lookedUpKey.universalKey  // Use ComponentUUID string form when only universalKey exists
                : { key: lookedUpKey.key || '', universalKey: lookedUpKey.universalKey, tag }
            return new StandardReference(new StandardReferenceSimple(new StandardReferencePayload(referenceData)))
        }
        if (this._payload instanceof StandardReferenceRemove) {
            const currentKey = this._payload.plain.standardKey
            const lookedUpKey = callback(currentKey)
            // Only clone if no lookup found a match
            if (!lookedUpKey || lookedUpKey === currentKey) {
                return this.clone()
            }
            const tag = this._payload.tag
            const referenceData: StandardReferenceData = lookedUpKey.universalKey && !lookedUpKey.key
                ? lookedUpKey.universalKey
                : { key: lookedUpKey.key || '', universalKey: lookedUpKey.universalKey, tag }
            return new StandardReference(new StandardReferenceRemove(new StandardReferencePayload(referenceData)))
        }
        if (this._payload instanceof StandardReferenceReplace) {
            const matchKey = this._payload.match.standardKey
            const payloadKey = this._payload.payload.standardKey
            const lookedUpMatchKey = callback(matchKey)
            const lookedUpPayloadKey = callback(payloadKey)
            // Only clone if no lookup found matches for either
            if ((!lookedUpMatchKey || lookedUpMatchKey === matchKey) && 
                (!lookedUpPayloadKey || lookedUpPayloadKey === payloadKey)) {
                return this.clone()
            }
            const tag = this._payload.tag
            const matchKeyToUse = lookedUpMatchKey ?? matchKey
            const payloadKeyToUse = lookedUpPayloadKey ?? payloadKey
            const matchData: StandardReferenceData = matchKeyToUse.universalKey && !matchKeyToUse.key
                ? matchKeyToUse.universalKey
                : { key: matchKeyToUse.key || '', universalKey: matchKeyToUse.universalKey, tag }
            const payloadData: StandardReferenceData = payloadKeyToUse.universalKey && !payloadKeyToUse.key
                ? payloadKeyToUse.universalKey
                : { key: payloadKeyToUse.key || '', universalKey: payloadKeyToUse.universalKey, tag }
            return new StandardReference(new StandardReferenceReplace(
                new StandardReferencePayload(matchData),
                new StandardReferencePayload(payloadData)
            ))
        }
        throw new Error('Invalid StandardReference payload for lookup')
    }

    toFormat(format: ReferenceFormat): StandardReference {
        // Convert payload to StandardKey, format it, then convert back
        if (this._payload instanceof StandardReferenceSimple) {
            const key = this._payload.plain.standardKey
            const formattedKey = key.toFormat(format)
            const tag = this._payload.tag
            const keyData = formattedKey.toJSON()
            const referenceData: StandardReferenceData = typeof keyData === 'string' 
                ? keyData 
                : { ...keyData, tag }
            return new StandardReference(new StandardReferenceSimple(new StandardReferencePayload(referenceData)))
        }
        if (this._payload instanceof StandardReferenceRemove) {
            const key = this._payload.plain.standardKey
            const formattedKey = key.toFormat(format)
            const tag = this._payload.tag
            const keyData = formattedKey.toJSON()
            const referenceData: StandardReferenceData = typeof keyData === 'string' 
                ? keyData 
                : { ...keyData, tag }
            return new StandardReference(new StandardReferenceRemove(new StandardReferencePayload(referenceData)))
        }
        if (this._payload instanceof StandardReferenceReplace) {
            const matchKey = this._payload.match.standardKey
            const payloadKey = this._payload.payload.standardKey
            const formattedMatchKey = matchKey.toFormat(format)
            const formattedPayloadKey = payloadKey.toFormat(format)
            const tag = this._payload.tag
            const matchKeyData = formattedMatchKey.toJSON()
            const payloadKeyData = formattedPayloadKey.toJSON()
            const matchData: StandardReferenceData = typeof matchKeyData === 'string' 
                ? matchKeyData 
                : { ...matchKeyData, tag }
            const payloadData: StandardReferenceData = typeof payloadKeyData === 'string' 
                ? payloadKeyData 
                : { ...payloadKeyData, tag }
            return new StandardReference(new StandardReferenceReplace(
                new StandardReferencePayload(matchData),
                new StandardReferencePayload(payloadData)
            ))
        }
        throw new Error('Invalid StandardReference payload for format')
    }
}

export class ReferenceList extends editableListClassFactory<StandardEditablePayload<StandardReferenceData>, any>(StandardReference as any, 'ReferenceList') {

    constructor(args: any) {
        super(args)
        //
        // Guarantee that the reference stored is to the minimum key information needed to correctly
        // identify the component, without context.
        //
        this._items = this._items.map<StandardReference>((item) => {
            if (item instanceof StandardReference) {
                return item.mapContents((data) => {
                    if (isStandardReferencePayloadData(data)) {
                        if (typeof data === 'string') {
                            return data
                        }
                        return {
                            ...data
                        }
                    }
                    return data
                })
            }
            return item as unknown as StandardReference
        }) as any
    }

    override merge(other: ReferenceList): ReferenceList | undefined {
        const merged = super.merge(other)
        if (merged) {
            return new ReferenceList(merged)
        }
        return undefined
    }

    override diff(other: ReferenceList): ReferenceList | undefined {
        const diffed = super.diff(other)
        if (diffed) {
            return new ReferenceList(diffed)
        }
        return undefined
    }

    override clone(): ReferenceList {
        return new ReferenceList(super.clone())
    }

    get payload(): StandardReference[] {
        return this._items as unknown as StandardReference[];
    }

    override assureItem(item): ReferenceList {
        const assured = super.assureItem(item as any)
        return new ReferenceList(assured)
    }

    override map(callback: (item: EditableListItem<StandardEditablePayload<StandardReferenceData>>) => EditableListItem<StandardEditablePayload<StandardReferenceData>>): ReferenceList {
        const mapped = super.map(callback)
        return new ReferenceList(mapped)
    }

    toFormat(format: ReferenceFormat): ReferenceList {
        return new ReferenceList(this.payload.map((item) => item.toFormat(format)))
    }

    lookup(arg: StandardKey[] | ((key: StandardKey) => StandardKey | undefined)): ReferenceList {
        return new ReferenceList(this.payload.map((item) => item.lookup(arg)))
    }

    invert(): ReferenceList {
        return new ReferenceList(this.payload.map((item) => item.invert()))
    }

}


export default StandardReference