import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { v2StandardEditableFactory, StandardEditablePayload } from "../../generics/editable"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isRenderTree, RenderTree, renderTreeToSchema } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"

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

export const { 
    EditableClass, 
    PlainClass, 
    RemoveClass, 
    ReplaceClass, 
    dataTypeguard: isStandardLiteralData 
} = v2StandardEditableFactory({
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
        const convertedArg = isRenderTree(arg) ? renderTreeToSchema(arg) : arg
        
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

    merge(incoming: StandardLiteral): StandardLiteral | undefined {
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            // Preserve tag if both operands have the same tag, otherwise no tag
            const tagToPreserve = (this._wrapperTag && incoming._wrapperTag && this._wrapperTag === incoming._wrapperTag) 
                ? this._wrapperTag 
                : undefined
            return new StandardLiteral(merged, tagToPreserve ? { tag: tagToPreserve } : undefined)
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
                return new StandardLiteral(diff, tagToPreserve ? { tag: tagToPreserve } : undefined)
            }
            return undefined
        } else {
            // Diff from this to nothing: invert
            const inverted = this._payload.invert()
            return new StandardLiteral(inverted, this._wrapperTag ? { tag: this._wrapperTag } : undefined)
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
        return new StandardLiteral(inverted, this._wrapperTag ? { tag: this._wrapperTag } : undefined)
    }

}