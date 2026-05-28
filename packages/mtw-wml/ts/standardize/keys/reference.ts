import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { ComponentUUID, isSchemaComponent, isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaRemove, isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit";
import { ComponentTag, componentTagFromUpperCase } from "../components/dataTypes/abstract";
import { isStandardKeyData, isStandardReferenceData, StandardReferenceData } from "./dataTypes/reference";
import { ReferenceFormat } from "../components/utils/references";
import { treeFromWML } from "../../schema";
import { StandardKey, keySortOrder } from "./key";

export type LookupMappings = StandardReference[] | StandardKey[] | ((key: StandardKey) => StandardKey | undefined);

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

// Helper to parse Remove tag and create StandardReference with negated ref value
const parseRemoveTag = (removeNode: GenericTree<SchemaTag>): StandardReference => {
    // removeNode is an array, first element is the Remove tag with children
    const removeElement = removeNode[0]
    if (!removeElement || !treeNodeTypeguard(isSchemaRemove)(removeElement)) {
        throw new Error('parseRemoveTag expects a Remove tag node')
    }
    // Parse the match data to extract ref value
    const tempRef = new StandardReference(removeElement.children)
    const matchRef = tempRef.ref // Gets ref value (defaults to 1 if not present)
    const matchData = tempRef.toJSON()
    const deserialized = typeof matchData === 'string'
        ? standardReferenceDeserialize(matchData)
        : matchData
    const removeData: StandardReferenceData = { ...deserialized, ref: -matchRef }
    return new StandardReference(removeData)
}

export class StandardReference {
    key?: string
    universalKey?: ComponentUUID
    _tag: ComponentTag // Required - stored for StandardReferenceData
    _ref: number // Reference number (can be negative), defaults to 1
    
    constructor(arg: any, explicitTag?: ComponentTag) {
        // Handle StandardReference instance directly (for cloning)
        if (arg instanceof StandardReference) {
            this.key = arg.key
            this.universalKey = arg.universalKey
            this._tag = arg._tag
            this._ref = arg._ref
            return
        }
        
        // Handle (key, tag) pattern: new StandardReference(key, 'Room')
        if (explicitTag !== undefined) {
            // Handle StandardKey
            if (arg instanceof StandardKey) {
                this.key = arg.key
                this.universalKey = arg.universalKey
                this._tag = explicitTag
                this._ref = 1
                return
            }
            
            // Handle string ComponentUUID with explicitTag (check BEFORE isStandardKeyData, since isStandardKeyData matches strings)
            if (typeof arg === 'string' && isSchemaComponentUUID(arg)) {
                this.universalKey = arg
                this._tag = explicitTag
                this._ref = 1
                return
            }
            
            // Handle StandardKeyData (plain object) - check AFTER string ComponentUUID, since isStandardKeyData matches strings
            if (isStandardKeyData(arg)) {
                const keyData = arg as { key?: string; universalKey?: ComponentUUID }
                this.key = keyData.key
                this.universalKey = keyData.universalKey
                this._tag = explicitTag
                this._ref = 1
                return
            }
        }
        
        // Check for Replace JSON structure - illegal for references
        if (typeof arg === 'object' && arg !== null && 'tag' in arg && arg.tag === 'Replace' && 'match' in arg && 'payload' in arg) {
            throw new Error('Replace operations are illegal for references. References can only be added or removed, not replaced.')
        }
        
        // Handle ComponentUUID string
        if (typeof arg === 'string') {
            // Check if it's WML string (needs parsing)
            if (arg.includes('<') || arg.includes('[')) {
                const schema = treeFromWML(arg)
                if (schema.length === 0) {
                    throw new Error('Invalid WML string in StandardReference constructor: empty schema')
                }
                const firstElement = schema[0]
                
                // Check for Remove tag
                if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
                    const parsed = parseRemoveTag(schema)
                    this.key = parsed.key
                    this.universalKey = parsed.universalKey
                    this._tag = parsed._tag
                    this._ref = parsed._ref
                    return
                }
                
                // Check for Replace tag - illegal for references
                if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                    throw new Error('Replace operations are illegal for references. References can only be added or removed, not replaced.')
                }
                
                // Parse as plain reference from schema
                const node = schema[0]
                if (!treeNodeTypeguard(isSchemaComponent)(node)) {
                    throw new Error('Invalid GenericTree<SchemaTag> in StandardReference constructor')
                }
                const { key, uuid, tag } = node.data
                this.key = key
                this.universalKey = uuid
                if (!tag) {
                    throw new Error('Schema node requires tag for StandardReference')
                }
                this._tag = tag
                this._ref = 'ref' in node.data && typeof node.data.ref === 'number' ? node.data.ref : 1
                return
            }
            
            // Handle ComponentUUID string
            if (!isSchemaComponentUUID(arg)) {
                throw new Error('Invalid StandardReferenceData passed to StandardReference')
            }
            this.universalKey = arg
            // Derive tag from ComponentUUID (or use explicitTag if provided)
            if (explicitTag !== undefined) {
                this._tag = explicitTag
            } else {
                // Derive tag from ComponentUUID
                const [upcaseTag] = arg.split('#')
                const derivedTag = componentTagFromUpperCase(upcaseTag as Uppercase<ComponentTag>)
                if (!derivedTag) {
                    throw new Error('Cannot derive tag from ComponentUUID')
                }
                this._tag = derivedTag
            }
            this._ref = 1 // Default to 1 for ComponentUUID string form
            return
        }
        
        // Handle StandardReferenceData object
        if (isStandardReferenceData(arg)) {
            if (typeof arg === 'string') {
                if (!isSchemaComponentUUID(arg)) {
                    throw new Error('Invalid StandardReferenceData passed to StandardReference')
                }
                this.universalKey = arg
                const derivedTag = deriveTagFromReferenceData(arg)
                if (!derivedTag) {
                    throw new Error('Cannot derive tag from ComponentUUID')
                }
                this._tag = derivedTag
                this._ref = 1
                return
            }
            this.key = arg.key
            this.universalKey = arg.universalKey
            // Runtime fail-safe: TypeScript requires tag in object form, but validate at runtime
            if (!arg.tag && !arg.universalKey) {
                throw new Error('StandardReferenceData object form requires tag')
            }
            this._tag = arg.tag ?? deriveTagFromReferenceData(arg)
            this._ref = arg.ref ?? 1 // Extract ref from data, default to 1
            return
        }
        
        // Handle GenericTree<SchemaTag>
        if (Array.isArray(arg) && arg.length > 0) {
            const firstElement = arg[0]
            
            // Check for Remove tag
            if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
                const parsed = parseRemoveTag(arg)
                this.key = parsed.key
                this.universalKey = parsed.universalKey
                this._tag = parsed._tag
                this._ref = parsed._ref
                return
            }
            
            // Check for Replace tag - illegal for references
            if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                throw new Error('Replace operations are illegal for references. References can only be added or removed, not replaced.')
            }
            
            // Parse as plain reference
            const node = arg[0]
            if (!treeNodeTypeguard(isSchemaComponent)(node)) {
                throw new Error('Invalid GenericTree<SchemaTag> in StandardReference constructor')
            }
            const { key, uuid, tag } = node.data
            this.key = key
            this.universalKey = uuid
            if (!tag) {
                throw new Error('Schema node requires tag for StandardReference')
            }
            this._tag = tag
            // Extract ref from schema node data (if present), default to 1
            this._ref = 'ref' in node.data && typeof node.data.ref === 'number' ? node.data.ref : 1
            return
        }
        
        throw new Error(`Invalid argument to StandardReference constructor: ${JSON.stringify(arg)}`)
    }

    get tag(): ComponentTag {
        return this._tag
    }
    
    get ref(): number {
        return this._ref
    }
    
    get standardKey(): StandardKey {
        if (this.key !== undefined && this.key !== '') {
            const result = new StandardKey({ key: this.key, universalKey: this.universalKey })
            return result
        }
        if (this.universalKey !== undefined) {
            const result = new StandardKey(this.universalKey as ComponentUUID)
            return result
        }
        throw new Error('StandardReference.standardKey requires either key or universalKey to be set')
    }
    
    get schema(): GenericTree<SchemaTag> {
        // If ref is negative, wrap in Remove tag with absolute value
        if (this._ref < 0) {
            // Create a temporary reference with the absolute value of ref
            const absRefData: StandardReferenceData = {
                key: this.key,
                universalKey: this.universalKey,
                tag: this._tag,
                ref: Math.abs(this._ref)
            }
            const tempRef = new StandardReference(absRefData)
            // Wrap the schema in a Remove tag
            return [{ data: { tag: 'Remove' as const }, children: tempRef._getPlainSchema() }]
        }
        // For non-negative ref, return plain schema
        return this._getPlainSchema()
    }
    
    private _getPlainSchema(): GenericTree<SchemaTag> {
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
    
    nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        return [{ data: tag, children: this.schema }]
    }
    
    toJSON(): StandardReferenceData {
        if (!this.key && this.universalKey) {
            // If only universalKey, return ComponentUUID string form (ref not included in string form)
            // However, if ref is non-default, we must return object form to include ref
            if (this._ref !== 1) {
                const result: StandardReferenceData = { universalKey: this.universalKey, tag: this._tag, ref: this._ref }
                return result
            }
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
        throw new Error('StandardReference must have a universalKey or key')
    }
    
    clone(): StandardReference {
        return new StandardReference(this)
    }

    merge(incoming: StandardReference, options?: { cleanEmptyReferences?: boolean }): StandardReference | undefined {
        if (!this.sameKey(incoming)) {
            throw new Error('Cannot change which component a reference points to')
        }
        
        const { cleanEmptyReferences = true } = options ?? {}
        
        // Get ref values from both references
        const baseRef = this._ref
        const otherRef = incoming._ref
        
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
        const returnValue = this.clone()
        returnValue._ref = mergedRef
        return returnValue
    }
    
    diff(incoming: StandardReference | undefined): StandardReference | undefined {
        if (incoming) {
            if (!this.sameKey(incoming)) {
                throw new Error('Cannot change which component a reference points to')
            }
            
            // Get ref values: base (this) and incoming
            const baseRef = this._ref
            const incomingRef = incoming._ref
            
            // Calculate diff: incoming - base
            const diffRef = incomingRef - baseRef
            
            // Handle zero result: no change, return undefined
            if (diffRef === 0) {
                return undefined
            }
            
            // Non-zero result: create new reference with diff ref value
            const returnValue = this.clone()
            returnValue._ref = diffRef
            return returnValue
        }
        else {
            // Diff from this reference to nothing: invert the ref value
            const baseRef = this._ref
            const invertedRef = -baseRef
            
            // If ref is 0, inverting gives 0 (no change)
            if (invertedRef === 0) {
                return undefined
            }
            
            // Create inverted reference
            const returnValue = this.clone()
            returnValue._ref = invertedRef
            return returnValue
        }
    }
    
    mapContents(callback: (incoming: StandardReferenceData) => StandardReferenceData): StandardReference {
        const currentData = this.toJSON()
        const currentRef = this._ref
        const updatedData = callback(currentData)
        
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
        returnValue.key = key
        return returnValue
    }

    withRef(ref: number): StandardReference {
        const returnValue = this.clone()
        returnValue._ref = ref
        return returnValue
    }

    equal(other: StandardReference): boolean {
        return this.standardKey.equals(other.standardKey)
    }

    sameKey(other: any): boolean {
        // Compare what each reference points to (plain value) for list matching
        // Prioritizes universalKey: if both have the same universalKey, they're the same component
        // regardless of local key differences
        if (!(other instanceof StandardReference)) {
            return false
        }
        
        const baseStandardKey = this.standardKey
        const otherStandardKey = other.standardKey
        
        // If both have universalKey and they match, they're the same component
        if (baseStandardKey.universalKey && otherStandardKey.universalKey) {
            return baseStandardKey.universalKey === otherStandardKey.universalKey
        }
        
        // Otherwise, fall back to standardKey.equals() which compares keys
        return baseStandardKey.equals(otherStandardKey)
    }

    invert(): StandardReference {
        return this.withRef(-this._ref)
    }

    lookup(arg: LookupMappings): StandardReference {
        const callback = typeof arg === 'function' ? arg : (key: StandardKey) => {
            if (!Array.isArray(arg)) {
                throw new Error('Invalid argument type for lookup')
            }
            // Check if it's StandardReference[] by examining first element
            if (arg.length > 0 && arg[0] instanceof StandardReference) {
                const refArray = arg as StandardReference[]
                const matchingRef = refArray.find((item) => item.standardKey.equals(key))
                return matchingRef?.standardKey
            }
            // Handle StandardKey[] array (for backward compatibility during transition)
            if (arg.length === 0 || (arg.length > 0 && arg[0] instanceof StandardKey)) {
                const keyArray = arg as StandardKey[]
                return keyArray.find((item) => item.equals(key))
            }
            throw new Error('Invalid argument type for lookup')
        }
        const currentKey = this.standardKey
        const lookedUpKey = callback(currentKey)
        // Only clone if no lookup found a match (lookedUpKey is undefined or same object reference)
        if (!lookedUpKey || lookedUpKey === currentKey) {
            return this.clone()
        }
        // Extract properties directly from looked-up key to preserve both key and universalKey
        const tag = this._tag
        const ref = this._ref
        const referenceData: StandardReferenceData = lookedUpKey.universalKey && !lookedUpKey.key
            ? lookedUpKey.universalKey  // Use ComponentUUID string form when only universalKey exists
            : { key: lookedUpKey.key || '', universalKey: lookedUpKey.universalKey, tag, ref }
        // When referenceData is a string, StandardReference constructor sets _ref = 1, so we need to restore the original ref
        const result = typeof referenceData === 'string'
            ? new StandardReference(referenceData).withRef(ref)
            : new StandardReference(referenceData)
        return result
    }

    toFormat(format: ReferenceFormat, mappings?: LookupMappings): StandardReference {
        // First lookup if mappings provided
        const reference = mappings ? this.lookup(mappings) : this
        // Then format
        const key = reference.standardKey
        const formattedKey = key.toFormat(format)
        const tag = reference._tag
        const ref = reference._ref
        const keyData = formattedKey.toJSON()
        const referenceData: StandardReferenceData = typeof keyData === 'string' 
            ? keyData 
            : { ...keyData, tag }
        return new StandardReference(referenceData).withRef(ref)
    }
}

