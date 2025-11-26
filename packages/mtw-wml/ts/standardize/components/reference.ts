import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { ComponentUUID, isSchemaComponent, isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { ComponentTag, componentTagFromUpperCase } from "./dataTypes/abstract";
import { isStandardReferencePayloadData, StandardReferenceData } from "./dataTypes/reference";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { StandardEditableDataDelta, standardEditableFactory, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { ReferenceFormat } from "./utils/references";
import { editableListClassFactory, EditableListItem } from "./editableList";

export class StandardKey implements StandardEditablePayload<StandardReferenceData> {
    key?: string;
    universalKey?: ComponentUUID;
    context?: StandardKey[];
    parent?: StandardKey;
    _tag?: ComponentTag;
    constructor(data: string | StandardReferenceData | StandardKey) {
        // Handle StandardKey instance directly (for cloning)
        if (data instanceof StandardKey) {
            this.key = data.key
            this.universalKey = data.universalKey
            this.context = data.context ? data.context.map(item => new StandardKey(item)) : undefined
            this.parent = data.parent ? new StandardKey(data.parent) : undefined
            this._tag = data._tag
            return
        }
        
        if (typeof data === 'string') {
            if (!isSchemaComponentUUID(data)) {
                console.log(`Invalid StandardReferenceData passed to StandardKey: ${JSON.stringify(data, null, 4)}`)
                throw new Error('Invalid StandardReferenceData passed to StandardKey')
            }
            this._tag = componentTagFromUpperCase(data.split('#')[0] as Uppercase<ComponentTag>)
            this.universalKey = data
        }
        else {
            this.key = data.key
            this.universalKey = data.universalKey
            this.context = data.context ? data.context.map(item => new StandardKey(item)) : undefined
            // Support parent field - always convert to StandardKey
            // In serialized form, parent is only ComponentUUID string (no recursive nesting)
            if (data.parent) {
                // Parent is ComponentUUID string - construct StandardKey from it
                this.parent = new StandardKey(data.parent)
            }
            this._tag = data.tag
        }
    }
    get tag(): ComponentTag {
        if (this._tag) {
            return this._tag
        }
        if (typeof this.universalKey === 'undefined') {
            throw new Error('StandardKey must have a universalKey or tag')
        }
        const [upcaseTag] = this.universalKey.split('#')
        return componentTagFromUpperCase(upcaseTag as Uppercase<ComponentTag>)
    }
    get schema() {
        return [{
            data: {
                tag: this.tag,
                key: this.key,
                uuid: this.universalKey
            } as SchemaTag,
            children: []
        }]
    }
    clone() {
        return new StandardKey(this)
    }
    toJSON: () => StandardReferenceData = () => {
        if (typeof this.key === 'undefined' && !this.parent) {
            if (typeof this.universalKey === 'undefined') {
                throw new Error('StandardKey must have a universalKey or key')
            }
            return this.universalKey
        }
        const result: any = { key: this.key, tag: this.tag, universalKey: this.universalKey }
        if (this.parent) {
            // Serialize parent as just its universalKey to avoid recursive nesting
            // The full parent chain can be resolved using getAncestryChain() with a lookup function
            if (this.parent.universalKey) {
                result.parent = this.parent.universalKey
            } else {
                // If parent doesn't have universalKey, serialize its plain form (which clears parent)
                result.parent = this.parent.plain.toJSON()
            }
        }
        return result as StandardReferenceData
    }
    withKey(key: string): StandardKey {
        const returnValue = this.clone()
        returnValue.key = key
        return returnValue
    }
    withContext(context: StandardKey[]): StandardKey {
        const returnValue = this.clone()
        returnValue.context = context
        return returnValue
    }

    withParent(parent: StandardKey | ComponentUUID | undefined): StandardKey {
        const returnValue = this.clone()
        // Always convert to StandardKey if it's a ComponentUUID string
        if (parent && typeof parent === 'string') {
            returnValue.parent = new StandardKey(parent)
        } else {
            returnValue.parent = parent
        }
        return returnValue
    }

    /**
     * Returns true if this key has a parent reference
     */
    hasParent(): boolean {
        return this.parent !== undefined
    }

    /**
     * Returns the direct parent as a StandardKey, or undefined if no parent
     */
    getDirectParent(): StandardKey | undefined {
        return this.parent
    }

    /**
     * Gets the full ancestry chain by traversing parent links.
     * Returns an array of StandardKey[] representing the chain from root to direct parent.
     * 
     * Note: This does NOT include the current key itself, only ancestors.
     * 
     * @param lookup - Function to look up a component by its universalKey to resolve parent references
     * @param visited - Internal array to detect cycles (should not be called directly)
     * @returns Array of StandardKey[] representing the ancestry chain, empty array for Asset-level components
     */
    getAncestryChain(
        lookup: (uuid: ComponentUUID) => StandardKey | undefined,
        visited: ComponentUUID[] = []
    ): StandardKey[] {
        // Safety check: detect cycles (though this shouldn't happen with proper topological sorting)
        // Use universalKey as identifier if available, otherwise we can't reliably detect cycles
        // StandardKeys without universalKey shouldn't be in parent chains anyway
        if (!this.universalKey) {
            // No universalKey means we can't reliably track this in the visited set
            // Return empty to avoid issues
            return []
        }
        
        const keyIdentifier: ComponentUUID = this.universalKey
        
        // Check for cycle BEFORE adding to visited
        if (visited.includes(keyIdentifier)) {
            // Cycle detected - this indicates a data integrity problem
            // Throw an error rather than silently returning empty
            throw new Error(`Cycle detected in parent chain: ${keyIdentifier} appears multiple times in ancestry. Visited: ${visited.join(' -> ')} -> ${keyIdentifier}`)
        }
        
        // Add current key to visited BEFORE recursive call
        const extendedVisited = [...visited, keyIdentifier]
        
        if (!this.parent) {
            // Asset level - no ancestors
            return []
        }

        // Parent in StandardKey is stored as a StandardKey object, but only contains one level
        // We need to use the parent's universalKey to look up the full parent chain
        const parentKey = this.parent.universalKey ? lookup(this.parent.universalKey) : undefined
        
        if (!parentKey) {
            // Parent not found in lookup - treat as Asset level
            return []
        }

        // Recursively get parent's chain, then append parent
        // Pass the extended visited array to detect cycles across the recursion
        const parentChain = parentKey.getAncestryChain(lookup, extendedVisited)
        return [...parentChain, parentKey]
    }
    
    equals(other: StandardKey): boolean {
        //
        // Returns if the two objects share either the same key or the same universalKey,
        // and have no other differences
        //
        if (this.tag !== other.tag) {
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
        // TODO: Remove context intersection after context property is removed from StandardKey.
        // This context intersection is a temporary compatibility measure. Hierarchical connections
        // are handled at the component level (via implicitParent), not at the key level.
        const newContext = (this.context ?? []).filter((reference) => ((other.context ?? []).some((otherReference) => ((otherReference.equals(new StandardKey(reference.toJSON())))))))
        returnValue.context = newContext.length > 0 ? newContext : undefined
        return returnValue
    }

    get plain(): StandardKey {
        const returnValue = this.clone()
        returnValue.context = undefined
        returnValue.parent = undefined
        return returnValue
    }

    toFormat(format: ReferenceFormat): StandardKey {
        if (format === 'both') {
            return this.clone()
        }
        const returnValue = this.clone()
        if (format === 'key') {
            if (returnValue.key) {
                returnValue._tag = returnValue.tag
                returnValue.universalKey = undefined
            }
        }
        else {
            if (returnValue.universalKey) {
                returnValue._tag = undefined
                returnValue.key = undefined
            }
        }
        return returnValue
    }
}

const payloadFactory = (props: StandardReferenceData | GenericTree<SchemaTag>): StandardKey | undefined => {
    if (isStandardReferencePayloadData(props)) {
        return new StandardKey(props)
    }
    if (props.length === 1) {
        const node = props[0]
        if (!treeNodeTypeguard(isSchemaComponent)(node)) {
            throw new Error('Invalid argument in StandardKey constructor')
        }
        const { tag, key, uuid } = node.data
        return new StandardKey({ tag, key, universalKey: uuid })
    }
    throw new Error('Invalid argument in StandardKey constructor')
}

export const standardReferenceDeserialize = (incoming: StandardReferenceData): Exclude<StandardReferenceData, string> => {
    if (typeof incoming === 'string') {
        if (!isSchemaComponentUUID(incoming)) {
            throw new Error('Invalid StandardReferenceData passed to standardReferenceSerialize')
        }
        const [upcaseTag] = incoming.split('#')
        return { tag: componentTagFromUpperCase(upcaseTag as Uppercase<ComponentTag>), universalKey: incoming }
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
    const { tag, universalKey, key } = incoming
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

const standardReferenceSubtract = (base: StandardReferenceData, incoming: StandardReferenceData): { add?: string, remove?: string } => {
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
    payload: StandardKey,
    add: standardReferenceAdd,
    subtract: standardReferenceSubtract,
    diff: standardReferenceDiff
})

const fromDelta = (delta: { add?: StandardReferenceData, remove?: StandardReferenceData }): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined => {
    const { add, remove } = delta
    if (add) {
        if (remove) {
            return new StandardReferenceReplace(new StandardKey(remove), new StandardKey(add))
        }
        return new StandardReferenceSimple(new StandardKey(add))
    }
    if (remove) {
        return new StandardReferenceRemove(new StandardKey(remove))
    }
    return undefined
}

export class StandardReferenceSimple implements StandardEditableWrapper<StandardKey> {
    payload: StandardKey
    constructor(data: StandardKey | StandardEditableData<StandardReferenceData> | GenericTree<SchemaTag> | string) {
        if (data instanceof StandardKey) {
            this.payload = data
            return
        }
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
    get tag() {
        return this.payload.tag
    }
    get context() {
        return this.payload.context
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
    toJSON: () => StandardEditableData<StandardReferenceData> = () => this.payload.toJSON()
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardKey>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardKey>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    withKey(key: string): StandardReferenceSimple {
        const returnValue = this.clone()
        returnValue.payload = this.payload.withKey(key)
        return returnValue
    }
    withContext(context: StandardKey[]): StandardReferenceSimple {
        const returnValue = this.clone()
        returnValue.payload = this.payload.withContext(context)
        return returnValue
    }
    equals(other: StandardReferenceSimple): boolean {
        return this.payload.equals(other.payload)
    }
}

export class StandardReferenceRemove implements StandardEditableWrapper<StandardKey> {
    match: StandardKey
    constructor(data: StandardKey | StandardEditableData<StandardReferenceData> | GenericTree<SchemaTag> | string) {
        if (data instanceof StandardKey) {
            this.match = data
            return
        }
        const delta = factory(data)
        if (delta && !delta.add && delta.remove) {
            this.match = delta.remove
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
        return this.match.context
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
    toJSON: () => StandardEditableData<StandardReferenceData> = () => ({ tag: 'Remove' as const, match: this.match.toJSON() })
    get plain() { return this.match }
    merge(other: StandardEditableWrapper<StandardKey>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardKey>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    withKey(key: string): StandardReferenceRemove {
        const returnValue = this.clone()
        returnValue.match = this.match.withKey(key)
        return returnValue
    }
    withContext(context: StandardKey[]): StandardReferenceRemove {
        const returnValue = this.clone()
        returnValue.match = this.match.withContext(context)
        return returnValue
    }
}

export class StandardReferenceReplace implements StandardEditableWrapper<StandardKey> {
    match: StandardKey
    payload: StandardKey
    constructor(...args: [StandardEditableData<string> | GenericTree<SchemaTag> | string] | [StandardKey, StandardKey]) {
        if (args.length === 2) {
            this.match = args[0]
            this.payload = args[1]
            return
        }
        const delta = factory(args[0])
        if (delta && delta.add && delta.remove) {
            this.match = delta.remove
            this.payload = delta.add
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
        return this.payload.context
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
    toJSON: () => StandardEditableData<StandardReferenceData> = () => ({ 
        tag: 'Replace' as const,
        match: this.match.toJSON(),
        payload: this.payload.toJSON()
    })
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardKey>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardKey>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    withKey(key: string): StandardReferenceReplace {
        const returnValue = this.clone()
        returnValue.match = this.match.withKey(key)
        returnValue.payload = this.payload.withKey(key)
        return returnValue
    }
    withContext(context: StandardKey[]): StandardReferenceReplace {
        const returnValue = this.clone()
        returnValue.match = this.match.withContext(context)
        returnValue.payload = this.payload.withContext(context)
        return returnValue
    }
}

export class StandardReference {
    _payload: StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace;
    
    constructor(arg: any) {
        if (arg instanceof StandardReferenceSimple || arg instanceof StandardReferenceRemove || arg instanceof StandardReferenceReplace) {
            this._payload = arg
            return
        }
        const delta = factory(arg)
        if (!delta) {
            console.log(`Invalid argument to StandardReference constructor: ${JSON.stringify(arg)}`)
            throw new Error('Invalid argument to StandardReference constructor')
        }
        if (delta.add) {
            if (delta.remove) {
                this._payload = new StandardReferenceReplace(arg)
                return
            }
            this._payload = new StandardReferenceSimple(arg)
            return
        }
        if (delta.remove) {
            this._payload = new StandardReferenceRemove(arg)
            return
        }
        throw new Error('Invalid argument to StandardReference constructor')
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
    get tag(): ComponentTag {
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
            return new StandardReference(callback(this._payload.payload.toJSON()))
        }
        if (this._payload instanceof StandardReferenceRemove) {
            return new StandardReference(new StandardReferenceRemove(new StandardKey(callback(this._payload.match.toJSON()))))
        }
        if (this._payload instanceof StandardReferenceReplace) {
            return new StandardReference(new StandardReferenceReplace((new StandardReferenceSimple(callback(this._payload.match.toJSON()))).payload, (new StandardReferenceSimple(callback(this._payload.payload.toJSON()))).payload))
        }
        throw new Error('Invalid StandardReference payload')
    }

    withKey(key: string): StandardReference {
        const returnValue = this.clone()
        returnValue._payload = this._payload.withKey(key)
        return returnValue
    }

    withContext(context: StandardKey[]): StandardReference {
        const returnValue = this.clone()
        returnValue._payload = this._payload.withContext(context)
        return returnValue
    }

    plain(): StandardKey {
        return this._payload.plain
    }

    _delta(): StandardEditableDataDelta<StandardReferenceData> | undefined {
        if (this._payload instanceof StandardReferenceSimple) {
            return { add: this._payload.payload.toJSON() }
        }
        if (this._payload instanceof StandardReferenceRemove) {
            return { remove: this._payload.match.toJSON() }
        }
        if (this._payload instanceof StandardReferenceReplace) {
            return { add: this._payload.payload.toJSON(), remove: this._payload.match.toJSON() }
        }
    }

    equal(other: StandardReference): boolean {
        if (this._payload instanceof StandardReferenceSimple && other._payload instanceof StandardReferenceSimple) {
            return this._payload.payload.equals(other._payload.payload)
        }
        if (this._payload instanceof StandardReferenceRemove && other._payload instanceof StandardReferenceRemove) {
            return this._payload.match.equals(other._payload.match)
        }
        if (this._payload instanceof StandardReferenceReplace && other._payload instanceof StandardReferenceReplace) {
            return this._payload.match.equals(other._payload.match) && this._payload.payload.equals(other._payload.payload)
        }
        return false
    }

    sameKey(other: any): boolean {
        //
        // sameKey is NOT commutative: In the case of a replace, it checks the base against its payload, and
        // the incoming comparator against its match.
        //
        if (!(other instanceof StandardReference)) {
            return false
        }
        const thisKey = this._payload instanceof StandardReferenceReplace ? this._payload.payload : this._payload.plain
        const otherKey = other._payload instanceof StandardReferenceReplace ? other._payload.match : other._payload.plain
        return thisKey.equals(otherKey)
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
            return new StandardReference(new StandardReferenceSimple(callback(this._payload.payload) ?? this._payload.payload))
        }
        if (this._payload instanceof StandardReferenceRemove) {
            return new StandardReference(new StandardReferenceRemove(callback(this._payload.match) ?? this._payload.match))
        }
        if (this._payload instanceof StandardReferenceReplace) {
            return new StandardReference(new StandardReferenceReplace(callback(this._payload.match) ?? this._payload.match, callback(this._payload.payload) ?? this._payload.payload))
        }
        throw new Error('Invalid StandardReference payload for lookup')
    }

    toFormat(format: ReferenceFormat): StandardReference {
        if (this._payload instanceof StandardReferenceSimple) {
            return new StandardReference(new StandardReferenceSimple(this._payload.payload.toFormat(format)))
        }
        if (this._payload instanceof StandardReferenceRemove) {
            return new StandardReference(new StandardReferenceRemove(this._payload.match.toFormat(format)))
        }
        if (this._payload instanceof StandardReferenceReplace) {
            return new StandardReference(new StandardReferenceReplace(this._payload.match.toFormat(format), this._payload.payload.toFormat(format)))
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
                            ...data,
                            context: undefined
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

}


export default StandardReference
