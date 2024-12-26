import { excludeUndefined } from "../../lib/lists"
import { isSchemaExample, isSchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardExportItem, StandardImportItem } from "./metaData"
import linkReferenceKeys, { dependencyReferenceKeys } from "./utils/references"
import { StandardRender } from "../render"
import { rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { stripUIFields } from "../render/utils"
import { StandardToJSONOptions } from "./baseClasses"
import { StandardExampleData } from "./dataTypes/example"

export class StandardExamplePayload implements ComponentConstructorMethods<StandardExampleData> {
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

    fromJSON(props: StandardExampleData) {
        const { name, summary, description } = props
        this._name = new StandardRender(name)
        this._summary = new StandardRender(summary)
        this._description = new StandardRender(description)
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaExample)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = tagTree.filter({ match: 'Name' }).prune({ match: 'Name' }).tree.filter(wrappedNodeTypeGuard(isSchemaOutputTag))
            const summaryItem = tagTree.filter({ match: 'Summary' }).prune({ match: 'Summary' }).tree.filter(wrappedNodeTypeGuard(isSchemaOutputTag))
            const descriptionItem = tagTree.filter({ match: 'Description' }).prune({ match: 'Description' }).tree.filter(wrappedNodeTypeGuard(isSchemaOutputTag))
            if (nameItem) {
                this._name = new StandardRender(nameItem)
            }
            if (summaryItem) {
                this._summary = new StandardRender(summaryItem)
            }
            if (descriptionItem) {
                this._description = new StandardRender(descriptionItem)
            }
            return
        }
        throw new Error('Schema mismatch in StandardExample constructor')
    }

    get name() { return this._name?.toJSON() }
    get summary() { return this._summary?.toJSON() }
    get description() { return this._description?.toJSON() }

    toJSON(options?: StandardToJSONOptions): Omit<StandardExampleData, 'key' | 'universalKey'> {
        const { stripUIFields: stripUI } = options ?? {}
        return {
            tag: 'Example',
            name: stripUI
                ? this._name?.mapContents(stripUIFields).toJSON()
                : this._name?.toJSON(),
            summary: stripUI
                ? this._summary?.mapContents(stripUIFields).toJSON()
                : this._summary?.toJSON(),
            description: stripUI
                ? this._description?.mapContents(stripUIFields).toJSON()
                : this._description?.toJSON()
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Example', key },
            children: [
                rebuildSchemaFromStandardRender(this._name, { tag: 'Name' }),
                rebuildSchemaFromStandardRender(this._summary, { tag: 'Summary' }),
                rebuildSchemaFromStandardRender(this._description, { tag: 'Description' })
            ].filter(excludeUndefined)
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardExamplePayload()
        returnValue._name = (this._name && incoming._name) ? this._name.merge(incoming._name) : this._name ?? incoming._name
        returnValue._summary = (this._summary && incoming._summary) ? this._summary.merge(incoming._summary) : this._summary ?? incoming._summary
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...linkReferenceKeys([this.name, this.summary, this.description].filter(excludeUndefined).flat(1))
                .map((key) => ({ referenceType: 'Link' as const, key })),
            ...dependencyReferenceKeys([this.name, this.summary, this.description].filter(excludeUndefined).flat(1))
                .map((key) => ({ referenceType: 'Dependency' as const, key }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardExamplePayload(this)
        if (returnValue._name) {
            returnValue._name = returnValue._name.mapContents(callback)
        }
        if (returnValue._summary) {
            returnValue._summary = returnValue._summary.mapContents(callback)
        }
        if (returnValue._description) {
            returnValue._description = returnValue._description.mapContents(callback)
        }
        return returnValue as this
    }
}

export class StandardExample extends componentClassFactory(StandardExamplePayload, 'StandardExample') {
    get name() { return this._payload.name }
    get summary() { return this._payload.summary }
    get description() { return this._payload.description }

    constructor(props: string | StandardExampleData | GenericTreeNode<SchemaTag> | StandardExample) {
        super(props)
    }

    override clone(): StandardExample {
        const returnValue = new StandardExample(this)
        returnValue._payload = new StandardExamplePayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardExample(super.merge(incoming) as StandardExample)
    }

    override withKey(key: string): StandardComponent {
        return new StandardExample(super.withKey(key) as StandardExample)
    }

    override withUniversalKey(key: string): StandardComponent {
        return new StandardExample(super.withUniversalKey(key) as StandardExample)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardExample(super.withFileName(key) as StandardExample)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardExample(super.withImport(importData) as StandardExample)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardExample(super.withExport(exportData) as StandardExample)
    }

}

export default StandardExample
