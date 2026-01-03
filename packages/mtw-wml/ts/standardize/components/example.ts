import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import linkReferenceKeys, { ReferenceFormat } from "./utils/references"
import { StandardRender } from "../render"
import { rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { StandardToJSONOptions } from "./baseClasses"
import { StandardExampleData, StandardExampleNDJSONData } from "./dataTypes/example"
import { AssetUUID, ComponentUUID, isSchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { deepEqual } from "../../lib/objects"
import { renderTreeToSchema, schemaToRenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardKey } from "../keys/key"
import StandardReference from "../keys/reference"
import { StandardExplicitParent } from "../explicit"

export class StandardExamplePayload implements ComponentConstructorMethods<StandardExampleNDJSONData | StandardExampleData> {
    _name?: StandardRender;
    _summary?: StandardRender;
    _description?: StandardRender;
    tag = 'Example' as const

    constructor(previous?: StandardExamplePayload) {
        if (previous) {
            this._name = previous._name
            this._summary = previous._summary
            this._description = previous._description
        }
    }

    fromJSON(props: StandardExampleData | StandardExampleNDJSONData) {
        const { name, summary, description } = props
        this._name = name ? new StandardRender(name) : undefined
        this._summary = summary ? new StandardRender(summary) : undefined
        this._description = description ? new StandardRender(description) : undefined
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaExample)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = tagTree.filter({ match: 'Name' }).prune({ match: 'Name' }).tree.filter(wrappedNodeTypeGuard(isSchemaOutputTag))
            const summaryItem = tagTree.filter({ match: 'Summary' }).prune({ match: 'Summary' }).tree.filter(wrappedNodeTypeGuard(isSchemaOutputTag))
            const descriptionItem = tagTree.filter({ match: 'Description' }).prune({ match: 'Description' }).tree.filter(wrappedNodeTypeGuard(isSchemaOutputTag))
            if (nameItem.length) {
                this._name = new StandardRender(nameItem)
            }
            if (summaryItem.length) {
                this._summary = new StandardRender(summaryItem)
            }
            if (descriptionItem.length) {
                this._description = new StandardRender(descriptionItem)
            }
            return
        }
        throw new Error('Schema mismatch in StandardExample constructor')
    }

    get name() { return this._name }
    get summary() { return this._summary }
    get description() { return this._description }

    toJSON(options?: StandardToJSONOptions): Omit<StandardExampleData, 'key' | 'universalKey'> {
        const { stripUIFields: stripUI } = options ?? {}
        return {
            tag: 'Example',
            name: this._name?.toJSON(),
            summary: this._summary?.toJSON(),
            description: this._description?.toJSON()
        }
    }

    toNDJSON(options?: StandardToJSONOptions): Omit<StandardExampleNDJSONData, 'key' | 'universalKey'> {
        return {
            tag: 'Example',
            name: this._name?.toJSON(),
            summary: this._summary?.toJSON(),
            description: this._description?.toJSON()
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        const children = [
            rebuildSchemaFromStandardRender(this._name, { tag: 'Name' }, mappings),
            rebuildSchemaFromStandardRender(this._summary, { tag: 'Summary' }, mappings),
            rebuildSchemaFromStandardRender(this._description, { tag: 'Description' }, mappings)
        ].filter(excludeUndefined)
        return {
            data: { tag: 'Example', key, uuid: universalKey },
            children
        }
    }

    subset({ requestType }): this {
        if (requestType === 'Full') {
            return new StandardExamplePayload(this) as this
        }
        const returnValue = new StandardExamplePayload()
        return returnValue as this
    }

    merge(incoming: this): this {
        const returnValue = new StandardExamplePayload()
        returnValue._name = (this._name && incoming._name) ? this._name.merge(incoming._name) : this._name ?? incoming._name
        returnValue._summary = (this._summary && incoming._summary) ? this._summary.merge(incoming._summary) : this._summary ?? incoming._summary
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
        return returnValue as this
    }

    referencedKeys(mapping: StandardReference[]): StandardComponentReferenceKey[] {
        const renderTrees = [this._name?.toJSON(), this._summary?.toJSON(), this._description?.toJSON()].filter(excludeUndefined)
        return [
            ...linkReferenceKeys(mapping)(renderTreeToSchema(renderTrees.flat(1)))
                .map((reference) => ({ referenceType: 'Link' as const, reference }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardExamplePayload(this)
        if (returnValue._name) {
            returnValue._name = returnValue._name.mapContents((renderTree) => (schemaToRenderTree(callback(renderTreeToSchema(renderTree)))))
        }
        if (returnValue._summary) {
            returnValue._summary = returnValue._summary.mapContents((renderTree) => (schemaToRenderTree(callback(renderTreeToSchema(renderTree)))))
        }
        if (returnValue._description) {
            returnValue._description = returnValue._description.mapContents((renderTree) => (schemaToRenderTree(callback(renderTreeToSchema(renderTree)))))
        }
        return returnValue as this
    }
    
    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardExamplePayload(this)
        returnValue._name = returnValue._name?.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        returnValue._summary = returnValue._summary?.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        returnValue._description = returnValue._description?.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        return returnValue as this
    }

    invert(): this {
        const returnValue = new StandardExamplePayload()
        returnValue._name = this._name ? this._name.invert() : undefined
        returnValue._summary = this._summary ? this._summary.invert() : undefined
        returnValue._description = this._description ? this._description.invert() : undefined
        return returnValue as this
    }

    isEmpty(): boolean {
        // An example is empty if it has no name, summary, or description
        const hasName = Boolean(this._name)
        const hasSummary = Boolean(this._summary)
        const hasDescription = Boolean(this._description)
        return !(hasName || hasSummary || hasDescription)
    }

}

export class StandardExample extends componentClassFactory(StandardExamplePayload, 'StandardExample') {
    get name() { return this._payload.name }
    get summary() { return this._payload.summary }
    get description() { return this._payload.description }

    constructor(props: string | StandardExampleData | StandardExampleNDJSONData | GenericTreeNode<SchemaTag> | StandardExample) {
        super(props)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardExample(instance as StandardExample) as this
    }

    override clone(): StandardExample {
        const returnValue = new StandardExample(this)
        returnValue._payload = new StandardExamplePayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardExample)) {
            return false
        }
        return deepEqual(this.toJSON(), incoming.toJSON())
    }

}

export default StandardExample
