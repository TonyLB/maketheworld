import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { ComponentUUID, isSchemaComponent, isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaRemove, isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit";
import { ComponentTag, componentTagFromUpperCase } from "./dataTypes/abstract";
import { isStandardKeyData, isStandardReferencePayloadData, StandardKeyData, StandardReferenceData } from "./dataTypes/reference";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { StandardEditablePayload } from "../../generics/editable";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { ReferenceFormat } from "./utils/references";
import { excludeUndefined } from "../../lib/lists";
import { isSchemaTreeNode } from "../../schema";
import { treeFromWML } from "../../schema";

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
    _ref: number // Reference number (can be negative), defaults to 1
    
    constructor(data: StandardReferenceData | GenericTree<SchemaTag> | StandardReferencePayload) {
        // Handle cloning
        if (data instanceof StandardReferencePayload) {
            this.key = data.key
            this.universalKey = data.universalKey
            this._tag = data._tag
            this._ref = data._ref
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
            this._ref = 1 // Default to 1 for ComponentUUID string form
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
            this._ref = data.ref ?? 1 // Extract ref from data, default to 1
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
            // Extract ref from schema node data (if present), default to 1
            this._ref = 'ref' in node.data && typeof node.data.ref === 'number' ? node.data.ref : 1
            return
        }
        
        throw new Error('Invalid argument in StandardReferencePayload constructor')
    }
    
    get tag(): ComponentTag {
        return this._tag
    }
    
    get ref(): number {
        return this._ref
    }
    
    get standardKey(): StandardKey {
        return new StandardKey(this.key ? { key: this.key, universalKey: this.universalKey } : this.universalKey as ComponentUUID)
    }
    
    get schema() {
        const schemaData: SchemaTag = {
            tag: this._tag,
            key: this.key,
            uuid: this.universalKey
        } as SchemaTag
        // Include ref property when it's not 1 and >= 0
        if (this._ref !== 1 && this._ref >= 0) {
            (schemaData as { ref: number }).ref = this._ref
        }
        return [{
            data: schemaData,
            children: []
        }]
    }
    
    clone() {
        return new StandardReferencePayload(this)
    }
    
    toJSON: () => StandardReferenceData = () => {
        if (!this.key && this.universalKey) {
            // If only universalKey, return ComponentUUID string form (ref not included in string form)
            return this.universalKey
        }
        if (this.key) {
            // Object form - tag is required, include ref if not default (1)
            const result: StandardReferenceData = { key: this.key, universalKey: this.universalKey, tag: this._tag }
            if (this._ref !== 1) {
                (result as { ref: number }).ref = this._ref
            }
            return result
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
    const { universalKey, key, ref } = incoming
    if (key) {
        // Return object form, but omit ref if it's 1 (default)
        const result: StandardReferenceData = { key, universalKey, tag: incoming.tag }
        if (ref !== undefined && ref !== 1) {
            (result as { ref: number }).ref = ref
        }
        return result
    }
    if (!universalKey) {
        throw new Error('StandardReferenceData must have a universalKey or key')
    }
    return universalKey
}

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

// Helper to parse Remove tag and create StandardReferenceSimple with negated ref value
const parseRemoveTag = (removeNode: GenericTree<SchemaTag>): StandardReferenceSimple => {
    // removeNode is an array, first element is the Remove tag with children
    const removeElement = removeNode[0]
    if (!removeElement || !treeNodeTypeguard(isSchemaRemove)(removeElement)) {
        throw new Error('parseRemoveTag expects a Remove tag node')
    }
    const matchPayload = new StandardReferencePayload(removeElement.children)
    const matchRef = matchPayload.ref // Gets ref value (defaults to 1 if not present)
    const matchData = matchPayload.toJSON()
    const deserialized = typeof matchData === 'string'
        ? standardReferenceDeserialize(matchData)
        : matchData
    const removeData: StandardReferenceData = { ...deserialized, ref: -matchRef }
    return new StandardReferenceSimple(new StandardReferencePayload(removeData))
}

export class StandardReferenceSimple {
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
                : { ...(data as { key?: string; universalKey?: ComponentUUID }), tag: explicitTag }
            this.payload = new StandardReferencePayload(referenceData)
            return
        }
        
        // Handle StandardReferenceData directly
        if (isStandardReferencePayloadData(data)) {
            this.payload = new StandardReferencePayload(data)
            return
        }
        
        // Handle string (WML) - parse and check for Remove/Replace tags
        if (typeof data === 'string') {
            const schema = treeFromWML(data)
            if (schema.length === 0) {
                throw new Error('Invalid WML string in StandardReferenceSimple: empty schema')
            }
            const firstElement = schema[0]
            
            // Check for Remove tag - should be handled by StandardReference constructor
            if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
                throw new Error('Remove operations should be parsed through StandardReference constructor, not StandardReferenceSimple')
            }
            
            // Check for Replace tag - illegal for references
            if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                throw new Error('Replace operations are illegal for references. References can only be added or removed, not replaced.')
            }
            
            // Parse as plain reference
            this.payload = new StandardReferencePayload(schema)
            return
        }
        
        // Handle GenericTree<SchemaTag>
        if (Array.isArray(data) && data.length > 0) {
            const firstElement = data[0]
            
            // Check for Remove tag - should be handled by StandardReference constructor
            if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
                throw new Error('Remove operations should be parsed through StandardReference constructor, not StandardReferenceSimple')
            }
            
            // Check for Replace tag - illegal for references
            if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                throw new Error('Replace operations are illegal for references. References can only be added or removed, not replaced.')
            }
            
            // Parse as plain reference
            this.payload = new StandardReferencePayload(data)
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
    get ref() {
        return this.payload.ref
    }
    get context() {
        // context has been removed from StandardKey; retained for backward compatibility (always undefined)
        return undefined
    }
    get schema() {
        // If ref is negative, wrap in Remove tag with absolute value
        if (this.payload.ref < 0) {
            // Create a temporary payload with the absolute value of ref
            const payloadJSON = this.payload.toJSON()
            // Convert to object form if it's a string (ComponentUUID)
            const deserialized = typeof payloadJSON === 'string'
                ? standardReferenceDeserialize(payloadJSON)
                : payloadJSON
            const absRefData: StandardReferenceData = { ...deserialized, ref: Math.abs(this.payload.ref) }
            const tempPayload = new StandardReferencePayload(absRefData)
            // Wrap the schema in a Remove tag
            return [{ data: { tag: 'Remove' as const }, children: tempPayload.schema }]
        }
        // For non-negative ref, delegate to payload schema
        return this.payload.schema
    }
    nestedSchema(tag) {
        return [{ data: tag, children: this.schema }]
    }
    clone() {
        return new StandardReferenceSimple(this.payload)
    }
    toJSON: () => StandardEditableData<StandardReferenceData> = () => {
        return this.payload.toJSON()
    }
    get plain() { return this.payload }
    merge(other: StandardReferenceSimple, options?: { cleanEmptyReferences?: boolean }): StandardReferenceSimple | undefined {
        const { cleanEmptyReferences = true } = options ?? {}
        
        if (!(other instanceof StandardReferenceSimple)) {
            throw new Error('merge() can only be called with StandardReferenceSimple instances')
        }
        
        // Get ref values from both references
        const baseRef = this.payload.ref
        const otherRef = other.ref
        
        // Calculate merged ref value
        const mergedRef = baseRef + otherRef
        
        // Handle zero result
        if (mergedRef === 0) {
            if (!cleanEmptyReferences) {
                return this.withRef(0)
            }
            // Default: cancellation, return undefined
            return undefined
        }
        
        // Non-zero result: create new reference with merged ref value
        const baseData = this.payload.toJSON()
        const deserialized = typeof baseData === 'string'
            ? standardReferenceDeserialize(baseData)
            : baseData
        const mergedData: StandardReferenceData = { ...deserialized, ref: mergedRef }
        
        return new StandardReferenceSimple(new StandardReferencePayload(mergedData))
    }
    diff(other: StandardReferenceSimple): StandardReferenceSimple | undefined {
        if (!(other instanceof StandardReferenceSimple)) {
            throw new Error('diff() can only be called with StandardReferenceSimple instances')
        }
        
        // Get ref values: base (this) and incoming (other)
        const baseRef = this.payload.ref
        const incomingRef = other.ref
        
        // Calculate diff: incoming - base
        const diffRef = incomingRef - baseRef
        
        // Handle zero result: no change, return undefined
        if (diffRef === 0) {
            return undefined
        }
        
        // Non-zero result: create new reference with diff ref value
        const baseData = this.payload.toJSON()
        const deserialized = typeof baseData === 'string'
            ? standardReferenceDeserialize(baseData)
            : baseData
        const diffData: StandardReferenceData = { ...deserialized, ref: diffRef }
        
        // Always return StandardReferenceSimple (even with negative ref)
        return new StandardReferenceSimple(new StandardReferencePayload(diffData))
    }
    withKey(key: string): StandardReferenceSimple {
        const returnValue = this.clone()
        const payloadJSON = returnValue.payload.toJSON()
        const updatedData: StandardReferenceData = typeof payloadJSON === 'string' 
            ? payloadJSON 
            : { ...payloadJSON, key, ref: returnValue.payload.ref }
        returnValue.payload = new StandardReferencePayload(updatedData)
        return returnValue
    }
    withRef(ref: number): StandardReferenceSimple {
        const returnValue = this.clone()
        const payloadJSON = returnValue.payload.toJSON()
        const updatedData: StandardReferenceData = typeof payloadJSON === 'string'
            ? standardReferenceDeserialize(payloadJSON)
            : payloadJSON
        const refData: StandardReferenceData = { ...updatedData, ref }
        returnValue.payload = new StandardReferencePayload(refData)
        return returnValue
    }
    equals(other: StandardReferenceSimple): boolean {
        return this.payload.key === other.payload.key && 
               this.payload.universalKey === other.payload.universalKey &&
               this.payload.ref === other.payload.ref
    }
}


