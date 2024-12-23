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
import { StandardRender } from "../render"
import { extractStandardRender, rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { stripUIFields } from "../render/utils"

export class StandardKnowledgePayload implements ComponentConstructorMethods<StandardKnowledgeData> {
    _name?: StandardRender;
    _description?: StandardRender;
    tag = 'Knowledge' as const

    constructor(previous?: StandardKnowledgePayload) {
        if (previous) {
            this._name = previous._name
            this._description = previous._description
        }
    }

    fromJSON(props: StandardKnowledgeData) {
        const { name, description } = props
        this._name = extractStandardRender(name, isSchemaName, 'Schema mismatch in StandardKnowledge constructor')
        this._description = extractStandardRender(description, isSchemaDescription, 'Schema mismatch in StandardKnowledge constructor')
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaKnowledge)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
            const descriptionItem = tagTree.filter({ match: 'Description' }).tree.find(wrappedNodeTypeGuard(isSchemaDescription))
            this._name = extractStandardRender(nameItem as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>, isSchemaName, 'Schema mismatch in StandardKnowledge constructor')
            this._description = extractStandardRender(descriptionItem as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>, isSchemaDescription, 'Schema mismatch in StandardKnowledge constructor')
            return
        }
        throw new Error('Schema mismatch in StandardKnowledge constructor')
    }

    get name() { return rebuildSchemaFromStandardRender(this._name, { tag: 'Name' as const }) }
    get description() { return rebuildSchemaFromStandardRender(this._description, { tag: 'Description' as const }) }
    
    toJSON(options): Omit<StandardKnowledgeData, 'key' | 'universalKey'> {
        const { stripUIFields: stripUI } = options ?? {}
        return {
            tag: 'Knowledge',
            name: stripUI
                ? rebuildSchemaFromStandardRender(this._name?.mapContents(stripUIFields), { tag: 'Name' as const })
                : this.name,
            description: stripUI
                ? rebuildSchemaFromStandardRender(this._description?.mapContents(stripUIFields), { tag: 'Description' as const })
                : this.description
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
        returnValue._name = (this._name && incoming._name) ? this._name.merge(incoming._name) : this._name ?? incoming._name
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
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
