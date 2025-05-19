import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { ComponentUUID, isSchemaComponent, isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { ComponentTag, componentTagFromUpperCase } from "./dataTypes/abstract";
import { isStandardReferencePayloadData, StandardReferenceData } from "./dataTypes/reference";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { unique } from "../../list";
import { excludeUndefined } from "../../lib/lists";
import { deepEqual } from "../../lib/objects";
import { StandardEditableDataDelta, standardEditableFactory, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

export class StandardReferenceSimpleBase implements StandardEditablePayload<StandardReferenceData> {
    key?: string;
    universalKey?: ComponentUUID;
    global?: boolean;
    tag: ComponentTag;
    constructor(data: string | StandardReferenceData) {
        if (typeof data === 'string') {
            if (!isSchemaComponentUUID(data)) {
                throw new Error('Invalid StandardReferenceData passed to StandardReferenceSimpleBase')
            }
            this.tag = componentTagFromUpperCase(data.split('#')[0] as Uppercase<ComponentTag>)
            this.universalKey = data
        }
        else {
            this.key = data.key
            this.universalKey = data.universalKey
            this.tag = data.tag
            this.global = data.global
        }
    }
    get schema() {
        return [{ data: { tag: this.tag, key: this.key, uuid: this.universalKey } as SchemaTag, children: [] }]
    }
    clone() {
        return new StandardReferenceSimpleBase(this.toJSON())
    }
    toJSON: () => StandardReferenceData = () => {
        if (typeof this.key !== 'undefined') {
            return { key: this.key, tag: this.tag, universalKey: this.universalKey, global: this.global } as StandardReferenceData
        }
        else {
            if (typeof this.universalKey === 'undefined') {
                throw new Error('StandardReferenceSimpleBase must have a universalKey or key')
            }
            return this.universalKey
        }
    }
    withKey(key: string): StandardReferenceSimpleBase {
        const returnValue = this.clone()
        returnValue.key = key
        return returnValue
    }
}

const payloadFactory = (props: StandardReferenceData | GenericTree<SchemaTag>): StandardReferenceSimpleBase | undefined => {
    if (isStandardReferencePayloadData(props)) {
        return new StandardReferenceSimpleBase(props)
    }
    if (props.length === 1) {
        const node = props[0]
        if (!treeNodeTypeguard(isSchemaComponent)(node)) {
            throw new Error('Invalid argument in StandardReferenceSimpleBase constructor')
        }
        const { tag, key, uuid } = node.data
        const global = 'global' in node.data ? node.data.global : undefined
        return new StandardReferenceSimpleBase({ tag, key, universalKey: uuid, global })
    }
    throw new Error('Invalid argument in StandardReferenceSimpleBase constructor')
}

export const standardReferenceDeserialize = (incoming: StandardReferenceData): StandardReferenceData => {
    if (typeof incoming === 'string') {
        const [upcaseTag] = incoming.split('#')
        return { tag: componentTagFromUpperCase(upcaseTag as Uppercase<ComponentTag>), universalKey: incoming } as StandardReferenceData
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
    return `${tag.toUpperCase()}#${universalKey}`
}

const standardReferenceAdd = (base: StandardReferenceData, incoming: StandardReferenceData): StandardReferenceData => {
    return incoming
}

const standardReferenceSubtract = (base: StandardReferenceData, incoming: StandardReferenceData): { add?: string, remove?: string } => {
    if (deepEqual(standardReferenceDeserialize(base), standardReferenceDeserialize(incoming))) {
        return { add: undefined, remove: undefined }
    }
    else {
        throw new MergeConflictError('Conflict during subtract operation')
    }
}

const standardReferenceDiff = (base: StandardReferenceData, incoming: StandardReferenceData): { add?: StandardReferenceData, remove?: StandardReferenceData } => {
    if (deepEqual(standardReferenceDeserialize(base), standardReferenceDeserialize(incoming))) {
        return { add: undefined, remove: undefined }
    }
    else {
        return { add: standardReferenceSerialize(incoming), remove: standardReferenceSerialize(base) }
    }
}

export const { constructorDelta: factory, typeguard: isStandardReferenceData, merge, diff } = standardEditableFactory({
    typeguard: isStandardReferencePayloadData,
    payloadFactory: payloadFactory,
    payload: StandardReferenceSimpleBase,
    add: standardReferenceAdd,
    subtract: standardReferenceSubtract,
    diff: standardReferenceDiff
})

const fromDelta = (delta: { add?: StandardReferenceData, remove?: StandardReferenceData }): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined => {
    const { add, remove } = delta
    if (add) {
        if (remove) {
            return new StandardReferenceReplace(new StandardReferenceSimpleBase(remove), new StandardReferenceSimpleBase(add))
        }
        return new StandardReferenceSimple(new StandardReferenceSimpleBase(add))
    }
    if (remove) {
        return new StandardReferenceRemove(new StandardReferenceSimpleBase(remove))
    }
    return undefined
}

export class StandardReferenceSimple implements StandardEditableWrapper<StandardReferenceSimpleBase> {
    payload: StandardReferenceSimpleBase
    constructor(data: StandardReferenceSimpleBase | StandardEditableData<StandardReferenceData> | GenericTree<SchemaTag> | string) {
        if (data instanceof StandardReferenceSimpleBase) {
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
    get global() {
        return this.payload.global
    }
    get tag() {
        return this.payload.tag
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
    merge(other: StandardEditableWrapper<StandardReferenceSimpleBase>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardReferenceSimpleBase>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    withKey(key: string): StandardReferenceSimple {
        const returnValue = this.clone()
        returnValue.payload = this.payload.withKey(key)
        return returnValue
    }
    equal(other: StandardReferenceSimple): boolean {
        //
        // Returns if the two objects share either the same key or the same universalKey,
        // and have no other differences
        //
        if (this.payload.universalKey && other.payload.universalKey && this.payload.universalKey !== other.payload.universalKey) {
            return false
        }
        if (this.payload.key && other.payload.key && this.payload.key !== other.payload.key) {
            return false
        }
        if (this.payload.key === other.payload.key || this.payload.universalKey === other.payload.universalKey) {
            return true
        }
        return false
    }
}

export class StandardReferenceRemove implements StandardEditableWrapper<StandardReferenceSimpleBase> {
    match: StandardReferenceSimpleBase
    constructor(data: StandardReferenceSimpleBase | StandardEditableData<StandardReferenceData> | GenericTree<SchemaTag> | string) {
        if (data instanceof StandardReferenceSimpleBase) {
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
    get global() {
        return this.match.global
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
    merge(other: StandardEditableWrapper<StandardReferenceSimpleBase>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardReferenceSimpleBase>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    withKey(key: string): StandardReferenceRemove {
        const returnValue = this.clone()
        returnValue.match = this.match.withKey(key)
        return returnValue
    }
}

export class StandardReferenceReplace implements StandardEditableWrapper<StandardReferenceSimpleBase> {
    match: StandardReferenceSimpleBase
    payload: StandardReferenceSimpleBase
    constructor(...args: [StandardEditableData<string> | GenericTree<SchemaTag> | string] | [StandardReferenceSimpleBase, StandardReferenceSimpleBase]) {
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
    get global() {
        return this.payload.global
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
    merge(other: StandardEditableWrapper<StandardReferenceSimpleBase>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardReferenceSimpleBase>): StandardReferenceSimple | StandardReferenceRemove | StandardReferenceReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    withKey(key: string): StandardReferenceReplace {
        const returnValue = this.clone()
        returnValue.match = this.match.withKey(key)
        returnValue.payload = this.payload.withKey(key)
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
    get universalKey(): string | undefined {
        return this._payload.universalKey
    }
    get global(): boolean | undefined {
        return this._payload.global
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
                    return new StandardReference(new StandardReferenceRemove(new StandardReferenceSimpleBase(reversedDelta.add)))
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
            return new StandardReference(new StandardReferenceRemove(new StandardReferenceSimpleBase(callback(this._payload.match.toJSON()))))
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

}

// export class StandardReferencePayload implements ComponentConstructorMethods<StandardReferenceData> {
//     tag: ComponentTag = 'Room';
//     _global?: boolean;

//     constructor(previous?: StandardReferencePayload) {
//         if (previous) {
//             this.tag = previous.tag
//             this._global = previous.global
//         }
//     }

//     fromJSON(props: StandardComponentData) {
//         if (!isStandardReferencePayloadData(props)) {
//             throw new Error('Invalid StandardReferenceData passed to StandardReferencePayload')
//         }
//         if (typeof props === 'string') {
//             const [upcaseTag] = props.split('#')
//             this.tag = `${upcaseTag.charAt(0).toUpperCase()}${upcaseTag.slice(1).toLowerCase()}` as ComponentTag
//             return
//         }
//         this.tag = props.tag
//         this._global = props.global
//     }

//     fromSchema(node: GenericTreeNode<SchemaTag>) {
//         if (treeNodeTypeguard(isSchemaFeature)(node)) {
//             this._global = node.data.global
//         }
//         if (treeNodeTypeguard(isSchemaComponent)(node)) {
//             this.tag = node.data.tag
//             return
//         }
//         throw new Error('Schema mismatch in StandardReference constructor')
//     }

//     get global() { return this._global }

//     toJSON(): Omit<StandardComponentNonEditData, 'key' | 'universalKey'> {
//         const defaultTag = defaultComponentFromTag(this.tag, '')
//         const { key, ...rest } = defaultTag
//         if (isStandardFeature(defaultTag)) {
//             return { ...rest, global: this._global } as Omit<StandardFeatureData, 'key' | 'universalKey'>
//         }
//         return rest
//     }

//     schema(key: string, universalKey?: string): GenericTreeNode<SchemaTag> {
//         if (this.tag === 'Character') {
//             throw new Error('Character, Asset and Story references are not allowed in StandardReference')
//         }
//         if (this.tag === 'Feature') {
//             return {
//                 data: { tag: this.tag, global: this._global, key, uuid: universalKey } as SchemaFeatureTag,
//                 children: []
//             }
//         }
//         return {
//             data: { tag: this.tag, key } as SchemaTag,
//             children: []
//         }
//     }

//     merge(incoming: this): this {
//         const returnValue = new StandardReferencePayload(this)
//         if (incoming.global) {
//             returnValue._global = true
//         }
//         return returnValue as this
//     }
    
//     referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency"; }[] {
//         return []
//     }

//     mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
//         return this
//     }
// }

// export class StandardReference extends componentClassFactory(StandardReferencePayload, 'StandardReference') {

//     override get global() { return this._payload.global }

//     override clone(): StandardReference {
//         const returnValue = new StandardReference(this)
//         returnValue._payload = new StandardReferencePayload(this._payload)
//         return returnValue
//     }

//     override merge(incoming: StandardComponent): StandardComponent {
//         return new StandardReference(super.merge(incoming) as StandardReference)
//     }

//     override withKey(key: string): StandardComponent {
//         return new StandardReference(super.withKey(key) as StandardReference)
//     }
    
//     override withUniversalKey(key: string): StandardComponent {
//         return new StandardReference(super.withUniversalKey(key) as StandardReference)
//     }

//     override withFileName(key: string): StandardComponent {
//         return new StandardReference(super.withFileName(key) as StandardReference)
//     }

//     override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
//         return new StandardReference(super.withImport(importData) as StandardReference)
//     }

//     override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
//         return new StandardReference(super.withExport(exportData) as StandardReference)
//     }

// }

// 
// Computes the difference between two lists of  editable `StandardReference` objects.
// 
type DiffStandardReferenceListParams = {
    base: StandardReference[];
    incoming: StandardReference[];
    hasDiff?: (key: string) => boolean;
    parentKey?: string;
}
export const diffStandardReferenceList = ({ base, incoming, hasDiff, parentKey }: DiffStandardReferenceListParams): StandardReference[] => {
    const diffReference = (baseReference: StandardReference | undefined, incomingReference: StandardReference | undefined): StandardReference | undefined => {
        if (baseReference) {
            const payload = baseReference._payload
            const lookupKey = baseReference.global || (!parentKey) ? `${baseReference.key}` : `${parentKey}.${baseReference.key}`
            if (!incomingReference) {
                if (payload instanceof StandardReferenceRemove) {
                    return new StandardReference(payload.match)
                }
                if (payload instanceof StandardReferenceReplace) {
                    return new StandardReference(new StandardReferenceReplace(payload.payload, payload.match))
                }
                return new StandardReference(new StandardReferenceRemove(payload.payload))
            }
            const incomingPayload = incomingReference._payload
            if (baseReference.key !== incomingReference.key) {
                throw new MergeConflictError('Mismatched references in diffStandardReferenceList')
            }
            if (payload instanceof StandardReferenceSimple) {
                if (incomingPayload instanceof StandardReferenceSimple) {
                    if (hasDiff && hasDiff(lookupKey)) {
                        return baseReference
                    }
                    return undefined
                }
                throw new MergeConflictError('Mismatched references in diffStandardReferenceList')
            }
            if (payload instanceof StandardReferenceRemove) {
                if (incomingPayload instanceof StandardReferenceRemove) {
                    if (hasDiff && hasDiff(lookupKey)) {
                        const match = payload.match
                        return new StandardReference(match)
                    }
                    return undefined
                }
                throw new MergeConflictError('Mismatched references in diffStandardReferenceList')
            }
            if (payload instanceof StandardReferenceReplace) {
                if (incomingPayload instanceof StandardReferenceReplace) {
                    if (hasDiff && hasDiff(lookupKey)) {
                        return baseReference
                    }
                    return undefined
                }
                throw new MergeConflictError('Mismatched references in diffStandardReferenceList')
            }
        }
        else {
            return incomingReference
        }
    }
    const allKeys = unique([...base.map(reference => reference.key), ...incoming.map(reference => reference.key)])
    return allKeys.map(key => diffReference(base.find(reference => reference.key === key), incoming.find(reference => reference.key === key))).filter(excludeUndefined)
}

export default StandardReference