/**
 * Simple sort order for references that compares by tag and key only (no nested hierarchy).
 * Use this when sorting references that are already at the same hierarchy level.
 * For sorting components with nested parent-child relationships, use `SchemaOrganization.sortOrder()`.
 * 
 * Sorting rules:
 * 1. First by component tag order
 * 2. Then: items with only `universalKey` (no local `key`) come before items with a local `key`
 * 3. Within universalKey-only items: sort by `universalKey` alphabetically
 * 4. Within items with local `key`: sort by `key` alphabetically
 * 
 * @param referenceA - First reference or key to compare
 * @param referenceB - Second reference or key to compare
 * @returns Negative if A < B, positive if A > B, zero if equal
 */
export const referenceSortOrder = (
    referenceA: StandardReference | StandardKey,
    referenceB: StandardReference | StandardKey
): number => {
    // Extract keys from references if needed
    const keyA = referenceA instanceof StandardReference ? referenceA.standardKey : referenceA
    const keyB = referenceB instanceof StandardReference ? referenceB.standardKey : referenceB
    
    // Get tags from keys
    const tagA = keyA.tag
    const tagB = keyB.tag
    
    // If either tag is undefined, we can't compare properly - fallback to identifier comparison
    if (!tagA || !tagB) {
        // If both have keys, compare by key
        if (keyA.key && keyB.key) {
            return keyA.key.localeCompare(keyB.key)
        }
        // If both have only universalKeys, compare by universalKey
        if (!keyA.key && !keyB.key && keyA.universalKey && keyB.universalKey) {
            return keyA.universalKey.localeCompare(keyB.universalKey)
        }
        // UniversalKey-only comes before key
        if (!keyA.key && keyB.key) return -1
        if (keyA.key && !keyB.key) return 1
        // Fallback to string comparison of available identifiers
        const idA = keyA.key ?? keyA.universalKey ?? ''
        const idB = keyB.key ?? keyB.universalKey ?? ''
        return idA.localeCompare(idB)
    }
    
    // Component tag order
    const componentKeys: ComponentTag[] = ['Character', 'Image', 'Lens', 'Mark', 'Guidance', 'Feature', 'Knowledge', 'Room', 'Map', 'Area', 'Message', 'Moment', 'Situation']
    const indexA = componentKeys.indexOf(tagA)
    const indexB = componentKeys.indexOf(tagB)
    
    // Compare by tag order first
    if (indexA !== indexB) {
        return indexA - indexB
    }
    
    // Same tag - check if items have local keys
    const hasKeyA = Boolean(keyA.key)
    const hasKeyB = Boolean(keyB.key)
    
    // Items with only universalKey come before items with local key
    if (!hasKeyA && hasKeyB) {
        return -1
    }
    if (hasKeyA && !hasKeyB) {
        return 1
    }
    
    // Both have same key presence - sort within their group
    if (!hasKeyA && !hasKeyB) {
        // Both are universalKey-only - sort by universalKey
        const universalKeyA = keyA.universalKey ?? ''
        const universalKeyB = keyB.universalKey ?? ''
        return universalKeyA.localeCompare(universalKeyB)
    } else {
        // Both have local keys - sort by key alphabetically
        const keyAStr = keyA.key ?? ''
        const keyBStr = keyB.key ?? ''
        return keyAStr.localeCompare(keyBStr)
    }
}

