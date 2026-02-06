import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import linkReferenceKeys, { ReferenceFormat, childReferenceFactory } from "./utils/references"
import { StandardRender } from "../render"
import { rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { StandardToJSONOptions } from "./baseClasses"
import { StandardMarkData } from "./dataTypes/mark"
import { StandardLensData } from "./dataTypes/lens"
import { AssetUUID, ComponentUUID, isSchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaMark, isSchemaLens } from "@tonylb/mtw-base/ts/schema/worldState"
import { deepEqual } from "../../lib/objects"
import { renderTreeToSchema, schemaToRenderTree, RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardKey } from "../keys/key"
import StandardReference from "../keys/reference"
import { HasShortName } from "./abstract"
import { StandardLiteral } from "../literal"
import { ReferenceList } from "../keys/referenceList"
import { renderReference } from "./utils/schema"
import { StandardEditableData, extractFromEditableData } from "@tonylb/mtw-base/ts/editable"
import {
    processWithConsumers,
    StandardizeConsumerInline,
    StandardizeConsumerReferenceList,
    StandardizeConsumerRender,
    StandardizeConsumerStandardLiteral,
} from "./fromSchemaPipeline"
import { SchemaDescriptionTag, isSchemaDescription } from "@tonylb/mtw-base/ts/schema/example"

export class StandardMarkPayload implements HasShortName, ComponentConstructorMethods<StandardMarkData> {
    _shortName?: StandardLiteral;
    _description?: StandardRender;
    tag = 'Mark' as const

    constructor(previous?: StandardMarkPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._description = previous._description
        }
    }

    fromJSON(props: StandardMarkData) {
        const { shortName, description } = props
        this._shortName = shortName ? new StandardLiteral(shortName, { tag: 'ShortName' }) : undefined
        this._description = description ? new StandardRender(description) : undefined
    }

    fromSchema(node: GenericTreeNode<SchemaTag>): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaMark)(node)) {
            const consumers = [
                new StandardizeConsumerStandardLiteral<StandardMarkPayload>(this, {
                    tag: "ShortName",
                    update(literal) {
                        this._shortName = literal
                    },
                }),
                new StandardizeConsumerRender<StandardMarkPayload, SchemaDescriptionTag>(this, {
                    tag: "Description",
                    nodeTypeGuard: isSchemaDescription,
                    errorMessage: "Schema mismatch in StandardMark constructor",
                    update(render) {
                        this._description = render
                    },
                }),
            ]
            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardMark constructor')
    }

    get shortName() { return this._shortName }
    get description() { return this._description }

    toJSON(options?: StandardToJSONOptions): Omit<StandardMarkData, 'key' | 'universalKey'> {
        const result: Omit<StandardMarkData, 'key' | 'universalKey'> = {
            tag: 'Mark' as const,
            ...(this?.shortName ? { shortName: this.shortName.toJSON() } : {}),
            ...(this?.description ? { description: this.description.toJSON() } : {})
        }
        return result
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        const children = [
            ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
            rebuildSchemaFromStandardRender(this._description, { tag: 'Description' }, mappings)
        ].filter(excludeUndefined)
        return {
            data: { tag: 'Mark', key, uuid: universalKey },
            children
        }
    }

    subset(): this {
        return new StandardMarkPayload() as this
    }

    merge(incoming: this): this {
        const returnValue = new StandardMarkPayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
        return returnValue as this
    }

    referencedKeys(mapping: StandardReference[]): StandardComponentReferenceKey[] {
        // Extract all RenderTree values from StandardEditableData<RenderTree>
        const editableData = [this._description?.toJSON()].filter(excludeUndefined) as StandardEditableData<RenderTree>[]
        const renderTrees = editableData.flatMap(extractFromEditableData<RenderTree>)
        return [
            ...linkReferenceKeys(mapping)(renderTreeToSchema(renderTrees.flat(1)))
                .map((reference) => ({ referenceType: 'Link' as const, reference }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardMarkPayload(this)
        if (returnValue._description) {
            returnValue._description = returnValue._description.mapContents((renderTree) => (schemaToRenderTree(callback(renderTreeToSchema(renderTree)))))
        }
        return returnValue as this
    }
    
    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardMarkPayload(this)
        returnValue._description = returnValue._description?.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        return returnValue as this
    }

    invert(): this {
        const returnValue = new StandardMarkPayload()
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        returnValue._description = this._description ? this._description.invert() : undefined
        return returnValue as this
    }

    isEmpty(): boolean {
        // A mark is empty if it has no shortName and no description
        const hasShortName = Boolean(this._shortName)
        const hasDescription = Boolean(this._description)
        return !(hasShortName || hasDescription)
    }

}

export class StandardMark extends componentClassFactory(StandardMarkPayload, 'StandardMark') {
    get shortName() { return this._payload.shortName }
    get description() { return this._payload.description }

    constructor(props: string | StandardMarkData | GenericTreeNode<SchemaTag> | StandardMark) {
        super(props)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardMark(instance as StandardMark) as this
    }

    override clone(): StandardMark {
        const returnValue = new StandardMark(this)
        returnValue._payload = new StandardMarkPayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardMark)) {
            return false
        }
        return deepEqual(this.toJSON(), incoming.toJSON())
    }

}

