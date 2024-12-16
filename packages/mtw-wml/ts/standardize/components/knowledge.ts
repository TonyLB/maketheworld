import { excludeUndefined } from "../../lib/lists"
import { isSchemaDescription, isSchemaKnowledge, isSchemaName, isSchemaOutputTag, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { outputNodeToStandardItem } from "./utils/constructor"
import linkReferenceKeys, { dependencyReferenceKeys } from "./utils/references"
import { combineTaggedChildren } from "./utils/merge"
import { applyTreeCallbackToNode } from "./utils/mapContents"

export class StandardKnowledgePayload implements ComponentConstructorMethods<StandardKnowledgeData> {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    tag = 'Knowledge' as const

    constructor(previous?: StandardKnowledgePayload) {
        if (previous) {
            this._name = previous.name
            this._description = previous.description
        }
    }

    fromJSON(props: StandardKnowledgeData) {
        this._name = props.name
        this._description = props.description
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaKnowledge)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
            const descriptionItem = tagTree.filter({ match: 'Description' }).tree.find(wrappedNodeTypeGuard(isSchemaDescription))
            this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' }),
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
            return
        }
        throw new Error('Schema mismatch in StandardKnowledge constructor')
    }

    get name() { return this._name }
    get description() { return this._description }

    toJSON(): Omit<StandardKnowledgeData, 'key' | 'universalKey'> {
        return {
            tag: 'Knowledge',
            name: this.name,
            description: this.description
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Knowledge', key },
            children: [this.name, this.description].filter(excludeUndefined).filter(({ children }) => (children.length))
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardKnowledgePayload()
        returnValue._name = combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>
        returnValue._description = combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...linkReferenceKeys(this.description ? [this.description] : [])
                .map((key) => ({ referenceType: 'Link' as const, key })),
            ...dependencyReferenceKeys(this.description ? [this.description] : [])
                .map((key) => ({ referenceType: 'Dependency' as const, key }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardKnowledgePayload(this)
        returnValue._description = applyTreeCallbackToNode(callback)(returnValue._description) as GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag> | undefined
        returnValue._name = applyTreeCallbackToNode(callback)(returnValue._name) as GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag> | undefined
        return returnValue as this
    }
}

export class StandardKnowledge extends componentClassFactory(StandardKnowledgePayload, 'StandardKnowledge') {
    get name() { return this._payload.name }
    get description() { return this._payload.description }

    override clone(): StandardKnowledge {
        const returnValue = new StandardKnowledge(this)
        returnValue._payload = new StandardKnowledgePayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardKnowledge(super.merge(incoming) as StandardKnowledge)
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
