import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { StandardEditableDataDelta, standardEditableFactory, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable"
import { isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { StandardReferenceData } from "../components/dataTypes/reference"
import { isStandardReferenceData, StandardKey } from "../components/reference"
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components"
import { isStandardLiteralData, StandardLiteral } from "../literal"
import { deepEqual } from "../../lib/objects"
import { excludeUndefined, zipperList } from "../../lib/lists"
import { ReferenceFormat } from "./utils/references"

export type StandardExitData = {
    to: StandardReferenceData;
    description?: StandardEditableData<string>;
}

const isSimpleExitData = (value: any): value is StandardExitData => {
    return (typeof value === 'object' && value !== null && 'to' in value && isStandardReferenceData(value.to) && (!value.description || isStandardLiteralData(value.description)))
}

//
// StandardExitBase holds the contents for a simple StandardExit
//
export class StandardExitBase implements StandardEditablePayload<StandardExitData> {
    to: StandardKey;
    description?: StandardLiteral;
    get schema() {
        return [{ data: { tag: 'Exit' as const, to: this.to.key ?? this.to.universalKey ?? '' }, children: this.description?.schema ?? [] }]
    }
    constructor(data: StandardExitData) {
        this.to = new StandardKey(data.to)
        if (data.description) {
            this.description = new StandardLiteral(data.description)
        }
    }
    clone() {
        return new StandardExitBase(this.toJSON())
    }
    toJSON: () => StandardExitData = () => ({
        to: this.to.toJSON(),
        description: this.description ? this.description.toJSON() : undefined
    })

    remapReferences(props: { mapTo: ReferenceFormat, mappings: StandardKey[] }): StandardExitBase {
        const returnValue = this.clone()
        const mapReference = props.mappings.find((mapping) => (mapping.equals(this.to))) ?? this.to
        returnValue.to = mapReference.toFormat(props.mapTo)
        return returnValue
    }
}

const payloadFactory = (props: GenericTree<SchemaTag> | StandardExitData): StandardExitBase | undefined => {
    if (isSimpleExitData(props)) {
        return new StandardExitBase(props)
    }
    if (props.length === 1 && isSchemaExit(props[0].data)) {
        const to = props[0].data.to
        return new StandardExitBase({
            to: isSchemaComponentUUID(to)
                ? to
                : { tag: 'Room', key: to },
            description: props[0].children.length > 0 && isSchemaString(props[0].children[0].data) ? new StandardLiteral([props[0].children[0]]).toJSON() : undefined
        })
    }
    throw new Error('Invalid argument in StandardExitBase constructor')
}

const standardExitAdd = (base: StandardExitData, incoming: StandardExitData): StandardExitData => {
    if (!deepEqual(base.to, incoming.to)) {
        throw new MergeConflictError('Cannot add exit with different target')
    }
    const mergedDescription = base.description && incoming.description ? new StandardLiteral(base.description).merge(new StandardLiteral(incoming.description))?.toJSON() : base.description ?? incoming.description
    return { to: base.to, description: mergedDescription }
}

const standardExitSubtract = (base: StandardExitData, incoming: StandardExitData): { add?: StandardExitData, remove?: StandardExitData } => {
    if (!deepEqual(base.to, incoming.to)) {
        throw new MergeConflictError('Cannot subtract exit with different target')
    }
    if (deepEqual(base.description ?? '', incoming.description ?? '')) {
        return {}
    }
    return { add: base, remove: base }
}

const standardExitDiff = (base: StandardExitData, incoming: StandardExitData): { add?: StandardExitData, remove?: StandardExitData } => {
    if (!deepEqual(base.to, incoming.to)) {
        throw new MergeConflictError('Cannot subtract exit with different target')
    }
    if (deepEqual(base.description ?? '', incoming.description ?? '')) {
        return {}
    }
    return { add: incoming, remove: base }
}

export const { constructorDelta: factory, typeguard: isStandardExitData, merge, diff } = standardEditableFactory({
    typeguard: isSimpleExitData,
    payloadFactory: payloadFactory,
    payload: StandardExitBase,
    add: standardExitAdd,
    subtract: standardExitSubtract,
    diff: standardExitDiff
})

const fromDelta = (delta: { add?: StandardExitData, remove?: StandardExitData }): StandardExitSimple | StandardExitRemove | StandardExitReplace | undefined => {
    const { add, remove } = delta
    if (add) {
        if (remove) {
            return new StandardExitReplace(new StandardExitBase(remove), new StandardExitBase(add))
        }
        return new StandardExitSimple(new StandardExitBase(add))
    }
    if (remove) {
        return new StandardExitRemove(new StandardExitBase(remove))
    }
    return undefined
}

export class StandardExitSimple implements StandardEditableWrapper<StandardExitBase> {
    payload: StandardExitBase
    constructor(data: StandardExitBase | StandardEditableData<StandardExitData> | GenericTree<SchemaTag> | string) {
        if (data instanceof StandardExitBase) {
            this.payload = data
            return
        }
        const delta = factory(data)
        if (delta && delta.add && !delta.remove) {
            this.payload = delta.add
            return
        }
        throw new Error('Invalid data in TestContentClass')
    }
    get schema() {
        return this.payload.schema
    }
    nestedSchema(tag) {
        return [{ data: tag, children: this.schema }]
    }
    get _delta(): StandardEditableDataDelta<StandardExitData> {
        return { add: this.payload.toJSON() }
    }
    clone() {
        return new StandardExitSimple(this.payload)
    }
    toJSON: () => StandardEditableData<StandardExitData> = () => this.payload.toJSON()
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardExitBase>): StandardExitSimple | StandardExitRemove | StandardExitReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExitBase>): StandardExitSimple | StandardExitRemove | StandardExitReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    remapReferences(props: { mapTo: ReferenceFormat, mappings: StandardKey[] }): StandardExitSimple {
        const returnValue = this.clone()
        returnValue.payload = returnValue.payload.remapReferences(props)
        return returnValue
    }
}

