import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent } from "./baseClasses"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardExportItem, StandardImportItem } from "./metaData"
import linkReferenceKeys, { dependencyReferenceKeys, mergeUniqueReferences } from "./utils/references"
import { StandardRender } from "../render"
import { extractStandardRender, rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { stripUIFields } from "../render/utils"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { isSchemaDescription, isSchemaExample, isSchemaName, SchemaDescriptionTag, SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example"
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaKnowledge } from "@tonylb/mtw-base/ts/schema/components"
import { StandardRemove } from "./edits"

export class StandardKnowledgePayload implements ComponentConstructorMethods<StandardKnowledgeData> {
    _name?: StandardRender;
    _description?: StandardRender;
    _examples: (StandardReference | StandardRemove)[] = [];
    tag = 'Knowledge' as const

    constructor(previous?: StandardKnowledgePayload) {
        if (previous) {
            this._name = previous._name
            this._description = previous._description
            this._examples = previous._examples
        }
    }

    fromJSON(props: StandardKnowledgeData) {
        const { name, description, examples } = props
        this._name = extractStandardRender(name, isSchemaName, 'Schema mismatch in StandardKnowledge constructor')
        this._description = extractStandardRender(description, isSchemaDescription, 'Schema mismatch in StandardKnowledge constructor')
        this._examples = examples?.map((example) => new StandardReference(example)) ?? []
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaKnowledge)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
            const descriptionItem = tagTree.filter({ match: 'Description' }).tree.find(wrappedNodeTypeGuard(isSchemaDescription))
            this._name = extractStandardRender<SchemaNameTag>(nameItem as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>, isSchemaName, 'Schema mismatch in StandardKnowledge constructor')
            this._description = extractStandardRender<SchemaDescriptionTag>(descriptionItem as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>, isSchemaDescription, 'Schema mismatch in StandardKnowledge constructor')
            this._examples = node.children.filter(treeNodeTypeguard(isSchemaExample)).map((reference) => (new StandardReference(reference)))
            return
        }
        throw new Error('Schema mismatch in StandardKnowledge constructor')
    }

    get name() { return rebuildSchemaFromStandardRender(this._name, { tag: 'Name' as const }) }
    get description() { return rebuildSchemaFromStandardRender(this._description, { tag: 'Description' as const }) }
    get examples() { return this._examples }

    toJSON(options: StandardToJSONOptions): Omit<StandardKnowledgeData, 'key' | 'universalKey'> {
        const { stripUIFields: stripUI } = options ?? {}
        return {
            tag: 'Knowledge',
            name: stripUI
                ? rebuildSchemaFromStandardRender(this._name?.mapContents(stripUIFields), { tag: 'Name' as const })
                : this.name,
            description: stripUI
                ? rebuildSchemaFromStandardRender(this._description?.mapContents(stripUIFields), { tag: 'Description' as const })
                : this.description,
            ...(this.examples.length ? { examples: this.examples.map((reference) => (reference.toJSON() as StandardReferenceData)) } : {})
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Knowledge', key },
            children: [
                ...this.examples.map((reference) => (reference.schema)),
                ...[this.name, this.description].filter(excludeUndefined).filter(({ children }) => (children.length))
            ]
        }
    }

    nestedSchema(byId: Record<string, StandardComponent>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { localKey, globalKey } = options
        return {
            data: { tag: 'Knowledge', key: localKey },
            children: [
                ...this.examples.map((reference) => (
                    reference.global
                        ? reference.schema
                        : byId[`${globalKey}.${reference.key}`]?.nestedSchema(byId, { ...options, localKey: reference.key, globalKey: `${globalKey}.${reference.key}` })
                )).filter(excludeUndefined),
                ...[this.name, this.description].filter(excludeUndefined).filter(({ children }) => (children.length))
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardKnowledgePayload()
        returnValue._name = (this._name && incoming._name) ? this._name.merge(incoming._name) : this._name ?? incoming._name
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
        returnValue._examples = mergeUniqueReferences(this.examples, incoming.examples)
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...linkReferenceKeys(this.description ? [this.description] : [])
                .map((key) => ({ referenceType: 'Link' as const, key })),
            ...dependencyReferenceKeys(this.description ? [this.description] : [])
                .map((key) => ({ referenceType: 'Dependency' as const, key })),
            ...this.examples.map(({ key }) => ({ referenceType: 'Direct' as const, key })),
            ...this.examples.map((example) => (example.referencedKeys())).flat(1)
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardKnowledgePayload(this)
        if (returnValue._name) {
            returnValue._name = returnValue._name.mapContents(callback)
        }
        if (returnValue._description) {
            returnValue._description = returnValue._description.mapContents(callback)
        }
        return returnValue as this
    }
}

export class StandardKnowledge extends componentClassFactory(StandardKnowledgePayload, 'StandardKnowledge') {
    get name() { return this._payload.name }
    get description() { return this._payload.description }
    get examples() { return this._payload.examples }

    override clone(): StandardKnowledge {
        const returnValue = new StandardKnowledge(this)
        returnValue._payload = new StandardKnowledgePayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardKnowledge(super.merge(incoming) as StandardKnowledge)
    }

    override withKey(key: string): StandardComponent {
        return new StandardKnowledge(super.withKey(key) as StandardKnowledge)
    }
    
    override withUniversalKey(key: string): StandardComponent {
        return new StandardKnowledge(super.withUniversalKey(key) as StandardKnowledge)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardKnowledge(super.withFileName(key) as StandardKnowledge)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardKnowledge(super.withImport(importData) as StandardKnowledge)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardKnowledge(super.withExport(exportData) as StandardKnowledge)
    }

}

export default StandardKnowledge