export class StandardReference {
    _payload: StandardReferenceSimple;
    
    constructor(arg: any, explicitTag?: ComponentTag) {
        // Handle wrapper instances directly
        if (arg instanceof StandardReferenceSimple) {
            this._payload = arg
            return
        }
        
        // Handle (key, tag) pattern: new StandardReference(key, 'Room')
        if (explicitTag !== undefined) {
            // Create StandardReferenceSimple with the key and tag
            this._payload = new StandardReferenceSimple(arg, explicitTag)
            return
        }
        
        // Check for Remove JSON structure BEFORE isStandardReferencePayloadData check
        if (typeof arg === 'object' && arg !== null && 'tag' in arg && arg.tag === 'Remove' && 'match' in arg) {
            // Extract match data, get its ref value (defaulting to 1), negate it, and create StandardReferenceSimple
            const removeData = arg as { tag: 'Remove'; match: StandardReferenceData }
            const matchPayload = new StandardReferencePayload(removeData.match)
            const matchRef = matchPayload.ref // Gets ref value (defaults to 1 if not present)
            const matchData = matchPayload.toJSON()
            const deserialized = typeof matchData === 'string'
                ? standardReferenceDeserialize(matchData)
                : matchData
            const removeRefData: StandardReferenceData = { ...deserialized, ref: -matchRef }
            this._payload = new StandardReferenceSimple(new StandardReferencePayload(removeRefData))
            return
        }
        
        // Check for Replace JSON structure - illegal for references
        if (typeof arg === 'object' && arg !== null && 'tag' in arg && arg.tag === 'Replace' && 'match' in arg && 'payload' in arg) {
            throw new Error('Replace operations are illegal for references. References can only be added or removed, not replaced.')
        }
        
        // Handle StandardReferenceData directly
        if (isStandardReferencePayloadData(arg)) {
            this._payload = new StandardReferenceSimple(new StandardReferencePayload(arg))
            return
        }
        
        // Handle string (WML) - parse and check for Remove/Replace tags
        if (typeof arg === 'string') {
            const schema = treeFromWML(arg)
            if (schema.length === 0) {
                throw new Error('Invalid WML string in StandardReference constructor: empty schema')
            }
            const firstElement = schema[0]
            
            // Check for Remove tag
            if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
                this._payload = parseRemoveTag(schema)
                return
            }
            
            // Check for Replace tag - illegal for references
            if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                throw new Error('Replace operations are illegal for references. References can only be added or removed, not replaced.')
            }
            