export class StandardExitRemove implements StandardEditableWrapper<StandardExitBase> {
    match: StandardExitBase
    constructor(data: StandardExitBase | StandardEditableData<StandardExitData> | GenericTree<SchemaTag>) {
        if (data instanceof StandardExitBase) {
            this.match = data
            return
        }
        const delta = factory(data)
        if (delta && !delta.add && delta.remove) {
            this.match = delta.remove
            return
        }
        console.log(`Invalid data: ${JSON.stringify(data)}`)
        throw new Error('Invalid data in TestRemoveClass')
    }
    get schema() {
        return [{ data: { tag: 'Remove' as const }, children: this.match.schema }]
    }
    nestedSchema(tag) {
        return [{
            data: { tag: 'Remove' as const },
            children: [{ data: tag, children: this.match.schema }]
        }]
    }
    get _delta(): StandardEditableDataDelta<StandardExitData> {
        return { remove: this.match.toJSON() }
    }
    clone() {
        return new StandardExitRemove(this.match)
    }
    toJSON: () => StandardEditableData<StandardExitData> = () => ({ tag: 'Remove' as const, match: this.match.toJSON() })
    get plain() { return this.match }
    merge(other: StandardEditableWrapper<StandardExitBase>): StandardExitSimple | StandardExitRemove | StandardExitReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExitBase>): StandardExitSimple | StandardExitRemove | StandardExitReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    remapReferences(props: { mapTo: ReferenceFormat, mappings: StandardKey[] }): StandardExitRemove {
        const returnValue = this.clone()
        returnValue.match = returnValue.match.remapReferences(props)
        return returnValue
    }
}

export class StandardExitReplace implements StandardEditableWrapper<StandardExitBase> {
    match: StandardExitBase
    payload: StandardExitBase
    constructor(...args: [StandardEditableData<StandardExitData> | GenericTree<SchemaTag>] | [StandardExitBase, StandardExitBase]) {
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
        throw new Error('Invalid data in TestRemoveClass')
    }
    get schema() {
        return [{ data: { tag: 'Replace' as const }, children: [
            { data: { tag: 'ReplaceMatch' as const }, children: this.match.schema },
            { data: { tag: 'ReplacePayload' as const }, children: this.payload.schema }
        ] }]
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
    get _delta(): StandardEditableDataDelta<StandardExitData> {
        return { remove: this.match.toJSON(), add: this.payload.toJSON() }
    }
    clone() {
        return new StandardExitReplace(this.match, this.payload)
    }
    toJSON: () => StandardEditableData<StandardExitData> = () => ({
        tag: 'Replace' as const,
        match: this.match.toJSON(),
        payload: this.payload.toJSON()
    })
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardExitBase>): StandardExitSimple | StandardExitRemove | StandardExitReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExitBase>): StandardExitSimple | StandardExitRemove | StandardExitReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    remapReferences(props: { mapTo: ReferenceFormat, mappings: StandardKey[] }): StandardExitReplace {
        const returnValue = this.clone()
        returnValue.match = returnValue.match.remapReferences(props)
        returnValue.payload = returnValue.payload.remapReferences(props)
        return returnValue
    }
}