/**
 * Generic class for mapping payloads by StandardKey using dual Map storage.
 * Provides efficient O(1) lookups by both universalKey and local key.
 * 
 * @template Payload - The type of payload to store
 */
export class MapByKey<Payload> {
    private _byUniversalKey: Map<ComponentUUID, { key: StandardKey; payload: Payload }>
    private _byKey: Map<string, { key: StandardKey; payload: Payload }>

    constructor(
        entries: Array<{ key: StandardKey; payload: Payload }> | MapByKey<Payload>
    ) {
        this._byUniversalKey = new Map()
        this._byKey = new Map()

        if (entries instanceof MapByKey) {
            // Clone from another MapByKey
            entries._byUniversalKey.forEach((entry, uuid) => {
                this._byUniversalKey.set(uuid, { key: entry.key.clone(), payload: entry.payload })
            })
            entries._byKey.forEach((entry, key) => {
                this._byKey.set(key, { key: entry.key.clone(), payload: entry.payload })
            })
            return
        }

        // Populate from array of entries using reduce
        const { byUniversalKey, byKey } = entries.reduce(
            (acc, { key, payload }) => {
                const entry = { key: key.clone(), payload }

                // Add to _byUniversalKey if universalKey exists
                if (key.universalKey) {
                    const existing = acc.byUniversalKey.get(key.universalKey)
                    if (existing && existing.payload !== payload) {
                        throw new Error(
                            `Conflict: universalKey ${key.universalKey} maps to different payloads. ` +
                            `Existing: ${JSON.stringify(existing.payload)}, New: ${JSON.stringify(payload)}`
                        )
                    }
                    acc.byUniversalKey.set(key.universalKey, entry)
                }

                // Add to _byKey if key exists
                if (key.key) {
                    const existing = acc.byKey.get(key.key)
                    if (existing && existing.payload !== payload) {
                        throw new Error(
                            `Conflict: key "${key.key}" maps to different payloads. ` +
                            `Existing: ${JSON.stringify(existing.payload)}, New: ${JSON.stringify(payload)}`
                        )
                    }
                    acc.byKey.set(key.key, entry)
                }

                return acc
            },
            {
                byUniversalKey: new Map<ComponentUUID, { key: StandardKey; payload: Payload }>(),
                byKey: new Map<string, { key: StandardKey; payload: Payload }>()
            }
        )

        this._byUniversalKey = byUniversalKey
        this._byKey = byKey
    }