            // Parse as plain reference
            this._payload = new StandardReferenceSimple(schema)
            return
        }
        
        // Handle GenericTree<SchemaTag>
        if (Array.isArray(arg) && arg.length > 0) {
            const firstElement = arg[0]
            
            // Check for Remove tag
            if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
                this._payload = parseRemoveTag(arg)
                return
            }
            
            // Check for Replace tag - illegal for references
            if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                throw new Error('Replace operations are illegal for references. References can only be added or removed, not replaced.')
            }
            
            // Parse as plain reference
            this._payload = new StandardReferenceSimple(arg)
            return
        }
        
        throw new Error(`Invalid argument to StandardReference constructor: ${JSON.stringify(arg)}`)
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
    get ref(): number {
        return this._payload.ref
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

    merge(incoming: StandardReference, options?: { cleanEmptyReferences?: boolean }): StandardReference | undefined {
        if (!this.sameKey(incoming)) {
            throw new Error('Cannot change which component a reference points to')
        }
        const merged = this._payload.merge(incoming._payload, options)
        if (merged) {
            return new StandardReference(merged)
        }
        return undefined
    }
    diff(incoming: StandardReference | undefined): StandardReference | undefined {
        if (incoming) {
            if (!this.sameKey(incoming)) {
                throw new Error('Cannot change which component a reference points to')
            }
            const diff = this._payload.diff(incoming._payload)
            if (diff) {
                return new StandardReference(diff)
            }
            return undefined
        }
        else {
            // Diff from this reference to nothing: invert the ref value
            const baseRef = this._payload.ref
            const invertedRef = -baseRef
            
            // If ref is 0, inverting gives 0 (no change)
            if (invertedRef === 0) {
                return undefined
            }
            
            // Create inverted reference
            const baseData = this._payload.payload.toJSON()
            const deserialized = typeof baseData === 'string'
                ? standardReferenceDeserialize(baseData)
                : baseData
            const invertedData: StandardReferenceData = { ...deserialized, ref: invertedRef }
            
            return new StandardReference(new StandardReferenceSimple(new StandardReferencePayload(invertedData)))
        }
    }
    mapContents(callback: (incoming: StandardReferenceData) => StandardReferenceData): StandardReference {
        const payloadReferenceData = this._payload.payload.toJSON()
        const currentRef = this._payload.ref
        const updatedData = callback(payloadReferenceData)
        
        // Preserve ref value when data is in string form (ComponentUUID only, no key)
        // String form doesn't include ref, so we need to convert to object form with ref preserved
        if (typeof updatedData === 'string' && currentRef !== 1) {
            const deserialized = standardReferenceDeserialize(updatedData)
            const refData: StandardReferenceData = { ...deserialized, ref: currentRef }
            return new StandardReference(refData)
        }
        
        // For object form, ensure ref is preserved if it was non-default
        if (typeof updatedData === 'object' && updatedData !== null && !('ref' in updatedData) && currentRef !== 1) {
            const refData: StandardReferenceData = { ...updatedData, ref: currentRef }
            return new StandardReference(refData)
        }
        
        return new StandardReference(updatedData)
    }

    withKey(key: string): StandardReference {
        const returnValue = this.clone()
        returnValue._payload = this._payload.withKey(key)
        return returnValue
    }

    withRef(ref: number): StandardReference {
        const returnValue = this.clone()
        returnValue._payload = this._payload.withRef(ref)
        return returnValue
    }

    plain(): StandardReferenceSimple {
        // Return StandardReferenceSimple representing the plain reference (without edit operations)
        const payloadData = this._payload.plain
        return new StandardReferenceSimple(payloadData)
    }

    equal(other: StandardReference): boolean {
        return this._payload.standardKey.equals(other._payload.standardKey)
    }

    sameKey(other: any): boolean {
        // Compare what each reference points to (plain value) for list matching
        // Prioritizes universalKey: if both have the same universalKey, they're the same component
        // regardless of local key differences
        if (!(other instanceof StandardReference)) {
            return false
        }
        const baseMatchPayload = this._payload
        const otherMatchPayload = other._payload
        
        const baseStandardKey = baseMatchPayload.standardKey
        const otherStandardKey = otherMatchPayload.standardKey
        
        // If both have universalKey and they match, they're the same component
        if (baseStandardKey.universalKey && otherStandardKey.universalKey) {
            return baseStandardKey.universalKey === otherStandardKey.universalKey
        }
        
        // Otherwise, fall back to standardKey.equals() which compares keys
        return baseStandardKey.equals(otherStandardKey)
    }

    invert(): StandardReference {
        return this.withRef(-this._payload.ref)
    }

    lookup(arg: StandardKey[] | ((key: StandardKey) => StandardKey | undefined)): StandardReference {
        const callback = typeof arg === 'function' ? arg : (key: StandardKey) => {
            return arg.find((item) => item.equals(key))
        }
        const currentKey = this._payload.standardKey
        const lookedUpKey = callback(currentKey)
        // Only clone if no lookup found a match (lookedUpKey is undefined or same object reference)
        if (!lookedUpKey || lookedUpKey === currentKey) {
            return this.clone()
        }
        // Extract properties directly from looked-up key to preserve both key and universalKey
        const tag = this._payload.tag
        const ref = this._payload.ref
        const referenceData: StandardReferenceData = lookedUpKey.universalKey && !lookedUpKey.key
            ? lookedUpKey.universalKey  // Use ComponentUUID string form when only universalKey exists
            : { key: lookedUpKey.key || '', universalKey: lookedUpKey.universalKey, tag, ref }
        return new StandardReference(new StandardReferenceSimple(new StandardReferencePayload(referenceData)))
    }

    toFormat(format: ReferenceFormat): StandardReference {
        // Convert payload to StandardKey, format it, then convert back
        const key = this._payload.plain.standardKey
        const formattedKey = key.toFormat(format)
        const tag = this._payload.tag
        const ref = this._payload.ref
        const keyData = formattedKey.toJSON()
        const referenceData: StandardReferenceData = typeof keyData === 'string' 
            ? keyData 
            : { ...keyData, tag, ref }
        return new StandardReference(new StandardReferenceSimple(new StandardReferencePayload(referenceData)))
    }
}

