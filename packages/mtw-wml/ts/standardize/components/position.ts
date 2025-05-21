import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { isSchemaComponent, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { deepEqual } from "../../lib/objects";
import { StandardEditableDataDelta, standardEditableFactory, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { isStandardPositionData, StandardPositionData } from "./dataTypes/position";
import { isSchemaPosition, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components";
import StandardReference, { standardReferenceDeserialize, standardReferenceSerialize, StandardReferenceSimple } from "./reference";

export class StandardPositionSimpleBase implements StandardEditablePayload<StandardPositionData> {
    room: StandardReferenceSimple;
    x: number;
    y: number;
    constructor(data: StandardPositionData) {
        this.room = new StandardReferenceSimple(data.room)
        this.x = data.x;
        this.y = data.y;
    }
    get schema() {
        const roomSchema = this.room.schema
        return roomSchema.map(node => {
            if (treeNodeTypeguard(isSchemaRoom)(node)) {
                return {
                    ...node,
                    children: [{
                        data: { tag: 'Position' as const, x: this.x, y: this.y },
                        children: []
                    }]
                }
            }
            throw new Error('Invalid schema in StandardPositionSimpleBase')
        })
    }
    clone() {
        return new StandardPositionSimpleBase(this.toJSON())
    }
    toJSON: () => StandardPositionData = () => {
        return {
            room: this.room.plain.toJSON(),
            x: this.x,
            y: this.y
        }
    }
    withKey(key: string): StandardPositionSimpleBase {
        const returnValue = this.clone()
        returnValue.room = returnValue.room.withKey(key)
        return returnValue
    }
}

const payloadFactory = (props: StandardPositionData | GenericTree<SchemaTag>): StandardPositionSimpleBase | undefined => {
    if (isStandardPositionData(props)) {
        return new StandardPositionSimpleBase(props)
    }
    if (props.length === 1) {
        const node = props[0]
        if (!(treeNodeTypeguard(isSchemaComponent)(node) && treeNodeTypeguard(isSchemaRoom)(node))) {
            throw new Error('Invalid argument in StandardPositionSimpleBase constructor')
        }
        const { tag, key, uuid } = node.data
        const position = node.children.find(treeNodeTypeguard(isSchemaPosition))
        if (!position) {
            throw new Error('Invalid argument in StandardPositionSimpleBase constructor')
        }
        return new StandardPositionSimpleBase({
            room: { tag, key, universalKey: uuid },
            x: position.data.x,
            y: position.data.y
        })
    }
    throw new Error('Invalid argument in StandardReferenceSimpleBase constructor')
}

const standardPositionDeserialize = (incoming: StandardPositionData): StandardPositionData => {
    return {
        ...incoming,
        room: standardReferenceDeserialize(incoming.room)
    }
}

const standardPositionSerialize = (incoming: StandardPositionData): StandardPositionData => {
    return {
        ...incoming,
        room: standardReferenceSerialize(incoming.room)
    }
}

const standardPositionAdd = (base: StandardPositionData, incoming: StandardPositionData): StandardPositionData => {
    return incoming
}

const standardPositionSubtract = (base: StandardPositionData, incoming: StandardPositionData): { add?: StandardPositionData, remove?: StandardPositionData } => {
    if (deepEqual(standardPositionDeserialize(base), standardPositionDeserialize(incoming))) {
        return { add: undefined, remove: undefined }
    }
    else {
        throw new MergeConflictError('Conflict during subtract operation')
    }
}

const standardPositionDiff = (base: StandardPositionData, incoming: StandardPositionData): { add?: StandardPositionData, remove?: StandardPositionData } => {
    if (deepEqual(standardPositionDeserialize(base), standardPositionDeserialize(incoming))) {
        return { add: undefined, remove: undefined }
    }
    else {
        return { add: standardPositionSerialize(incoming), remove: standardPositionSerialize(base) }
    }
}

export const { constructorDelta: factory, typeguard: isStandardReferenceData, merge, diff } = standardEditableFactory({
    typeguard: isStandardPositionData,
    payloadFactory: payloadFactory,
    payload: StandardPositionSimpleBase,
    add: standardPositionAdd,
    subtract: standardPositionSubtract,
    diff: standardPositionDiff
})

const fromDelta = (delta: { add?: StandardPositionData, remove?: StandardPositionData }): StandardPositionSimple | StandardPositionRemove | StandardPositionReplace | undefined => {
    const { add, remove } = delta
    if (add) {
        if (remove) {
            return new StandardPositionReplace(new StandardPositionSimpleBase(remove), new StandardPositionSimpleBase(add))
        }
        return new StandardPositionSimple(new StandardPositionSimpleBase(add))
    }
    if (remove) {
        return new StandardPositionRemove(new StandardPositionSimpleBase(remove))
    }
    return undefined
}

export class StandardPositionSimple implements StandardEditableWrapper<StandardPositionSimpleBase> {
    payload: StandardPositionSimpleBase
    constructor(data: StandardPositionSimpleBase | StandardEditableData<StandardPositionData> | GenericTree<SchemaTag> | string) {
        if (data instanceof StandardPositionSimpleBase) {
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
    get room() {
        return this.payload.room
    }
    get x() {
        return this.payload.x
    }
    get y() {
        return this.payload.y
    }
    get schema() {
        return this.payload.schema
    }
    nestedSchema(tag) {
        return [{ data: tag, children: this.schema }]
    }
    get _delta(): StandardEditableDataDelta<StandardPositionData> {
        return { add: this.payload.toJSON() }
    }
    clone() {
        return new StandardPositionSimple(this.payload)
    }
    toJSON: () => StandardEditableData<StandardPositionData> = () => this.payload.toJSON()
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardPositionSimpleBase>): StandardPositionSimple | StandardPositionRemove | StandardPositionReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardPositionSimpleBase>): StandardPositionSimple | StandardPositionRemove | StandardPositionReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    withKey(key: string): StandardPositionSimple {
        const returnValue = this.clone()
        returnValue.payload = this.payload.withKey(key)
        return returnValue
    }
}

export class StandardPositionRemove implements StandardEditableWrapper<StandardPositionSimpleBase> {
    match: StandardPositionSimpleBase
    constructor(data: StandardPositionSimpleBase | StandardEditableData<StandardPositionData> | GenericTree<SchemaTag> | string) {
        if (data instanceof StandardPositionSimpleBase) {
            this.match = data
            return
        }
        const delta = factory(data)
        if (delta && !delta.add && delta.remove) {
            this.match = delta.remove
            return
        }
        console.log(`Invalid data: ${JSON.stringify(data)}`)
        throw new Error('Invalid data in StandardPositionRemove')
    }
    get schema() {
        return [{ data: { tag: 'Remove' as const }, children: this.match.schema }]
    }
    get room() {
        return this.match.room
    }
    get x() {
        return this.match.x
    }
    get y() {
        return this.match.y
    }
    nestedSchema(tag) {
        return [{
            data: { tag: 'Remove' as const },
            children: [{ data: tag, children: this.match.schema }]
        }]
    }
    get _delta(): StandardEditableDataDelta<StandardPositionData> {
        return { remove: this.match.toJSON() }
    }
    clone() {
        return new StandardPositionRemove(this.match)
    }
    toJSON: () => StandardEditableData<StandardPositionData> = () => ({ tag: 'Remove' as const, match: this.match.toJSON() })
    get plain() { return this.match }
    merge(other: StandardEditableWrapper<StandardPositionSimpleBase>): StandardPositionSimple | StandardPositionRemove | StandardPositionReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardPositionSimpleBase>): StandardPositionSimple | StandardPositionRemove | StandardPositionReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    withKey(key: string): StandardPositionRemove {
        const returnValue = this.clone()
        returnValue.match = this.match.withKey(key)
        return returnValue
    }
}

export class StandardPositionReplace implements StandardEditableWrapper<StandardPositionSimpleBase> {
    match: StandardPositionSimpleBase
    payload: StandardPositionSimpleBase
    constructor(...args: [StandardEditableData<StandardPositionData> | GenericTree<SchemaTag> | string] | [StandardPositionSimpleBase, StandardPositionSimpleBase]) {
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
        throw new Error('Invalid data in StandardPositionReplace')
    }
    get schema() {
        return [{ data: { tag: 'Replace' as const }, children: [
            { data: { tag: 'ReplaceMatch' as const }, children: this.match.schema },
            { data: { tag: 'ReplacePayload' as const }, children: this.payload.schema }
        ] }]
    }
    get room() {
        return this.payload.room
    }
    get x() {
        return this.payload.x
    }
    get y() {
        return this.payload.y
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
    get _delta(): StandardEditableDataDelta<StandardPositionData> {
        return { remove: this.match.toJSON(), add: this.payload.toJSON() }
    }
    clone() {
        return new StandardPositionReplace(this.match, this.payload)
    }
    toJSON: () => StandardEditableData<StandardPositionData> = () => ({ 
        tag: 'Replace' as const,
        match: this.match.toJSON(),
        payload: this.payload.toJSON()
    })
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardPositionSimpleBase>): StandardPositionSimple | StandardPositionRemove | StandardPositionReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardPositionSimpleBase>): StandardPositionSimple | StandardPositionRemove | StandardPositionReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    withKey(key: string): StandardPositionReplace {
        const returnValue = this.clone()
        returnValue.match = this.match.withKey(key)
        returnValue.payload = this.payload.withKey(key)
        return returnValue
    }
}

export class StandardPosition {
    _payload: StandardPositionSimple | StandardPositionRemove | StandardPositionReplace;

    constructor(arg: any) {
        if (arg instanceof StandardPositionSimple || arg instanceof StandardPositionRemove || arg instanceof StandardPositionReplace) {
            this._payload = arg
            return
        }
        const delta = factory(arg)
        if (!delta) {
            throw new Error('Invalid argument to StandardPosition constructor')
        }
        if (delta.add) {
            if (delta.remove) {
                this._payload = new StandardPositionReplace(arg)
                return
            }
            this._payload = new StandardPositionSimple(arg)
            return
        }
        if (delta.remove) {
            this._payload = new StandardPositionRemove(arg)
            return
        }
        throw new Error('Invalid argument to StandardPosition constructor')
    }

    get schema(): GenericTree<SchemaTag> {
        return this._payload.schema
    }
    get room(): StandardReference {
        return new StandardReference(this._payload.room)
    }
    get x(): number {
        return this._payload.x
    }
    get y(): number {
        return this._payload.y
    }

    clone(): StandardPosition {
        return new StandardPosition(this._payload.clone())
    }

    nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        return this._payload.nestedSchema(tag)
    }

    toJSON(): StandardEditableData<StandardPositionData> {
        return this._payload.toJSON()
    }

    merge(incoming: StandardPosition): StandardPosition | undefined {
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            return new StandardPosition(merged)
        }
        return undefined
    }
    diff(incoming: StandardPosition | undefined): StandardPosition | undefined {
        if (incoming) {
            const diff = this._payload.diff(incoming._payload)
            if (diff) {
                return new StandardPosition(diff)
            }
            return undefined
        }
        else {
            const reversedDelta = this._payload._delta
            if (reversedDelta) {
                if (reversedDelta.add) {
                    return new StandardPosition(new StandardPositionRemove(new StandardPositionSimpleBase(reversedDelta.add)))
                }
                if (reversedDelta.remove) {
                    return new StandardPosition(new StandardPositionSimple(reversedDelta.remove))
                }
            }
            return undefined
        }
    }
    mapContents(callback: (incoming: StandardPositionData) => StandardPositionData): StandardPosition {
        if (this._payload instanceof StandardPositionSimple) {
            return new StandardPosition(callback(this._payload.payload.toJSON()))
        }
        if (this._payload instanceof StandardPositionRemove) {
            return new StandardPosition(new StandardPositionRemove(new StandardPositionSimpleBase(callback(this._payload.match.toJSON()))))
        }
        if (this._payload instanceof StandardPositionReplace) {
            return new StandardPosition(new StandardPositionReplace((new StandardPositionSimple(callback(this._payload.match.toJSON()))).payload, (new StandardPositionSimple(callback(this._payload.payload.toJSON()))).payload))
        }
        throw new Error('Invalid StandardPosition payload')
    }

    withKey(key: string): StandardPosition {
        const returnValue = this.clone()
        returnValue._payload = this._payload.withKey(key)
        return returnValue
    }

}