    /**
     * Look up a payload by StandardKey.
     * Checks both Maps and validates consistency.
     * 
     * @param key - The StandardKey to look up
     * @returns The payload if found, undefined otherwise
     * @throws Error if both Maps have different payloads for the same key (data inconsistency)
     */
    lookup(key: StandardKey): Payload | undefined {
        let universalEntry: { key: StandardKey; payload: Payload } | undefined
        let keyEntry: { key: StandardKey; payload: Payload } | undefined

        if (key.universalKey) {
            universalEntry = this._byUniversalKey.get(key.universalKey)
        }

        if (key.key) {
            keyEntry = this._byKey.get(key.key)
        }

        // Conflict detection: both Maps have entries but different payloads
        if (universalEntry && keyEntry && universalEntry.payload !== keyEntry.payload) {
            throw new Error(
                `Data inconsistency: universalKey ${key.universalKey} and key "${key.key}" ` +
                `map to different payloads. Universal: ${JSON.stringify(universalEntry.payload)}, ` +
                `Key: ${JSON.stringify(keyEntry.payload)}`
            )
        }

        // Return payload from whichever Map has it (or undefined if neither)
        return universalEntry?.payload ?? keyEntry?.payload
    }

    /**
     * Returns all entries (key-value pairs) in sorted order.
     * Combines entries from both Maps, deduplicating by payload identity.
     * 
     * @param sortOrder - Optional custom sort function (defaults to keySortOrder)
     * @returns Array of entries sorted by key
     */
    sortedOutput(
        sortOrder?: (a: StandardKey, b: StandardKey) => number
    ): Array<{ key: StandardKey; payload: Payload }> {
        const sortFn = sortOrder ?? keySortOrder

        // Collect all entries from _byUniversalKey using reduce
        // Store entries in an array, we'll deduplicate by StandardKey equality
        const entries: Array<{ key: StandardKey; payload: Payload }> = Array.from(this._byUniversalKey.values())

        // Process _byKey entries: combine with universalKey entries or add as local-only
        Array.from(this._byKey.values()).forEach(entry => {
            // Find existing entry by checking if any key equals this entry's key
            const existingIndex = entries.findIndex(existing => existing.key.equals(entry.key))
            if (existingIndex >= 0) {
                // Combine: create StandardKey with both universalKey and key
                const existing = entries[existingIndex]
                const combinedKey = existing.key.merge(entry.key)
                // Update the entry with combined key, keeping the existing payload
                entries[existingIndex] = { key: combinedKey, payload: existing.payload }
            } else {
                // Local-only entry - add it
                entries.push(entry)
            }
        })

        // Sort entries
        entries.sort((a, b) => sortFn(a.key, b.key))

        return entries
    }

