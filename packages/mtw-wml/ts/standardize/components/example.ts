import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent } from "./baseClasses"
import linkReferenceKeys, { dependencyReferenceKeys, ReferenceFormat } from "./utils/references"
import { StandardRender } from "../render"
import { rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { StandardToJSONOptions } from "./baseClasses"
import { StandardExampleData, StandardExampleNDJSONData } from "./dataTypes/example"
import { AssetUUID, ComponentUUID, isSchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { deepEqual } from "../../lib/objects"
import { renderTreeToSchema, schemaToRenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardKey } from "./reference"
import StandardReference from "./reference"

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

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        const children = [
            rebuildSchemaFromStandardRender(this._name, { tag: 'Name' }),
            rebuildSchemaFromStandardRender(this._summary, { tag: 'Summary' }),
            rebuildSchemaFromStandardRender(this._description, { tag: 'Description' })
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

    referencedKeys(mapping: StandardKey[]): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        const renderTrees = [this._name?.toJSON(), this._summary?.toJSON(), this._description?.toJSON()].filter(excludeUndefined)
        return [
            ...linkReferenceKeys(mapping)(renderTreeToSchema(renderTrees.flat(1)))
                .map((key) => ({ referenceType: 'Link' as const, key })),
            ...dependencyReferenceKeys(renderTreeToSchema(renderTrees.flat(1)))
                .map((key) => ({ referenceType: 'Dependency' as const, key: new StandardKey(key) }))
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
    
    remapReferences(props: { mappings: StandardKey[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardExamplePayload(this)
        returnValue._name = returnValue._name?.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        returnValue._summary = returnValue._summary?.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        returnValue._description = returnValue._description?.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        return returnValue as this
    }

}

export class StandardExample extends componentClassFactory(StandardExamplePayload, 'StandardExample') {
    get name() { return this._payload.name }
    get summary() { return this._payload.summary }
    get description() { return this._payload.description }

    constructor(props: string | StandardExampleData | StandardExampleNDJSONData | GenericTreeNode<SchemaTag> | StandardExample) {
        super(props)
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

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardExample(super.merge(incoming) as StandardExample)
    }

    override diff(incoming: StandardComponent): StandardComponent | undefined {
        if (!(incoming instanceof StandardExample)) {
            throw new Error('Mismatched component types in diff')
        }
        if (deepEqual(this.toJSON(), incoming.toJSON())) {
            return undefined
        }
        const base = this.clone()
        base._payload = new StandardExamplePayload()
        base._payload._name = this._payload._name
            ? this._payload._name.diff(incoming._payload._name)
            : incoming._payload._name
        base._payload._summary = this._payload._summary
            ? this._payload._summary.diff(incoming._payload._summary)
            : incoming._payload._summary
        base._payload._description = this._payload._description
            ? this._payload._description.diff(incoming._payload._description)
            : incoming._payload._description
        return base
    }

    override withKey(key: string): StandardComponent {
        return new StandardExample(super.withKey(key) as StandardExample)
    }

    override withUniversalKey(key: ComponentUUID): StandardComponent {
        return new StandardExample(super.withUniversalKey(key) as StandardExample)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardExample(super.withFileName(key) as StandardExample)
    }

    override withMapping(mapping: StandardKey[]): StandardComponent {
        return new StandardExample(super.withMapping(mapping) as StandardExample)
    }

    override withImport(fromAsset: AssetUUID): StandardComponent {
        return new StandardExample(super.withImport(fromAsset) as StandardExample)
    }

    override withLeastCommonContext(leastCommonContext: StandardKey[]): StandardComponent {
        return new StandardExample(super.withLeastCommonContext(leastCommonContext) as StandardExample)
    }

    override withChild(child: StandardReference): StandardComponent {
        return new StandardExample(super.withChild(child) as StandardExample)
    }

}

export default StandardExample