export class ReferenceList {
    _items: StandardReference[] = []

    constructor(args: any) {
        // Handle cloning from another ReferenceList
        if (args instanceof ReferenceList) {
            this._items = args._items.map((item) => item.clone())
            return
        }
        
        // Handle array input
        if (Array.isArray(args)) {
            let items: StandardReference[]
            
            // Check if array contains StandardReference instances
            if (args.every((item) => item instanceof StandardReference)) {
                items = args as StandardReference[]
            }
            // Check if array contains schema tree nodes
            else if (args.every(isSchemaTreeNode)) {
                items = args.map((item) => new StandardReference([item]))
            }
            // Otherwise, treat as StandardReferenceData (JSON)
            else {
                items = args.map((item) => new StandardReference(item))
            }
            
            // Deduplication: Merge items with the same key
            const swapSpace = items.reduce<StandardReference[]>((previous, item) => {
                const unmatchedPrevious = previous.filter((prev) => !item.sameKey(prev))
                const previousMatch = previous.find((prev) => item.sameKey(prev))
                if (previousMatch) {
                    const merged = previousMatch.merge(item)
                    if (merged) {
                        return [...unmatchedPrevious, merged].filter(excludeUndefined)
                    }
                    return unmatchedPrevious
                }
                return [...previous, item]
            }, [])
            
            this._items = swapSpace
            
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
                return item
            })
            return
        }
        
        throw new Error('Invalid argument type for ReferenceList constructor')
    }

    toJSON(): StandardEditableData<StandardReferenceData>[] {
        return this._items.map((item) => item.toJSON())
    }

    get schema(): GenericTree<SchemaTag> {
        return this._items.map(item => item.schema).flat(1).filter(isSchemaTreeNode)
    }

    clone(): ReferenceList {
        return new ReferenceList(this)
    }

    get payload(): StandardReference[] {
        return this._items
    }

    merge(other: ReferenceList, options?: { cleanEmptyReferences?: boolean }): ReferenceList | undefined {
        if (!(other instanceof ReferenceList)) {
            throw new Error('Cannot merge with non-ReferenceList instance')
        }
        
        const unmatchedBaseItems = this._items.filter(item => !other._items.some(otherItem => item.sameKey(otherItem)))
        const matchedOtherItems: { base: StandardReference, incoming: StandardReference }[] = other._items.map((incoming) => {
                const base = this._items.find(item => item.sameKey(incoming))
                if (base) {
                    return { incoming, base }
                }
                return { incoming, base: undefined }
            })
            .filter((value): value is { base: StandardReference, incoming: StandardReference } => typeof value.base !== 'undefined')
        const unmatchedOtherItems = other._items.filter(item => !this._items.some(baseItem => baseItem.sameKey(item)))
        
        const mergedItems = [
            ...unmatchedBaseItems,
            ...matchedOtherItems.map(({ base, incoming }) => base.merge(incoming, options)),
            ...unmatchedOtherItems
        ].filter(excludeUndefined)
        
        return new ReferenceList(mergedItems)
    }

    diff(other: ReferenceList): ReferenceList | undefined {
        if (!(other instanceof ReferenceList)) {
            throw new Error('Cannot diff with non-ReferenceList instance')
        }
        
        const unmatchedBaseItems = this._items.filter(item => !other._items.some(otherItem => item.sameKey(otherItem)))
        const matchedOtherItems: { base: StandardReference, incoming: StandardReference }[] = other._items.map((incoming) => {
                const base = this._items.find(item => item.sameKey(incoming))
                if (base) {
                    return { incoming, base }
                }
                return { incoming, base: undefined }
            })
            .filter((value): value is { base: StandardReference, incoming: StandardReference } => typeof value.base !== 'undefined')
        const unmatchedOtherItems = other._items.filter(item => !this._items.some(baseItem => baseItem.sameKey(item)))
        
        const diffedItems = [
            ...unmatchedBaseItems.map(item => item.invert()),
            ...matchedOtherItems.map(({ base, incoming }) => base.diff(incoming)),
            ...unmatchedOtherItems
        ].filter(excludeUndefined)
        
        return new ReferenceList(diffedItems)
    }

    assureItem(item: StandardReference): ReferenceList {
        if (!this._items.some(existingItem => existingItem.sameKey(item))) {
            const returnValue = this.clone()
            returnValue._items = [...returnValue._items, item]
            return returnValue
        }
        return this
    }

    map(callback: (item: StandardReference) => StandardReference): ReferenceList {
        const returnValue = this.clone()
        returnValue._items = this._items.map(callback)
        return returnValue
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