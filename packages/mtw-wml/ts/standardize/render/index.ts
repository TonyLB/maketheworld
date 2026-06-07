import StandardRenderString from "./string"
import StandardRenderLineBreak from "./lineBreak"
import StandardRenderLink from "./link"
import StandardRenderSpace from "./space"
import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { deepEqual } from "../../lib/objects"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"
import { isRenderTreeNode, isSimpleRenderTree, RenderTree, RenderTreeNode, renderTreeToSchema, renderTreeToString, schemaToRenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { standardEditableFactory, StandardEditablePayload } from "../../generics/editable"
import StandardReference from "../keys/reference"
import { ReferenceFormat } from "../components/utils/references"
import { isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { stripWrapperTag } from "../../schema/utils"

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
    remapReferences: (props: { mapping: StandardReference[], mapTo: ReferenceFormat } | { mappings: StandardReference[], mapTo: ReferenceFormat }) => StandardRenderSimpleBase = (props) => {
        // Normalize props format - v2 factory uses 'mappings', but elements expect 'mapping'
        const normalizedProps = 'mappings' in props 
            ? { mapping: props.mappings, mapTo: props.mapTo }
            : props;
        const simpleElements = renderTreeToSimpleElements(this.data)
        const remappedElements = simpleElements.map((element) => (element.remapReferences(normalizedProps)))
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
                    if (lastElement.endsWith(' ')) {
                        const trimmed = lastElement.trimEnd()
                        return [
                            ...previous.slice(0, -1),
                            ...(trimmed ? [trimmed] : []),
                            { data: { tag: 'Space' }, children: [] },
                            renderElement
                        ]
                    }
                    return [...previous.slice(0, -1), lastElement.trimEnd(), renderElement]
                }
                if (renderElement.data.tag === 'Space') {
                    return [...previous.slice(0, -1), `${lastElement.trimEnd()} `]
                }
                return [...previous, renderElement]
            }
            if (typeof renderElement === 'string') {
                if (lastElement.data.tag === 'br') {
                    if (renderElement.startsWith(' ')) {
                        return [
                            ...previous.slice(0, -1),
                            lastElement,
                            { data: { tag: 'Space' }, children: [] },
                            renderElement.trimStart()
                        ]
                    }
                    return [...previous.slice(0, -1), lastElement, renderElement.trimStart()]
                }
                if (lastElement.data.tag === 'Space') {
                    const elementBeforeSpace = previous.length >= 2 ? previous[previous.length - 2] : undefined
                    const spaceAfterBr = typeof elementBeforeSpace === 'object' && elementBeforeSpace.data.tag === 'br'
                    if (spaceAfterBr) {
                        return [...previous, renderElement.trimStart()]
                    }
                    return [...previous.slice(0, -1), ` ${renderElement.trimStart()}`]
                }
            }
            if (typeof lastElement === 'object' && typeof renderElement === 'object') {
                if (lastElement.data.tag === 'br' && renderElement.data.tag === 'br') {
                    const priorElement = previous[previous.length - 2]
                    const priorIsBr = previous.length >= 2
                        && typeof priorElement === 'object'
                        && priorElement.data.tag === 'br'
                    return priorIsBr ? previous : [...previous, renderElement]
                }
                if (lastElement.data.tag === 'Space' && renderElement.data.tag === 'Space') {
                    return previous
                }
                if (lastElement.data.tag === 'br' && renderElement.data.tag === 'Space') {
                    return [...previous, renderElement]
                }
                if (lastElement.data.tag === 'Space' && renderElement.data.tag === 'br') {
                    return [...previous, renderElement]
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
                else if (baseElement.length < incomingElement.length) {
                    return standardRenderDiff(base.slice(1), [incomingElement.slice(baseElement.length), ...incoming.slice(1)])
                }
                else {
                    return standardRenderDiff([baseElement.slice(incomingElement.length), ...base.slice(1)], incoming.slice(1))
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

export const { 
    EditableClass, 
    PlainClass, 
    RemoveClass, 
    ReplaceClass, 
    dataTypeguard: isStandardRenderData 
} = standardEditableFactory({
    typeguard: isSimpleRenderTree,
    payloadFactory: payloadFactory,
    payload: StandardRenderSimpleBase,
    add: standardRenderAdd,
    subtract: standardRenderSubtract,
    diff: standardRenderDiff
    // No validateReplace - not needed for RenderTree
}, 'StandardRender')

function validateSchemaNodeForRender<D extends SchemaTag>(
    node: GenericTreeNode<SchemaTag>,
    typeguard: (data: SchemaTag) => data is D,
    errorMessage: string
): void {
    if (treeNodeTypeguard(typeguard)(node)) {
        return
    }
    if (treeNodeTypeguard(isSchemaRemove)(node)) {
        const child = node.children[0]
        if (child && treeNodeTypeguard(typeguard)(child)) {
            return
        }
        throw new Error(errorMessage)
    }
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        const match = node.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
        const payload = node.children.find(treeNodeTypeguard(isSchemaReplacePayload))
        if (match && payload) {
            const matchChild = match.children[0]
            const payloadChild = payload.children[0]
            if (matchChild && treeNodeTypeguard(typeguard)(matchChild) && payloadChild && treeNodeTypeguard(typeguard)(payloadChild)) {
                return
            }
        }
    }
    throw new Error(errorMessage)
}

export class StandardRender {
    _payload: InstanceType<typeof EditableClass>;
    
    constructor(arg: any, options?: { tag?: SchemaTag["tag"]; nodeTypeGuard?: (data: SchemaTag) => data is SchemaTag; errorMessage?: string }) {
        // Handle existing StandardRender instance (for cloning)
        if (arg instanceof StandardRender) {
            this._payload = arg._payload
            return
        }
        
        // Handle existing v2 instance
        if (arg instanceof EditableClass) {
            this._payload = arg
            return
        }
        
        // Handle StandardEditableData<RenderTree> format (JSON serialization)
        // This includes { tag: 'Remove', match: RenderTree } and { tag: 'Replace', match: RenderTree, payload: RenderTree }
        if (typeof arg === 'object' && arg !== null && 'tag' in arg) {
            if (arg.tag === 'Remove' && 'match' in arg) {
                // StandardEditableData Remove format - pass directly to EditableClass.create()
                this._payload = EditableClass.create(arg as StandardEditableData<RenderTree>)
                return
            }
            if (arg.tag === 'Replace' && 'match' in arg && 'payload' in arg) {
                // StandardEditableData Replace format - pass directly to EditableClass.create()
                this._payload = EditableClass.create(arg as StandardEditableData<RenderTree>)
                return
            }
        }
        
        // Handle single schema node with options.tag (strip content wrapper, then dispatch)
        if (options?.tag && typeof arg === 'object' && arg !== null && 'data' in arg && 'children' in arg && Array.isArray((arg as any).children)) {
            if (options.nodeTypeGuard && options.errorMessage) {
                validateSchemaNodeForRender(arg as GenericTreeNode<SchemaTag>, options.nodeTypeGuard, options.errorMessage)
            }
            const stripped = stripWrapperTag([arg as GenericTreeNode<SchemaTag>], options.tag)
            this._payload = EditableClass.create(stripped)
            return
        }
        
        // Handle RenderTree array directly (no wrapper tag stripping needed)
        if (Array.isArray(arg) && arg.every(isRenderTreeNode)) {
            // Check for Remove/Replace edit tags at top level
            if (arg.length === 1) {
                const node = arg[0]
                if (typeof node !== 'string') {
                    if (isSchemaRemove(node.data)) {
                        // Remove tag at top level - use EditableClass.create() which handles it
                        this._payload = EditableClass.create(arg as GenericTree<SchemaTag>)
                        return
                    }
                    else if (isSchemaReplace(node.data)) {
                        // Replace tag at top level - use EditableClass.create() which handles it
                        this._payload = EditableClass.create(arg as GenericTree<SchemaTag>)
                        return
                    }
                }
            }
            // Plain RenderTree - use EditableClass.create()
            this._payload = EditableClass.create(arg as GenericTree<SchemaTag>)
            return
        }
        
        throw new Error('Invalid argument to StandardRender constructor')
    }

    get plain(): RenderTree | undefined {
        const plainPayload = this._payload.plain
        return plainPayload?.toJSON()
    }

    get plainString() {
        if (this._payload instanceof PlainClass) {
            const plain = this._payload.plain
            if (plain) {
                return renderTreeToString(plain.toJSON())
            }
        }
        return ''
    }

    /**
     * True when this value is a no-op as optional rich text: plain [], Remove(match: []),
     * or Replace where match and payload have no diff (identity replace). See task plan
     * semantic optionals / Decisions locked (no-op diff / merge criterion).
     */
    isEmpty(): boolean {
        if (this._payload instanceof PlainClass) {
            const tree = this.plain
            return !tree || tree.length === 0
        }
        if (this._payload instanceof RemoveClass) {
            const matchTree = this._payload.match?.toJSON() as RenderTree | undefined
            return !matchTree || matchTree.length === 0
        }
        if (this._payload instanceof ReplaceClass) {
            const matchTree = (this._payload.match?.toJSON() ?? []) as RenderTree
            const payloadTree = (this._payload.payload?.toJSON() ?? []) as RenderTree
            const matchRender = new StandardRender(matchTree)
            const payloadRender = new StandardRender(payloadTree)
            return matchRender.diff(payloadRender) === undefined
        }
        return false
    }

    /**
     * Semantic equality for rich text: vacuous shapes agree via {@link isEmpty};
     * otherwise equality follows editable-wrapper diff (no delta between states).
     */
    equals(other: StandardRender): boolean {
        if (this === other) {
            return true
        }
        if (this.isEmpty() && other.isEmpty()) {
            return true
        }
        if (this.isEmpty() !== other.isEmpty()) {
            return false
        }
        return this._payload.diff(other._payload) === undefined
    }

    clone(): StandardRender {
        return new StandardRender(this)
    }

    get schema(): GenericTree<SchemaTag> {
        return this._payload.schema
    }

    nestedSchema(options?: { tag?: SchemaTag["tag"]; mappings?: StandardReference[] }): GenericTree<SchemaTag> {
        const render = options?.mappings ? this.remapReferences({ mapping: options.mappings, mapTo: 'key' }) : this
        const payload = render._payload

        if (!options?.tag) {
            return payload.schema
        }

        const tag = { tag: options.tag } as SchemaTag

        if (payload instanceof PlainClass) {
            if (payload.schema.length === 0) {
                return []
            }
            return [{ data: tag, children: payload.schema }]
        }
        if (payload instanceof RemoveClass) {
            const match = (payload as any).match
            return [{
                data: { tag: 'Remove' as const },
                children: [{ data: tag, children: match?.schema ?? [] }]
            }]
        }
        if (payload instanceof ReplaceClass) {
            const match = (payload as any).match
            const replacePayload = (payload as any).payload
            return [{
                data: { tag: 'Replace' as const },
                children: [
                    { data: { tag: 'ReplaceMatch' as const }, children: [{ data: tag, children: match?.schema ?? [] }] },
                    { data: { tag: 'ReplacePayload' as const }, children: [{ data: tag, children: replacePayload?.schema ?? [] }] }
                ]
            }]
        }
        return payload.nestedSchema(tag)
    }

    toJSON(): StandardEditableData<RenderTree> {
        return this._payload.toJSON()
    }

    toNDJSON(): GenericTree<SchemaTag> {
        return this._payload.schema
    }

    merge(incoming: StandardRender): StandardRender | undefined {
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            return new StandardRender(merged)
        }
        return undefined
    }
    diff(incoming: StandardRender | undefined): StandardRender | undefined {
        if (incoming) {
            const diffResult = this._payload.diff(incoming._payload)
            if (diffResult) {
                return new StandardRender(diffResult)
            }
            return undefined
        }
        else {
            // Invert when incoming is undefined
            const inverted = this._payload.invert()
            if (inverted) {
                return new StandardRender(inverted)
            }
            return undefined
        }
    }
    mapContents(callback: (incoming: RenderTree) => RenderTree): StandardRender {
        if (this._payload instanceof PlainClass) {
            const currentValue = this._payload.plain?.toJSON() ?? []
            const mapped = callback(currentValue)
            return new StandardRender(mapped)
        }
        if (this._payload instanceof RemoveClass) {
            const matchValue = (this._payload as any).match?.toJSON() ?? []
            const mapped = callback(matchValue)
            // Convert RenderTree to schema tree and wrap in Remove structure
            const schemaTree = renderTreeToSchema(mapped)
            const removeSchema = [{ data: { tag: 'Remove' as const }, children: schemaTree }]
            return new StandardRender(removeSchema)
        }
        if (this._payload instanceof ReplaceClass) {
            const matchValue = (this._payload as any).match?.toJSON() ?? []
            const payloadValue = (this._payload as any).payload?.toJSON() ?? []
            const mappedMatch = callback(matchValue)
            const mappedPayload = callback(payloadValue)
            // Convert RenderTrees to schema trees and wrap in Replace structure
            const matchSchema = renderTreeToSchema(mappedMatch)
            const payloadSchema = renderTreeToSchema(mappedPayload)
            const replaceSchema = [{
                data: { tag: 'Replace' as const },
                children: [
                    { data: { tag: 'ReplaceMatch' as const }, children: matchSchema },
                    { data: { tag: 'ReplacePayload' as const }, children: payloadSchema }
                ]
            }]
            return new StandardRender(replaceSchema)
        }
        throw new Error('Invalid StandardRender payload')
    }

    remapReferences(props: { mapping: StandardReference[], mapTo: ReferenceFormat }): StandardRender {
        const remapped = this._payload.remapReferences({ mapTo: props.mapTo, mappings: props.mapping })
        return new StandardRender(remapped)
    }

    invert(): StandardRender {
        const inverted = this._payload.invert()
        return new StandardRender(inverted)
    }

}