// Computes the difference between two lists of  editable `StandardPosition` objects.
type DiffStandardPositionListParams = {
    base: StandardPosition[];
    incoming: StandardPosition[];
    hasDiff?: (key: string) => boolean;
    parentKey?: string;
}

export const diffStandardPositionList = ({ base, incoming }: DiffStandardPositionListParams): StandardPosition[] => {
    // Helper to compare two StandardPosition objects for being on the same room
    const isEqual = (a: StandardPosition, b: StandardPosition) => {
        return a.x === b.x &&
            a.y === b.y &&
            a.room.equal(b.room)
    }

    // Find removes: in base but not in incoming
    const removes = base
        .filter(basePos => !incoming.some(incomingPos => isEqual(basePos, incomingPos)))
        .map(basePos => new StandardPosition({
            tag: 'Remove',
            match: basePos.toJSON()
        }))

    // Find adds: in incoming but not in base
    const adds = incoming
        .filter(incomingPos => !base.some(basePos => isEqual(basePos, incomingPos)))

    return [...removes, ...adds]
}

export const mergeStandardPositionList = (base: StandardPosition[], incoming: StandardPosition[]): StandardPosition[] => {
    return incoming.reduce((acc, incomingPos) => {
        const index = acc.findIndex(basePos => basePos.room.equal(incomingPos.room))
        if (index !== -1) {
            const merged = acc[index].merge(incomingPos) || acc[index]
            return [
                ...acc.slice(0, index),
                merged,
                ...acc.slice(index + 1)
            ]
        } else {
            return [...acc, incomingPos]
        }
    }, [...base])
}

export default StandardPosition
