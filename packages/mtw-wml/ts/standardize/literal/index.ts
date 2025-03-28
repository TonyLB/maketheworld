import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { StandardEditableDataDelta, standardEditableFactory, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaString } from "../../schema/baseClasses"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { treeFromWML } from "../utils"
import { isSchemaTreeNode } from "../components/utils"

//
// StandardLiteralSimpleBase holds the contents for a simple StandardLiteral
//
export class StandardLiteralSimpleBase implements StandardEditablePayload<string> {
    data: string
    get schema() {
        return [{ data: { tag: 'String' as const, value: this.data }, children: [] }]
    }
    constructor(data: string) {
        this.data = data
    }
    clone() {
        return new StandardLiteralSimpleBase(`${this.data}`)
    }
    toJSON: () => string = () => this.data
}

const payloadFactory = (props: string | GenericTree<SchemaTag>): StandardLiteralSimpleBase | undefined => {
    if (typeof props === 'string') {
        return new StandardLiteralSimpleBase(props)
    }
    if (props.length === 1 && isSchemaString(props[0].data)) {
        return new StandardLiteralSimpleBase(props[0].data.value)
    }
    throw new Error('Invalid argument in StandardLiteralSimpleBase constructor')
}

const standardLiteralAdd = (base: string, incoming: string): string => {
    const endsWithWhitespace = base.endsWith(' ')
    return endsWithWhitespace
        ? `${base.trimEnd()} ${incoming.trimStart()}`
        : `${base}${incoming}`
}

const standardLiteralSubtract = (base: string, incoming: string): { add?: string, remove?: string } => {
    if (base.endsWith(incoming)) {
        const baseFirstStringRemainder = base.slice(0, base.length - incoming.length)
        if (!baseFirstStringRemainder) {
            return { }
        }
        else {
            return { add: baseFirstStringRemainder }
        }
    }
    //
    // If the incoming string ends with the base string
    //
    else if (incoming.endsWith(base)) {
        const incomingFirstStringRemainder = incoming.slice(0, incoming.length - base.length)
        if (!incomingFirstStringRemainder) {
            return {}
        }
        else {
            return { remove: incomingFirstStringRemainder }
        }
    }
    else {
        throw new MergeConflictError('Conflict during subtract operation')
    }
}

const standardLiteralDiff = (base: string, incoming: string): { add?: string, remove?: string } => {
    const findFirstDiffPos = (a: string, b: string): number => {
        if (a === b) return -1
        let i = 0
        while (a[i] === b[i]) { i++ }
        return i
    }
    const firstDifferentIndex = findFirstDiffPos(base, incoming)
    if (firstDifferentIndex === -1) {
        const remainingTargetElements = incoming.slice(base.length)
        if (remainingTargetElements.length === 0) {
            return {}
        }
        else {
            return { add: remainingTargetElements }
        }
    }
    const remainingBaseElements = base.slice(firstDifferentIndex)
    const remainingTargetElements = incoming.slice(firstDifferentIndex)
    if (remainingTargetElements.length === 0) {
        return { remove: remainingBaseElements }
    }
    else {
        return { add: remainingTargetElements, remove: remainingBaseElements }
    }
}

export const { constructorDelta: factory, typeguard: isStandardLiteralData, merge, diff } = standardEditableFactory({
    typeguard: (value: any): value is string => (typeof value === 'string'),
    payloadFactory: payloadFactory,
    payload: StandardLiteralSimpleBase,
    add: standardLiteralAdd,
    subtract: standardLiteralSubtract,
    diff: standardLiteralDiff
})

const fromDelta = (delta: { add?: string, remove?: string }): StandardLiteralSimple | StandardLiteralRemove | StandardLiteralReplace | undefined => {
    const { add, remove } = delta
    if (add) {
        if (remove) {
            return new StandardLiteralReplace(new StandardLiteralSimpleBase(remove), new StandardLiteralSimpleBase(add))
        }
        return new StandardLiteralSimple(new StandardLiteralSimpleBase(add))
    }
    if (remove) {
        return new StandardLiteralRemove(new StandardLiteralSimpleBase(remove))
    }
    return undefined
}