export default StandardMark

export class StandardLensPayload implements HasShortName, ComponentConstructorMethods<StandardLensData> {
    _shortName?: StandardLiteral;
    _description?: StandardRender;
    _marks: ReferenceList;
    tag = 'Lens' as const

    constructor(previous?: StandardLensPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._description = previous._description
            this._marks = previous._marks.clone()
        }
        else {
            this._marks = new ReferenceList([])
        }
    }

    fromJSON(props: StandardLensData) {
        const { shortName, description, marks } = props
        this._shortName = shortName ? new StandardLiteral(shortName, { tag: 'ShortName' }) : undefined
        this._description = description ? new StandardRender(description) : undefined
        this._marks = new ReferenceList(marks?.map((reference) => (new StandardReference(reference))) ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaLens)(node)) {
            const consumers = [
                new StandardizeConsumerStandardLiteral<StandardLensPayload>(this, {
                    tag: "ShortName",
                    update(literal) {
                        this._shortName = literal
                    },
                }),
                new StandardizeConsumerRender<StandardLensPayload, SchemaDescriptionTag>(this, {
                    tag: "Description",
                    nodeTypeGuard: isSchemaDescription,
                    errorMessage: "Schema mismatch in StandardLens constructor",
                    update(render) {
                        this._description = render
                    },
                }),
                new StandardizeConsumerReferenceList<StandardLensPayload>(this, {
                    tag: "Mark",
                    update(list) {
                        this._marks = list
                    },
                }),
                new StandardizeConsumerInline(),
            ]
            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardLens constructor')
    }

    get shortName() { return this._shortName }
    get description() { return this._description }
    get marks() { return this._marks }

    toJSON(options?: StandardToJSONOptions): Omit<StandardLensData, 'key' | 'universalKey'> {
        return {
            tag: 'Lens' as const,
            ...(this?.shortName ? { shortName: this.shortName.toJSON() } : {}),
            ...(this?.description ? { description: this.description.toJSON() } : {}),
            ...(this.marks.payload.length ? { marks: this.marks.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Lens', key, uuid: universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema())).flat(1),
                rebuildSchemaFromStandardRender(this._description, { tag: 'Description' }, mappings),
                ...this.marks.schema
            ].filter(excludeUndefined)
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        
        // If organization is available, use assured references from organization
        // Otherwise, fall back to stored reference lists
        let marksToRender = this.marks
        
        if (options.organization) {
            // Get children from organization and assure references
            const children = options.organization.getChildrenOfParent(key) ?? []
            const { payload: assured, inlineRemainder } = this.assureReferences(children)
            marksToRender = assured.marks
            // inlineRemainder available for Phase 2 Item 2 (not used yet)
        }
        
        return {
            data: { tag: 'Lens', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema())).flat(1),
                rebuildSchemaFromStandardRender(this._description, { tag: 'Description' }, options.mappings),
                ...marksToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined)
            ].filter(excludeUndefined)
        }
    }

    subset(): this {
        return new StandardLensPayload() as this
    }

    merge(incoming: this): this {
        const returnValue = new StandardLensPayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
        returnValue._marks = this._marks.merge(incoming._marks) ?? new ReferenceList([])
        return returnValue as this
    }

    referencedKeys(mapping: StandardReference[]): StandardComponentReferenceKey[] {
        // Extract all RenderTree values from StandardEditableData<RenderTree>
        const editableData = [this._description?.toJSON()].filter(excludeUndefined) as StandardEditableData<RenderTree>[]
        const renderTrees = editableData.flatMap(extractFromEditableData<RenderTree>)
        return [
            ...this._marks.payload.map((reference) => ({ referenceType: 'Direct' as const, reference })),
            ...linkReferenceKeys(mapping)(renderTreeToSchema(renderTrees.flat(1)))
                .map((reference) => ({ referenceType: 'Link' as const, reference }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardLensPayload(this)
        if (returnValue._description) {
            returnValue._description = returnValue._description.mapContents((renderTree) => (schemaToRenderTree(callback(renderTreeToSchema(renderTree)))))
        }
        // Reference lists are not mapped in mapContents
        return returnValue as this
    }
    
    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardLensPayload(this)
        returnValue._description = returnValue._description?.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        returnValue._marks = returnValue._marks.lookup(props.mappings).toFormat(props.mapTo)
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardLensPayload(this)
        if (child.tag === 'Mark') {
            returnValue._marks = returnValue._marks.assureItem(child)
        }
        else {
            throw new Error(`Invalid child type ${child.tag} for StandardLens`)
        }
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        const BUCKET_TAGS = ['Mark'] as const
        const bucketChildren = children.filter(c => BUCKET_TAGS.includes(c.tag as (typeof BUCKET_TAGS)[number]))
        const remainder = children.filter(c => !BUCKET_TAGS.includes(c.tag as (typeof BUCKET_TAGS)[number]))

        const returnValue = new StandardLensPayload(this)
        const markReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Mark').map(child => child.withRef(0))
        )
        returnValue._marks = this._marks.merge(markReferences, { cleanEmptyReferences: false }) ?? this._marks

        return {
            payload: returnValue as this,
            inlineRemainder: remainder.map(c => c.withRef(0))
        }
    }

    invert(): this {
        const returnValue = new StandardLensPayload()
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        returnValue._description = this._description ? this._description.invert() : undefined
        returnValue._marks = this._marks.invert()
        return returnValue as this
    }

    isEmpty(): boolean {
        // A lens is empty if it has no shortName, no description, and no marks
        const hasShortName = Boolean(this._shortName)
        const hasDescription = Boolean(this._description)
        const hasMarks = this._marks.payload.length > 0
        return !(hasShortName || hasDescription || hasMarks)
    }
}

export class StandardLens extends componentClassFactory(StandardLensPayload, 'StandardLens') {
    get shortName() { return this._payload.shortName }
    get description() { return this._payload.description }
    get marks() { return this._payload.marks }

    constructor(props: string | StandardLensData | GenericTreeNode<SchemaTag> | StandardLens) {
        super(props)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardLens(instance as StandardLens) as this
    }

    override clone(): StandardLens {
        const returnValue = new StandardLens(this)
        returnValue._payload = new StandardLensPayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardLens)) {
            return false
        }
        return deepEqual(this.toJSON(), incoming.toJSON())
    }
}