export class StandardExit {
    _payload: StandardExitSimple | StandardExitRemove | StandardExitReplace;

    constructor(arg: any) {
        if (arg instanceof StandardExitSimple || arg instanceof StandardExitRemove || arg instanceof StandardExitReplace) {
            this._payload = arg
            return
        }
        const delta = factory(arg)
        if (!delta) {
            console.log(`Invalid argument to StandardExit constructor: ${JSON.stringify(arg, null, 4)}`)
            throw new Error('Invalid argument to StandardExit constructor')
        }
        if (delta.add) {
            if (delta.remove) {
                this._payload = new StandardExitReplace(arg)
                return
            }
            this._payload = new StandardExitSimple(arg)
            return
        }
        if (delta.remove) {
            this._payload = new StandardExitRemove(arg)
            return
        }
        throw new Error('Invalid argument to StandardExit constructor')
    }

    get schema(): GenericTree<SchemaTag> {
        return this._payload.schema
    }

    nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        return this._payload.nestedSchema(tag)
    }

    toJSON(): StandardEditableData<StandardExitData> {
        return this._payload.toJSON()
    }

    merge(incoming: StandardExit): StandardExit | undefined {
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            return new StandardExit(merged)
        }
        return undefined
    }
    diff(incoming: StandardExit | undefined): StandardExit | undefined {
        if (incoming) {
            const diff = this._payload.diff(incoming._payload)
            if (diff) {
                return new StandardExit(diff)
            }
            return undefined
        }
        else {
            const reversedDelta = this._payload._delta
            if (reversedDelta) {
                if (reversedDelta.add) {
                    return new StandardExit(new StandardExitRemove(new StandardExitBase(reversedDelta.add)))
                }
                if (reversedDelta.remove) {
                    return new StandardExit(new StandardExitSimple(reversedDelta.remove))
                }
            }
            return undefined
        }
    }
    mapContents(callback: (incoming: StandardExitData) => StandardExitData): StandardExit {
        if (this._payload instanceof StandardExitSimple) {
            return new StandardExit(callback(this._payload.payload.toJSON()))
        }
        if (this._payload instanceof StandardExitRemove) {
            return new StandardExit(new StandardExitRemove(new StandardExitBase(callback(this._payload.match.toJSON()))))
        }
        if (this._payload instanceof StandardExitReplace) {
            return new StandardExit(new StandardExitReplace((new StandardExitSimple(callback(this._payload.match.toJSON()))).payload, (new StandardExitSimple(callback(this._payload.payload.toJSON()))).payload))
        }
        throw new Error('Invalid StandardExit payload')
    }
    remapReferences(props: { mapTo: ReferenceFormat, mappings: StandardKey[] }): StandardExit {
        const remappedPayload = this._payload.remapReferences(props)
        return new StandardExit(remappedPayload)
    }

}

export const mergeStandardExitList = (list: StandardExit[]): StandardExit[] => {
    return list.reduce<StandardExit[]>((previous, current) => {
        const findMatchIndex = previous.findIndex((item) => (item._payload.plain.to.equals(current._payload.plain.to)))
        if (findMatchIndex === -1) {
            return [...previous, current]
        }
        return previous.map((item, index) => {
            if (index === findMatchIndex) {
                return item.merge(current)
            }
            return item
        }, []).filter(excludeUndefined)
    }, [])
}

export const diffStandardExitList = (base: StandardExit[], incoming: StandardExit[]): StandardExit[] => {
    const zipper = zipperList<StandardExit>((a, b) => (a._payload.plain.to.equals(b._payload.plain.to)))(base, incoming)
    return zipper.reduce<StandardExit[]>((previous, { base: baseItem, incoming: incomingItem }) => {
        if (baseItem && incomingItem) {
            const diff = baseItem.diff(incomingItem)
            if (diff) {
                return [...previous, diff]
            }
        }
        else if (baseItem) {
            const remove = new StandardExit(new StandardExitRemove(baseItem._payload.plain))
            return [...previous, remove]
        }
        else if (incomingItem) {
            const add = new StandardExit(new StandardExitSimple(incomingItem._payload.plain))
            return [...previous, add]
        }
        return previous
    }, [])
}