export class StandardLiteralSimple implements StandardEditableWrapper<StandardLiteralSimpleBase> {
    payload: StandardLiteralSimpleBase
    constructor(data: StandardLiteralSimpleBase | StandardEditableData<string> | GenericTree<SchemaTag> | string) {
        if (data instanceof StandardLiteralSimpleBase) {
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
    get _delta(): StandardEditableDataDelta<string> {
        return { add: this.payload.toJSON() }
    }
    clone() {
        return new StandardLiteralSimple(this.payload)
    }
    toJSON: () => StandardEditableData<string> = () => this.payload.toJSON()
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardLiteralSimpleBase>): StandardLiteralSimple | StandardLiteralRemove | StandardLiteralReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardLiteralSimpleBase>): StandardLiteralSimple | StandardLiteralRemove | StandardLiteralReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardLiteralRemove implements StandardEditableWrapper<StandardLiteralSimpleBase> {
    match: StandardLiteralSimpleBase
    constructor(data: StandardLiteralSimpleBase | StandardEditableData<string> | GenericTree<SchemaTag> | string) {
        if (data instanceof StandardLiteralSimpleBase) {
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
    get _delta(): StandardEditableDataDelta<string> {
        return { remove: this.match.toJSON() }
    }
    clone() {
        return new StandardLiteralRemove(this.match)
    }
    toJSON: () => StandardEditableData<string> = () => ({ tag: 'Remove' as const, match: this.match.toJSON() })
    get plain() { return this.match }
    merge(other: StandardEditableWrapper<StandardLiteralSimpleBase>): StandardLiteralSimple | StandardLiteralRemove | StandardLiteralReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardLiteralSimpleBase>): StandardLiteralSimple | StandardLiteralRemove | StandardLiteralReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardLiteralReplace implements StandardEditableWrapper<StandardLiteralSimpleBase> {
    match: StandardLiteralSimpleBase
    payload: StandardLiteralSimpleBase
    constructor(...args: [StandardEditableData<string> | GenericTree<SchemaTag> | string] | [StandardLiteralSimpleBase, StandardLiteralSimpleBase]) {
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
    get _delta(): StandardEditableDataDelta<string> {
        return { remove: this.match.toJSON(), add: this.payload.toJSON() }
    }
    clone() {
        return new StandardLiteralReplace(this.match, this.payload)
    }
    toJSON: () => StandardEditableData<string> = () => ({ 
        tag: 'Replace' as const,
        match: this.match.toJSON(),
        payload: this.payload.toJSON()
    })
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardLiteralSimpleBase>): StandardLiteralSimple | StandardLiteralRemove | StandardLiteralReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardLiteralSimpleBase>): StandardLiteralSimple | StandardLiteralRemove | StandardLiteralReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardLiteral {
    _payload: StandardLiteralSimple | StandardLiteralRemove | StandardLiteralReplace;
    
    constructor(arg: any) {
        if (arg instanceof StandardLiteralSimple || arg instanceof StandardLiteralRemove || arg instanceof StandardLiteralReplace) {
            this._payload = arg
            return
        }
        const delta = factory(arg)
        if (!delta) {
            throw new Error('Invalid argument to StandardLiteral constructor')
        }
        if (delta.add) {
            if (delta.remove) {
                this._payload = new StandardLiteralReplace(arg)
                return
            }
            this._payload = new StandardLiteralSimple(arg)
            return
        }
        if (delta.remove) {
            this._payload = new StandardLiteralRemove(arg)
            return
        }
        throw new Error('Invalid argument to StandardLiteral constructor')
    }

    get schema(): GenericTree<SchemaTag> {
        return this._payload.schema
    }

    nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        return this._payload.nestedSchema(tag)
    }

    toJSON(): StandardEditableData<string> {
        return this._payload.toJSON()
    }

    merge(incoming: StandardLiteral): StandardLiteral | undefined {
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            return new StandardLiteral(this._payload.merge(incoming._payload))
        }
        return undefined
    }
    diff(incoming: StandardLiteral | undefined): StandardLiteral | undefined {
        if (incoming) {
            const diff = this._payload.diff(incoming._payload)
            if (diff) {
                return new StandardLiteral(diff)
            }
            return undefined
        }
        else {
            const reversedDelta = this._payload._delta
            if (reversedDelta) {
                if (reversedDelta.add) {
                    return new StandardLiteral(new StandardLiteralRemove(new StandardLiteralSimpleBase(reversedDelta.add)))
                }
                if (reversedDelta.remove) {
                    return new StandardLiteral(new StandardLiteralSimple(reversedDelta.remove))
                }
            }
            return undefined
        }
    }
    mapContents(callback: (incoming: string) => string): StandardLiteral {
        if (this._payload instanceof StandardLiteralSimple) {
            return new StandardLiteral(callback(this._payload.payload.data))
        }
        if (this._payload instanceof StandardLiteralRemove) {
            return new StandardLiteral(new StandardLiteralRemove(new StandardLiteralSimpleBase(callback(this._payload.match.data))))
        }
        if (this._payload instanceof StandardLiteralReplace) {
            return new StandardLiteral(new StandardLiteralReplace((new StandardLiteralSimple(callback(this._payload.match.data))).payload, (new StandardLiteralSimple(callback(this._payload.payload.data))).payload))
        }
        throw new Error('Invalid StandardLiteral payload')
    }

}