    /**
     * Add or update an entry in the map.
     * Returns a new MapByKey instance (functional pattern).
     * 
     * @param key - The StandardKey for the entry
     * @param payload - The payload to store
     * @returns New MapByKey instance with the entry added/updated
     */
    add(key: StandardKey, payload: Payload): MapByKey<Payload> {
        const entries = this.sortedOutput()
        const existingIndex = entries.findIndex((entry) => entry.key.equals(key))
        
        if (existingIndex >= 0) {
            // Update existing entry
            entries[existingIndex] = { key: key.clone(), payload }
        } else {
            // Add new entry
            entries.push({ key: key.clone(), payload })
        }

        return new MapByKey(entries)
    }

    /**
     * Remove an entry from the map.
     * Returns a new MapByKey instance (functional pattern).
     * 
     * @param key - The StandardKey to remove
     * @returns New MapByKey instance with the entry removed
     */
    remove(key: StandardKey): MapByKey<Payload> {
        const entries = this.sortedOutput()
        const filtered = entries.filter((entry) => !entry.key.equals(key))
        return new MapByKey(filtered)
    }

    /**
     * Merge another MapByKey into this one.
     * Returns a new MapByKey instance (functional pattern).
     * Throws error on conflicts (same key mapping to different payloads).
     * 
     * When merging, if an incoming key matches multiple existing entries (e.g., 
     * `{ key: 'room1', universalKey: 'ROOM#room1' }` matches both `{ key: 'room1' }` 
     * and `{ universalKey: 'ROOM#room1' }`), all matching entries are merged into 
     * a single entry with the combined key information.
     * 
     * @param other - The MapByKey to merge
     * @returns New MapByKey instance with merged entries
     * @throws Error if there are conflicts
     */
    merge(other: MapByKey<Payload>): MapByKey<Payload> {
        const thisEntries = this.sortedOutput()
        const otherEntries = other.sortedOutput()

        const mergedEntries = otherEntries.reduce(
            (acc, otherEntry) => {
                // Find all entries that match the incoming key (they represent the same component)
                const matches = acc.filter(entry => entry.key.equals(otherEntry.key))
                
                if (matches.length > 0) {
                    // Check that all matching entries have the same payload
                    const conflictingMatch = matches.find(match => match.payload !== otherEntry.payload)
                    if (conflictingMatch) {
                        throw new Error(
                            `Merge conflict: StandardKey maps to different payloads. ` +
                            `Key: ${JSON.stringify(conflictingMatch.key.toJSON())}, ` +
                            `This payload: ${JSON.stringify(conflictingMatch.payload)}, ` +
                            `Other payload: ${JSON.stringify(otherEntry.payload)}`
                        )
                    }
                    
                    // Merge all matching keys into one combined key
                    const combinedKey = matches.reduce(
                        (mergedKey, match) => mergedKey.merge(match.key),
                        otherEntry.key.clone()
                    )
                    
                    // Remove all matching entries and add the merged entry
                    return [
                        ...acc.filter(entry => !entry.key.equals(otherEntry.key)),
                        { key: combinedKey, payload: otherEntry.payload }
                    ]
                } else {
                    // No matches, add as new entry
                    return [...acc, otherEntry]
                }
            },
            thisEntries
        )

        return new MapByKey(mergedEntries)
    }
}

export default StandardReference
