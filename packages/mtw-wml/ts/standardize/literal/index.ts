import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { standardEditableFactory, StandardEditablePayload } from "../../generics/editable"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isRenderTree, renderTreeToSchema } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaString, isSchemaSpacer } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isSchemaTreeNode } from "../../schema"
import { stripWrapperTag } from "../../schema/utils"

//
// StandardLiteralSimpleBase holds the contents for a simple StandardLiteral
//
const SPACE_NODE = { data: { tag: 'Space' as const }, children: [] as GenericTree<SchemaTag> }

export class StandardLiteralSimpleBase implements StandardEditablePayload<string> {
    data: string
    get schema(): GenericTree<SchemaTag> {
        const s = this.data
        const hasLeading = /^\s/.test(s)
        const hasTrailing = /\s$/.test(s)
        const middle = s.trim()
        const leadingNodes: GenericTree<SchemaTag> = hasLeading ? [SPACE_NODE] : []
        const trailingNodes: GenericTree<SchemaTag> = hasTrailing ? [SPACE_NODE] : []
        if (middle.length === 0) {
            if (leadingNodes.length > 0 || trailingNodes.length > 0) return [SPACE_NODE]
            return [{ data: { tag: 'String' as const, value: '' }, children: [] }]
        }
        return [...leadingNodes, { data: { tag: 'String' as const, value: middle }, children: [] }, ...trailingNodes]
    }
    constructor(data: string) {
        this.data = data
    }
    clone() {
        return new StandardLiteralSimpleBase(`${this.data}`)
    }
    toJSON: () => string = () => this.data
}

function literalChildrenToString(children: GenericTree<SchemaTag>): string {
    return children
        .map((node) => {
            const data = node.data
            if (isSchemaString(data)) return data.value
            if (isSchemaSpacer(data)) return ' '
            return ''
        })
        .join('')
}

