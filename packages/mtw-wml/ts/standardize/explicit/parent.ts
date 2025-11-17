import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { StandardEditableDataDelta, standardEditableFactory, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isRenderTree, RenderTree, renderTreeToSchema } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { ComponentUUID, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema"

//
// StandardExplicitParentSimpleBase holds the contents for a simple StandardExplicitParent
//
export class StandardExplicitParentSimpleBase implements StandardEditablePayload<ComponentUUID> {
    data: ComponentUUID
    get schema() {
        return [{ data: { tag: 'String' as const, value: this.data }, children: [] }]
    }
    constructor(data: ComponentUUID) {
        if (!isSchemaComponentUUID(data)) {
            throw new Error(`Invalid ComponentUUID: ${data}`)
        }
        this.data = data
    }
    clone() {
        return new StandardExplicitParentSimpleBase(this.data)
    }
    toJSON: () => ComponentUUID = () => this.data
}

const payloadFactory = (props: ComponentUUID | GenericTree<SchemaTag>): StandardExplicitParentSimpleBase | undefined => {
    if (typeof props === 'string' && isSchemaComponentUUID(props)) {
        return new StandardExplicitParentSimpleBase(props)
    }
    // Handle schema tree - check if first element is a Parent tag
    if (Array.isArray(props) && props.length > 0) {
        const firstElement = props[0]
        // If first element is a Parent tag, extract its children
        if (firstElement.data && firstElement.data.tag === 'Parent') {
            const parentChildren = firstElement.children
            // Combine all String children from Parent tag
            const combinedValue = parentChildren
                .map(({ data }) => data)
                .filter(isSchemaString)
                .map(({ value }) => value)
                .join('')
            if (combinedValue && isSchemaComponentUUID(combinedValue)) {
                return new StandardExplicitParentSimpleBase(combinedValue)
            }
            // Empty Parent tag (self-closing)
            if (combinedValue === '') {
                return undefined
            }
            throw new Error(`Parent tag content must be a ComponentUUID, got: ${combinedValue}`)
        }
        // Handle direct String tag (not wrapped in Parent)
        if (props.length === 1 && isSchemaString(props[0].data)) {
            const combinedValue = props[0].data.value
            if (isSchemaComponentUUID(combinedValue)) {
                return new StandardExplicitParentSimpleBase(combinedValue)
            }
            throw new Error(`Parent tag content must be a ComponentUUID, got: ${combinedValue}`)
        }
    }
    // Handle empty Parent tag (self-closing) - return undefined to represent no parent
    if (Array.isArray(props) && props.length === 0) {
        return undefined
    }
    throw new Error('Invalid argument in StandardExplicitParentSimpleBase constructor')
}

// Parent values can only be added if they match exactly (no partial matches)
const standardExplicitParentAdd = (base: ComponentUUID, incoming: ComponentUUID): ComponentUUID => {
    // For Parent, adding means replacing - they must match exactly
    if (base === incoming) {
        return base
    }
    // If they don't match, the incoming value replaces the base
    return incoming
}

// Parent values can only be removed if they match exactly (no partial matches)
const standardExplicitParentSubtract = (base: ComponentUUID, incoming: ComponentUUID): { add?: ComponentUUID, remove?: ComponentUUID } => {
    // Only allow exact matches - partial matches are error conditions
    if (base === incoming) {
        // Exact match: remove the value entirely
        return {}
    }
    // Partial matches are not allowed for Parent values
    throw new MergeConflictError('Parent values can only be removed or replaced if they match exactly. Partial matches are not allowed.')
}

// Parent values can only be diffed if they match exactly (no partial matches)
const standardExplicitParentDiff = (base: ComponentUUID, incoming: ComponentUUID): { add?: ComponentUUID, remove?: ComponentUUID } => {
    if (base === incoming) {
        // No difference
        return {}
    }
    // Different values: replace base with incoming
    return { remove: base, add: incoming }
}

export const { constructorDelta: factory, typeguard: isStandardExplicitParentData, merge, diff } = standardEditableFactory({
    typeguard: (value: any): value is ComponentUUID => (typeof value === 'string' && isSchemaComponentUUID(value)),
    payloadFactory: payloadFactory,
    payload: StandardExplicitParentSimpleBase,
    add: standardExplicitParentAdd,
    subtract: standardExplicitParentSubtract,
    diff: standardExplicitParentDiff
})

const fromDelta = (delta: { add?: ComponentUUID, remove?: ComponentUUID }): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined => {
    const { add, remove } = delta
    if (add) {
        if (remove) {
            return new StandardExplicitParentReplace(new StandardExplicitParentSimpleBase(remove), new StandardExplicitParentSimpleBase(add))
        }
        return new StandardExplicitParentSimple(new StandardExplicitParentSimpleBase(add))
    }
    if (remove) {
        return new StandardExplicitParentRemove(new StandardExplicitParentSimpleBase(remove))
    }
    return undefined
}

export class StandardExplicitParentSimple implements StandardEditableWrapper<StandardExplicitParentSimpleBase> {
    payload: StandardExplicitParentSimpleBase
    constructor(data: StandardExplicitParentSimpleBase | StandardEditableData<ComponentUUID> | RenderTree | GenericTree<SchemaTag> | ComponentUUID) {
        if (data instanceof StandardExplicitParentSimpleBase) {
            this.payload = data
            return
        }
        const delta = factory(isRenderTree(data) ? renderTreeToSchema(data) : data)
        if (delta && delta.add && !delta.remove) {
            this.payload = delta.add
            return
        }
        throw new Error('Invalid data in StandardExplicitParentSimple')
    }
    get schema() {
        return [{ data: { tag: 'Parent' as const }, children: this.payload.schema }]
    }
    nestedSchema(tag) {
        return [{ data: tag, children: this.schema }]
    }
    get _delta(): StandardEditableDataDelta<ComponentUUID> {
        return { add: this.payload.toJSON() }
    }
    clone() {
        return new StandardExplicitParentSimple(this.payload)
    }
    toJSON: () => StandardEditableData<ComponentUUID> = () => this.payload.toJSON()
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardExplicitParentRemove implements StandardEditableWrapper<StandardExplicitParentSimpleBase> {
    match: StandardExplicitParentSimpleBase
    constructor(data: StandardExplicitParentSimpleBase | StandardEditableData<ComponentUUID> | RenderTree | GenericTree<SchemaTag> | ComponentUUID) {
        if (data instanceof StandardExplicitParentSimpleBase) {
            this.match = data
            return
        }
        const delta = factory(isRenderTree(data) ? renderTreeToSchema(data) : data)
        if (delta && !delta.add && delta.remove) {
            this.match = delta.remove
            return
        }
        console.log(`Invalid data: ${JSON.stringify(data)}`)
        throw new Error('Invalid data in StandardExplicitParentRemove')
    }
    get schema() {
        return [{ data: { tag: 'Remove' as const }, children: [{ data: { tag: 'Parent' as const }, children: this.match.schema }] }]
    }
    nestedSchema(tag) {
        return [{
            data: { tag: 'Remove' as const },
            children: [{ data: tag, children: [{ data: { tag: 'Parent' as const }, children: this.match.schema }] }]
        }]
    }
    get _delta(): StandardEditableDataDelta<ComponentUUID> {
        return { remove: this.match.toJSON() }
    }
    clone() {
        return new StandardExplicitParentRemove(this.match)
    }
    toJSON: () => StandardEditableData<ComponentUUID> = () => ({ tag: 'Remove' as const, match: this.match.toJSON() })
    get plain() { return this.match }
    merge(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardExplicitParentReplace implements StandardEditableWrapper<StandardExplicitParentSimpleBase> {
    match: StandardExplicitParentSimpleBase
    payload: StandardExplicitParentSimpleBase
    constructor(...args: [StandardEditableData<ComponentUUID> | RenderTree | GenericTree<SchemaTag> | ComponentUUID] | [StandardExplicitParentSimpleBase, StandardExplicitParentSimpleBase]) {
        if (args.length === 2) {
            this.match = args[0]
            this.payload = args[1]
            return
        }
        const delta = factory(isRenderTree(args[0]) ? renderTreeToSchema(args[0]) : args[0])
        if (delta && delta.add && delta.remove) {
            this.match = delta.remove
            this.payload = delta.add
            return
        }
        throw new Error('Invalid data in StandardExplicitParentReplace')
    }
    get schema() {
        return [{ data: { tag: 'Replace' as const }, children: [
            { data: { tag: 'ReplaceMatch' as const }, children: [{ data: { tag: 'Parent' as const }, children: this.match.schema }] },
            { data: { tag: 'ReplacePayload' as const }, children: [{ data: { tag: 'Parent' as const }, children: this.payload.schema }] }
        ] }]
    }
    nestedSchema(tag) {
        return [{
            data: { tag: 'Replace' as const },
            children: [
                {
                    data: { tag: 'ReplaceMatch' as const },
                    children: [{ data: tag, children: [{ data: { tag: 'Parent' as const }, children: this.match.schema }] }]
                },
                {
                    data: { tag: 'ReplacePayload' as const },
                    children: [{ data: tag, children: [{ data: { tag: 'Parent' as const }, children: this.payload.schema }] }]
                }
            ]
        }]
    }
    get _delta(): StandardEditableDataDelta<ComponentUUID> {
        return { remove: this.match.toJSON(), add: this.payload.toJSON() }
    }
    clone() {
        return new StandardExplicitParentReplace(this.match, this.payload)
    }
    toJSON: () => StandardEditableData<ComponentUUID> = () => ({ 
        tag: 'Replace' as const,
        match: this.match.toJSON(),
        payload: this.payload.toJSON()
    })
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<StandardExplicitParentSimpleBase>): StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

export class StandardExplicitParent {
    _payload: StandardExplicitParentSimple | StandardExplicitParentRemove | StandardExplicitParentReplace;
    
    constructor(arg: any) {
        if (arg instanceof StandardExplicitParentSimple || arg instanceof StandardExplicitParentRemove || arg instanceof StandardExplicitParentReplace) {
            this._payload = arg
            return
        }
        const delta = factory(isRenderTree(arg) ? renderTreeToSchema(arg) : arg)
        if (!delta) {
            // Handle empty Parent tag (self-closing) - represents no parent
            // Return undefined payload to indicate no parent value
            this._payload = undefined as any
            return
        }
        if (delta.add) {
            if (delta.remove) {
                this._payload = new StandardExplicitParentReplace(arg)
                return
            }
            this._payload = new StandardExplicitParentSimple(arg)
            return
        }
        if (delta.remove) {
            this._payload = new StandardExplicitParentRemove(arg)
            return
        }
        // Empty delta - no parent value
        this._payload = undefined as any
    }

    get schema(): GenericTree<SchemaTag> {
        if (!this._payload) {
            // Empty Parent tag (self-closing)
            return [{ data: { tag: 'Parent' as const }, children: [] }]
        }
        return this._payload.schema
    }

    nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        if (!this._payload) {
            return [{ data: tag, children: [{ data: { tag: 'Parent' as const }, children: [] }] }]
        }
        return this._payload.nestedSchema(tag)
    }

    toJSON(): StandardEditableData<ComponentUUID> | undefined {
        if (!this._payload) {
            return undefined
        }
        return this._payload.toJSON()
    }

    merge(incoming: StandardExplicitParent): StandardExplicitParent | undefined {
        if (!this._payload && !incoming._payload) {
            return undefined
        }
        if (!this._payload) {
            return incoming
        }
        if (!incoming._payload) {
            return this
        }
        // Check for Remove + Add mismatch (Parent-specific constraint)
        const thisDelta = this._payload._delta
        const incomingDelta = incoming._payload._delta
        if (thisDelta.remove && incomingDelta.add && thisDelta.remove !== incomingDelta.add) {
            // For Parent values, Remove + Add with different values is an error
            throw new MergeConflictError('Parent values can only be removed or replaced if they match exactly. Partial matches are not allowed.')
        }
        if (incomingDelta.remove && thisDelta.add && incomingDelta.remove !== thisDelta.add) {
            // For Parent values, Remove + Add with different values is an error
            throw new MergeConflictError('Parent values can only be removed or replaced if they match exactly. Partial matches are not allowed.')
        }
        const merged = this._payload.merge(incoming._payload)
        if (merged) {
            return new StandardExplicitParent(merged)
        }
        return undefined
    }
    diff(incoming: StandardExplicitParent | undefined): StandardExplicitParent | undefined {
        if (!incoming) {
            if (this._payload) {
                const reversedDelta = this._payload._delta
                if (reversedDelta) {
                    if (reversedDelta.add) {
                        return new StandardExplicitParent(new StandardExplicitParentRemove(new StandardExplicitParentSimpleBase(reversedDelta.add)))
                    }
                    if (reversedDelta.remove) {
                        return new StandardExplicitParent(new StandardExplicitParentSimple(new StandardExplicitParentSimpleBase(reversedDelta.remove)))
                    }
                }
            }
            return undefined
        }
        if (!this._payload && !incoming._payload) {
            return undefined
        }
        if (!this._payload) {
            // This has no parent, incoming has a parent - return incoming as the diff
            return incoming
        }
        if (!incoming._payload) {
            // This has a parent, incoming has no parent - return removal of this
            const reversedDelta = this._payload._delta
            if (reversedDelta && reversedDelta.add) {
                return new StandardExplicitParent(new StandardExplicitParentRemove(new StandardExplicitParentSimpleBase(reversedDelta.add)))
            }
            return undefined
        }
        const diffResult = this._payload.diff(incoming._payload)
        if (diffResult) {
            return new StandardExplicitParent(diffResult)
        }
        return undefined
    }
    mapContents(callback: (incoming: ComponentUUID) => ComponentUUID): StandardExplicitParent {
        if (!this._payload) {
            return this
        }
        if (this._payload instanceof StandardExplicitParentSimple) {
            return new StandardExplicitParent(callback(this._payload.payload.data))
        }
        if (this._payload instanceof StandardExplicitParentRemove) {
            return new StandardExplicitParent(new StandardExplicitParentRemove(new StandardExplicitParentSimpleBase(callback(this._payload.match.data))))
        }
        if (this._payload instanceof StandardExplicitParentReplace) {
            return new StandardExplicitParent(new StandardExplicitParentReplace(
                new StandardExplicitParentSimpleBase(callback(this._payload.match.data)),
                new StandardExplicitParentSimpleBase(callback(this._payload.payload.data))
            ))
        }
        throw new Error('Invalid StandardExplicitParent payload')
    }
}

