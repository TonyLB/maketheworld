import StandardRenderString from "./string"
import StandardRenderLineBreak from "./lineBreak"
import StandardRenderLink from "./link"
import StandardRenderSpace from "./space"
import { excludeUndefined } from "../../lib/lists"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { deepEqual } from "../../lib/objects"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit"
import { isRenderTreeNode, isSimpleRenderTree, RenderTree, RenderTreeNode, renderTreeToSchema, renderTreeToString, schemaToRenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardEditableDataDelta, standardEditableFactory, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import StandardReference from "../components/reference"
import { ReferenceFormat } from "../components/utils/references"
import { isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"

export type StandardRenderSimpleElement = StandardRenderString | StandardRenderLineBreak | StandardRenderLink | StandardRenderSpace

const renderTreeToSimpleElements = (data: RenderTree): StandardRenderSimpleElement[] => {
    return data.map((element) => {
        if (typeof element === 'string' || isSchemaString(element.data)) {
            return new StandardRenderString(element)
        }
        if (isSchemaLineBreak(element.data)) {
            return new StandardRenderLineBreak(element)
        }
        if (isSchemaSpacer(element.data)) {
            return new StandardRenderSpace(element)
        }
        if (isSchemaLink(element.data)) {
            return new StandardRenderLink(element)
        }
        throw new Error(`Unknown render tree element: ${JSON.stringify(element)}`)
    })
}

export enum StandardRenderSimpleCompareDirection {
    Forward = 'forward',
    Back = 'back'
}

export class StandardRenderSimpleBase implements StandardEditablePayload<RenderTree> {
    data: RenderTree
    get schema() {
        return renderTreeToSchema(this.data)
    }
    constructor(data: RenderTree) {
        const firstElement = data.length > 0 ? data[0] : undefined
        const afterCheckingForLeadingSpace = firstElement && typeof firstElement === 'string' && firstElement.startsWith(' ')
            ? [
                { data: { tag: 'Space' as const }, children: [] },
                ...(firstElement.length > 1 ? [firstElement.slice(1)] : []),
                ...data.slice(1)
            ]
            : data
        const lastElement = afterCheckingForLeadingSpace.length > 0 ? afterCheckingForLeadingSpace[afterCheckingForLeadingSpace.length - 1] : undefined
        const afterCheckingForTrailingSpace = lastElement && typeof lastElement === 'string' && lastElement.endsWith(' ')
            ? [
                ...afterCheckingForLeadingSpace.slice(0, -1),
                ...(lastElement.length > 1 ? [lastElement.slice(0, -1)] : []),
                { data: { tag: 'Space' as const }, children: [] }
            ]
            : afterCheckingForLeadingSpace
        this.data = afterCheckingForTrailingSpace
    }
    clone() {
        return new StandardRenderSimpleBase(JSON.parse(JSON.stringify(this.data)))
    }
    toJSON: () => RenderTree = () => this.data
    remapReferences: (props: { mapping: StandardReference[], mapTo: ReferenceFormat }) => StandardRenderSimpleBase = (props) => {
        const simpleElements = renderTreeToSimpleElements(this.data)
        const remappedElements = simpleElements.map((element) => (element.remapReferences(props)))
        return new StandardRenderSimpleBase(remappedElements.map((element) => element.toJSON()))
    }
}

const payloadFactory = (props: RenderTree | GenericTree<SchemaTag>): StandardRenderSimpleBase | undefined => {
    return new StandardRenderSimpleBase(schemaToRenderTree(props))
}

const standardRenderAdd = (base: RenderTree, incoming: RenderTree): RenderTree => {
    return [...base, ...incoming].map((element) => ((typeof element === 'object' && element.data.tag === 'String') ? element.data.value : element)).reduce<RenderTree>((previous, renderElement) => {
        if (previous.length === 0) {
            return [renderElement]
        }
        else {
            const lastElement = previous[previous.length - 1]
            
            //
            // Handle joining into a string lastElement
            //
            if (typeof lastElement === 'string') {
                if (typeof renderElement === 'string') {
                    const endsWithWhitespace = lastElement.endsWith(' ')
                    return [
                        ...previous.slice(0, -1),
                        endsWithWhitespace
                            ? `${lastElement.trimEnd()} ${renderElement.trimStart()}`
                            : `${lastElement}${renderElement}`
                    ]
                }
                if (renderElement.data.tag === 'br') {
                    return [...previous.slice(0, -1), lastElement.trimEnd(), renderElement]
                }
                if (renderElement.data.tag === 'Space') {
                    return [...previous.slice(0, -1), `${lastElement.trimEnd()} `]
                }
                return [...previous, renderElement]
            }
            if (typeof renderElement === 'string') {
                if (lastElement.data.tag === 'br') {
                    return [...previous.slice(0, -1), lastElement, renderElement.trimStart()]
                }
                if (lastElement.data.tag === 'Space') {
                    return [...previous.slice(0, -1), ` ${renderElement.trimStart()}`]
                }
            }
            if (typeof lastElement === 'object' && typeof renderElement === 'object') {
                if (lastElement.data.tag === 'br' && renderElement.data.tag === 'br') {
                    return previous
                }
                if (lastElement.data.tag === 'Space' && renderElement.data.tag === 'Space') {
                    return previous
                }
                if (lastElement.data.tag === 'br' && renderElement.data.tag === 'Space') {
                    return previous
                }
                if (lastElement.data.tag === 'Space' && renderElement.data.tag === 'br') {
                    return [...previous.slice(0, -1), renderElement]
                }
            }
            return [...previous, renderElement]

        }
    }, [])
}

const standardRenderSubtract = (base: RenderTree, incoming: RenderTree): { add?: RenderTree, remove?: RenderTree } => {
    if (base.length === 0) {
        if (incoming.length === 0) {
            return {}
        }
        return { remove: incoming }
    }
    if (incoming.length === 0) {
        return { add: base }
    }
    //
    // Function to compare individual elements of the render tree
    //
    const compareElements = (base: RenderTreeNode, incoming: RenderTreeNode): { outcome: 'Base Longer' | 'Incoming Longer' | 'Equal' | 'Conflict', remainder?: RenderTreeNode } => {
        if (typeof base === 'object' && base.data.tag === 'String') {
            return compareElements(base.data.value, incoming)
        }
        if (typeof incoming === 'object' && incoming.data.tag === 'String') {
            return compareElements(base, incoming.data.value)
        }
        //
        // Compare two StandardRenderString elements
        //
        if (typeof base  === 'string' && typeof incoming === 'string') {
            if (base.endsWith(incoming)) {
                const baseFirstStringRemainder = base.slice(0, base.length - incoming.length)
                if (!baseFirstStringRemainder) {
                    return { outcome: 'Equal' }
                }
                else {
                    return { outcome: 'Base Longer', remainder: baseFirstStringRemainder }
                }
            }
            //
            // If the incoming string ends with the base string
            //
            else if (incoming.endsWith(base)) {
                const incomingFirstStringRemainder = incoming.slice(0, incoming.length - base.length)
                if (!incomingFirstStringRemainder) {
                    return { outcome: 'Equal' }
                }
                else {
                    return { outcome: 'Incoming Longer', remainder: incomingFirstStringRemainder }
                }
            }
            if (base === incoming) {
                return { outcome: 'Equal' }
            }
            else {
                return { outcome: 'Conflict' }
            }
        }
        //
        // Compare a StandardRenderString with a StandardRenderSpace
        //
        else if (typeof base === 'string' && typeof incoming === 'object' && incoming.data.tag === 'Space') {
            if (base.endsWith(' ')) {
                return { outcome: 'Base Longer', remainder: base.slice(0, -1) }
            }
            else {
                return { outcome: 'Conflict' }
            }
        }
        //
        // Compare a StandardRenderSpace with a StandardRenderString
        //
        else if (typeof incoming === 'string' && typeof base === 'object' && base.data.tag === 'Space') {
            if (incoming.startsWith(' ')) {
                return { outcome: 'Incoming Longer', remainder: incoming.slice(1) }
            }
            else {
                return { outcome: 'Conflict' }
            }
        }
        //
        // Compare other types of elements
        //
        else {
            return deepEqual(base, incoming) ? { outcome: 'Equal' } : { outcome: 'Conflict' }
        }
    }

    const baseElement = base[base.length - 1]
    const incomingElement = incoming[incoming.length - 1]
    const { outcome, remainder } = compareElements(baseElement, incomingElement)
    //
    // Handle the case where the base and incoming elements are equal
    //
    if (outcome === 'Equal') {
        return standardRenderSubtract(base.slice(0, -1), incoming.slice(0, -1))
    }
    //
    // Handle the case where the base element is longer than the incoming element
    //
    else if (outcome === 'Base Longer') {
        return standardRenderSubtract(
            [...base.slice(0, -1), remainder].filter(excludeUndefined),
            incoming.slice(0, -1)
        )
    }
    //
    // Handle the case where the incoming element is longer than the base element
    //
    else if (outcome === 'Incoming Longer') {
        return standardRenderSubtract(
            base.slice(0, -1),
            [...incoming.slice(0, -1), remainder].filter(excludeUndefined)
        )
    }
    //
    // Handle the case where there is a conflict between the base and incoming elements
    //
    throw new MergeConflictError('Conflict during subtract operation')

}

const standardRenderDiff = (base: RenderTree, incoming: RenderTree): { add?: RenderTree, remove?: RenderTree } => {
    if (base.length === 0) {
        if (incoming.length === 0) {
            return {}
        }
        return { add: incoming }
    }
    if (incoming.length === 0) {
        return { remove: base }
    }
    const baseElement = base[0]
    const incomingElement = incoming[0]
    if (typeof baseElement === 'string') {
        if (typeof incomingElement === 'string') {
            const firstDifferingIndex = baseElement.split('').findIndex((char, index) => (index >= incomingElement.length || char !== incomingElement[index]))
            if (firstDifferingIndex === -1) {
                if (baseElement.length === incomingElement.length) {
                    return standardRenderDiff(base.slice(1), incoming.slice(1))
                }
                else {
                    return standardRenderDiff(base.slice(1), [incomingElement.slice(firstDifferingIndex), ...incoming.slice(1)])
                }
            }
            else {
                if (firstDifferingIndex >= incomingElement.length) {
                    return standardRenderDiff([baseElement.slice(firstDifferingIndex), ...base.slice(1)], incoming.slice(1))
                }
                else {
                    const baseRemainder = baseElement.slice(firstDifferingIndex)
                    const incomingRemainder = incomingElement.slice(firstDifferingIndex)
                    return {
                        remove: [baseRemainder, ...base.slice(1)],
                        add: [incomingRemainder, ...incoming.slice(1)]
                    }
                }
            }
        }
        if (incomingElement.data.tag === 'Space') {
            if (baseElement.startsWith(' ')) {
                return standardRenderDiff([baseElement.slice(1), ...base.slice(1)], incoming.slice(1))
            }
            else {
                return { remove: base, add: incoming }
            }
        }
    }
    else if (typeof incomingElement === 'string' && baseElement.data.tag === 'Space') {
        if (incomingElement.startsWith(' ')) {
            return standardRenderDiff(base.slice(1), [incomingElement.slice(1), ...incoming.slice(1)])
        }
        else {
            return { remove: base, add: incoming }
        }
    }
    else if (deepEqual(baseElement, incomingElement)) {
        return standardRenderDiff(base.slice(1), incoming.slice(1))
    }
    return { remove: base, add: incoming }
}

export const { constructorDelta: factory, merge, diff } = standardEditableFactory({
    typeguard: isSimpleRenderTree,
    payloadFactory: payloadFactory,
    payload: StandardRenderSimpleBase,
    add: standardRenderAdd,
    subtract: standardRenderSubtract,
    diff: standardRenderDiff
})

const fromDelta = (delta: { add?: RenderTree, remove?: RenderTree }): StandardRenderSimple | StandardRenderRemove | StandardRenderReplace | undefined => {
    const { add, remove } = delta
    if (add) {
        if (remove) {
            return new StandardRenderReplace(new StandardRenderSimpleBase(remove), new StandardRenderSimpleBase(add))
        }
        return new StandardRenderSimple(new StandardRenderSimpleBase(add))
    }
    if (remove) {
        return new StandardRenderRemove(new StandardRenderSimpleBase(remove))
    }
    return undefined
}

export class StandardRenderSimple implements StandardEditableWrapper<StandardRenderSimpleBase> {
    payload: StandardRenderSimpleBase
    constructor(data: StandardRenderSimpleBase | StandardEditableData<RenderTree> | GenericTree<SchemaTag> | string) {
        if (data instanceof StandardRenderSimpleBase) {
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
    get _delta(): StandardEditableDataDelta<RenderTree> {
        return { add: this.payload.toJSON() }
    }
    clone() {
        return new StandardRenderSimple(this.payload)
    }
    toJSON: () => RenderTree = () => this.payload.toJSON()
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardRenderSimpleBase>): StandardRenderSimple | StandardRenderRemove | StandardRenderReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardRenderSimpleBase>): StandardRenderSimple | StandardRenderRemove | StandardRenderReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    remapReferences: (props: { mapping: StandardReference[], mapTo: ReferenceFormat }) => StandardRenderSimple = (props) => {
        return new StandardRenderSimple(this.payload.remapReferences(props))
    }
}

export class StandardRenderRemove implements StandardEditableWrapper<StandardRenderSimpleBase> {
    match: StandardRenderSimpleBase
    constructor(data: StandardRenderSimpleBase | StandardEditableData<RenderTree> | GenericTree<SchemaTag> | string) {
        if (data instanceof StandardRenderSimpleBase) {
            this.match = data
            return
        }
        const delta = factory(data)
        if (delta && !delta.add && delta.remove) {
            this.match = delta.remove
            return
        }
        // console.log(`Invalid data: ${JSON.stringify(data)}`)
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
    get _delta(): StandardEditableDataDelta<RenderTree> {
        return { remove: this.match.toJSON() }
    }
    clone() {
        return new StandardRenderRemove(this.match)
    }
    toJSON: () => RenderTree = () => ([{ data: { tag: 'Remove' as const }, children: this.match.toJSON() }])
    get plain() { return this.match }
    merge(other: StandardEditableWrapper<StandardRenderSimpleBase>): StandardRenderSimple | StandardRenderRemove | StandardRenderReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardRenderSimpleBase>): StandardRenderSimple | StandardRenderRemove | StandardRenderReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    remapReferences: (props: { mapping: StandardReference[], mapTo: ReferenceFormat }) => StandardRenderRemove = (props) => {
        return new StandardRenderRemove(this.match.remapReferences(props))
    }
}

export class StandardRenderReplace implements StandardEditableWrapper<StandardRenderSimpleBase> {
    match: StandardRenderSimpleBase
    payload: StandardRenderSimpleBase
    constructor(...args: [StandardEditableData<RenderTree> | GenericTree<SchemaTag> | string] | [StandardRenderSimpleBase, StandardRenderSimpleBase]) {
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
    get _delta(): StandardEditableDataDelta<RenderTree> {
        return { remove: this.match.toJSON(), add: this.payload.toJSON() }
    }
    clone() {
        return new StandardRenderReplace(this.match, this.payload)
    }
    toJSON: () => RenderTree = () => ([{ data: { tag: 'Replace' as const }, children: [
            { data: { tag: 'ReplaceMatch' as const }, children: this.match.toJSON() },
            { data: { tag: 'ReplacePayload' as const }, children: this.payload.toJSON() }    
        ]
    }])
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardRenderSimpleBase>): StandardRenderSimple | StandardRenderRemove | StandardRenderReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardRenderSimpleBase>): StandardRenderSimple | StandardRenderRemove | StandardRenderReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
    remapReferences: (props: { mapping: StandardReference[], mapTo: ReferenceFormat }) => StandardRenderReplace = (props) => {
        return new StandardRenderReplace(
            this.match.remapReferences(props),
            this.payload.remapReferences(props)
        )
    }
}

export class StandardRender {
    _payload: StandardRenderSimple | StandardRenderRemove | StandardRenderReplace;
    
    constructor(arg: any) {
        if (arg instanceof StandardRenderSimple || arg instanceof StandardRenderRemove || arg instanceof StandardRenderReplace) {
            this._payload = arg
            return
        }
        if (Array.isArray(arg) && arg.every(isRenderTreeNode)) {
            if (arg.length === 1) {
                const node = arg[0]
                if (typeof node !== 'string') {
                    if (isSchemaRemove(node.data)) {
                        this._payload = new StandardRenderRemove([node] as GenericTree<SchemaTag>)
                        return
                    }
                    else if (isSchemaReplace(node.data)) {
                        this._payload = new StandardRenderReplace([node] as GenericTree<SchemaTag>)
                        return
                    }
                }
            }
            this._payload = new StandardRenderSimple(arg as GenericTree<SchemaTag>)
        }
        else {
            throw new Error('Invalid argument to StandardRender constructor')
        }
    }

    get plainString() {
        return renderTreeToString(this._payload.plain.toJSON())
    }

    get schema(): GenericTree<SchemaTag> {
        return this._payload.schema
    }

    nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        return this._payload.nestedSchema(tag)
    }

    toJSON(): RenderTree {
        return this._payload.toJSON()
    }

    toNDJSON(): RenderTree {
        return this._payload.schema
    }

    merge(incoming: StandardRender): StandardRender | undefined {
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            return new StandardRender(this._payload.merge(incoming._payload))
        }
        return undefined
    }
    diff(incoming: StandardRender | undefined): StandardRender | undefined {
        if (incoming) {
            const diff = this._payload.diff(incoming._payload)
            if (diff) {
                return new StandardRender(diff)
            }
            return undefined
        }
        else {
            const reversedDelta = this._payload._delta
            if (reversedDelta) {
                if (reversedDelta.add) {
                    return new StandardRender(new StandardRenderRemove(new StandardRenderSimpleBase(reversedDelta.add)))
                }
                if (reversedDelta.remove) {
                    return new StandardRender(new StandardRenderSimple(reversedDelta.remove))
                }
            }
            return undefined
        }
    }
    mapContents(callback: (incoming: RenderTree) => RenderTree): StandardRender {
        if (this._payload instanceof StandardRenderSimple) {
            return new StandardRender(callback(this._payload.schema))
        }
        if (this._payload instanceof StandardRenderRemove) {
            return new StandardRender(new StandardRenderRemove(new StandardRenderSimpleBase(callback(this._payload.match.schema))))
        }
        if (this._payload instanceof StandardRenderReplace) {
            return new StandardRender(new StandardRenderReplace((new StandardRenderSimple(callback(this._payload.match.schema))).payload, (new StandardRenderSimple(callback(this._payload.payload.schema))).payload))
        }
        throw new Error('Invalid StandardRender payload')
    }

    remapReferences(props: { mapping: StandardReference[], mapTo: ReferenceFormat }): StandardRender {
        return new StandardRender(this._payload.remapReferences(props))
    }

    invert(): StandardRender {
        if (this._payload instanceof StandardRenderSimple) {
            return new StandardRender(new StandardRenderRemove(this._payload.payload))
        }
        if (this._payload instanceof StandardRenderRemove) {
            return new StandardRender(new StandardRenderSimple(this._payload.match))
        }
        if (this._payload instanceof StandardRenderReplace) {
            return new StandardRender(new StandardRenderReplace(this._payload.payload, this._payload.match))
        }
        throw new Error('Invalid StandardRender payload for invert')
    }

}