const payloadFactory = (props: string | GenericTree<SchemaTag>): StandardLiteralSimpleBase | undefined => {
    if (typeof props === 'string') {
        return new StandardLiteralSimpleBase(props)
    }
    // Handle empty array - represents empty string
    if (props.length === 0) {
        return new StandardLiteralSimpleBase('')
    }
    if (props.length === 1 && isSchemaString(props[0].data)) {
        return new StandardLiteralSimpleBase(props[0].data.value)
    }
    const asString = literalChildrenToString(props)
    return new StandardLiteralSimpleBase(asString)
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

export const { 
    EditableClass, 
    PlainClass, 
    RemoveClass, 
    ReplaceClass, 
    dataTypeguard: isStandardLiteralData 
} = standardEditableFactory({
    typeguard: (value: any): value is string => (typeof value === 'string'),
    payloadFactory: payloadFactory,
    payload: StandardLiteralSimpleBase,
    add: standardLiteralAdd,
    subtract: standardLiteralSubtract,
    diff: standardLiteralDiff
}, 'StandardLiteral')


export class StandardLiteral {
    _payload: InstanceType<typeof EditableClass>;
    _wrapperTag?: SchemaTag["tag"];
    
    constructor(arg: any, options?: { tag?: SchemaTag["tag"] }) {
        // Handle existing StandardLiteral instance (for cloning/copying)
        if (arg instanceof StandardLiteral) {
            this._payload = arg._payload
            // Preserve tag from source, or use provided tag, or no tag
            this._wrapperTag = options?.tag ?? arg._wrapperTag
            return
        }
        
        // Handle existing v2 instance (for cloning/wrapping)
        if (arg instanceof EditableClass) {
            this._payload = arg
            this._wrapperTag = options?.tag
            return
        }
        
        // Convert RenderTree to GenericTree<SchemaTag> before calling EditableClass.create()
        // EditableClass.create() doesn't handle RenderTree directly
        let convertedArg = isRenderTree(arg) ? renderTreeToSchema(arg) : arg
        
        // Strip wrapper tag if options.tag is provided and arg is a GenericTree<SchemaTag>
        if (options?.tag && Array.isArray(convertedArg) && convertedArg.every(isSchemaTreeNode)) {
            convertedArg = stripWrapperTag(convertedArg, options.tag)
        }
        // Single node with matching wrapper tag (e.g. treeFromWML(wml)[0]) - pass children to create
        if (options?.tag && !Array.isArray(convertedArg) && convertedArg?.data?.tag === options.tag && Array.isArray((convertedArg as any).children)) {
            convertedArg = (convertedArg as any).children
        }

        // Use EditableClass.create() for dispatch
        // Handles: string, StandardEditableData, GenericTree<SchemaTag>
        this._payload = EditableClass.create(convertedArg)
        this._wrapperTag = options?.tag
    }

    get schema(): GenericTree<SchemaTag> {
        return this._payload.schema
    }

    nestedSchema(tag?: SchemaTag): GenericTree<SchemaTag> {
        // Use provided tag, or fall back to stored wrapper tag
        const tagToUse: SchemaTag | undefined = tag ?? (this._wrapperTag ? { tag: this._wrapperTag } as SchemaTag : undefined)
        if (!tagToUse) {
            throw new Error('nestedSchema() called without tag argument and no stored wrapper tag')
        }
        
        // Override v2 nestedSchema to wrap content in tag (v2 base class just returns schema without wrapping)
        // Handle PlainClass: wrap schema in tag
        if (this._payload instanceof PlainClass) {
            return [{ data: tagToUse, children: this._payload.schema }]
        }
        // Handle RemoveClass: wrap match schema in tag, then wrap in Remove
        if (this._payload instanceof RemoveClass) {
            const match = (this._payload as any).match
            return [{
                data: { tag: 'Remove' as const },
                children: [{ data: tagToUse, children: match?.schema ?? [] }]
            }]
        }
        // Handle ReplaceClass: wrap match and payload schemas in tag, then wrap in Replace
        if (this._payload instanceof ReplaceClass) {
            const match = (this._payload as any).match
            const payload = (this._payload as any).payload
            return [{
                data: { tag: 'Replace' as const },
                children: [
                    { data: { tag: 'ReplaceMatch' as const }, children: [{ data: tagToUse, children: match?.schema ?? [] }] },
                    { data: { tag: 'ReplacePayload' as const }, children: [{ data: tagToUse, children: payload?.schema ?? [] }] }
                ]
            }]
        }
        // Fallback to v2 implementation (shouldn't happen)
        return this._payload.nestedSchema(tagToUse)
    }

    toJSON(): StandardEditableData<string> {
        return this._payload.toJSON()
    }

    /**
     * True when this value is a no-op as optional literal content: plain '',
     * Remove(match: ''), or Replace where match and payload have no diff.
     */
    isEmpty(): boolean {
        if (this._payload instanceof PlainClass) {
            const value = this._payload.plain?.toJSON() ?? ''
            return value.length === 0
        }
        if (this._payload instanceof RemoveClass) {
            const matchValue = (this._payload as any).match?.toJSON() ?? ''
            return matchValue.length === 0
        }
        if (this._payload instanceof ReplaceClass) {
            const matchValue = (this._payload as any).match?.toJSON() ?? ''
            const payloadValue = (this._payload as any).payload?.toJSON() ?? ''
            const matchLiteral = new StandardLiteral(matchValue)
            const payloadLiteral = new StandardLiteral(payloadValue)
            return matchLiteral.equals(payloadLiteral)
        }
        return false
    }

    /**
     * Semantic equality for literal values: vacuous shapes agree via isEmpty;
     * otherwise equality follows editable-wrapper diff (no delta between states).
     */
    equals(other: StandardLiteral): boolean {
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

    _wrap(instance: StandardLiteral): StandardLiteral {
        return instance
    }

    clone(): StandardLiteral {
        const cloned = new StandardLiteral(this, this._wrapperTag ? { tag: this._wrapperTag } : undefined)
        return this._wrap(cloned)
    }

    merge(incoming: StandardLiteral): StandardLiteral | undefined {
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            // Preserve tag if both operands have the same tag, otherwise no tag
            const tagToPreserve = (this._wrapperTag && incoming._wrapperTag && this._wrapperTag === incoming._wrapperTag) 
                ? this._wrapperTag 
                : undefined
            const mergedResult = new StandardLiteral(merged, tagToPreserve ? { tag: tagToPreserve } : undefined)
            return this._wrap(mergedResult)
        }
        return undefined
    }
    diff(incoming: StandardLiteral | undefined): StandardLiteral | undefined {
        if (incoming) {
            const diff = this._payload.diff(incoming._payload)
            if (diff) {
                // Preserve tag if both operands have the same tag, otherwise no tag
                const tagToPreserve = (this._wrapperTag && incoming._wrapperTag && this._wrapperTag === incoming._wrapperTag) 
                    ? this._wrapperTag 
                    : undefined
                const diffResult = new StandardLiteral(diff, tagToPreserve ? { tag: tagToPreserve } : undefined)
                return this._wrap(diffResult)
            }
            return undefined
        } else {
            // Diff from this to nothing: invert
            const inverted = this._payload.invert()
            const invertedResult = new StandardLiteral(inverted, this._wrapperTag ? { tag: this._wrapperTag } : undefined)
            return this._wrap(invertedResult)
        }
    }
    mapContents(callback: (incoming: string) => string): StandardLiteral {
        // Access the underlying data
        const currentData = this._payload.plain?.data ?? ''
        const mappedData = callback(currentData)
        
        // For Remove/Replace, need to handle match/payload separately
        if (this._payload instanceof RemoveClass) {
            const matchData = (this._payload as any).match?.data ?? ''
            const mappedMatch = callback(matchData)
            return new StandardLiteral({ tag: 'Remove', match: mappedMatch }, this._wrapperTag ? { tag: this._wrapperTag } : undefined)
        }
        if (this._payload instanceof ReplaceClass) {
            const matchData = (this._payload as any).match?.data ?? ''
            const payloadData = (this._payload as any).payload?.data ?? ''
            return new StandardLiteral({ 
                tag: 'Replace', 
                match: callback(matchData), 
                payload: callback(payloadData) 
            }, this._wrapperTag ? { tag: this._wrapperTag } : undefined)
        }
        // PlainClass
        return new StandardLiteral(mappedData, this._wrapperTag ? { tag: this._wrapperTag } : undefined)
    }

    invert(): StandardLiteral {
        const inverted = this._payload.invert()
        const invertedResult = new StandardLiteral(inverted, this._wrapperTag ? { tag: this._wrapperTag } : undefined)
        return this._wrap(invertedResult)
    }

}