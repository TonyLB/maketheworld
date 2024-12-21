import { excludeUndefined } from "../../lib/lists"
import { isSchemaDescription, isSchemaFeature, isSchemaName, isSchemaOutputTag, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardFeatureData } from "./dataTypes/feature"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { outputNodeToStandardItem } from "./utils/constructor"
import linkReferenceKeys, { dependencyReferenceKeys } from "./utils/references"
import { combineTaggedChildren } from "./utils/merge"
import { applyTreeCallbackToNode } from "./utils/mapContents"

export class StandardFeaturePayload implements ComponentConstructorMethods<StandardFeatureData> {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    _global?: boolean;
    tag = 'Feature' as const

    constructor(previous?: StandardFeaturePayload) {
        if (previous) {
            this._name = previous.name
            this._description = previous.description
        }
    }

    fromJSON(props: StandardFeatureData) {
        this._name = props.name
        this._description = props.description
        this._global = props.global
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaFeature)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
            const descriptionItem = tagTree.filter({ match: 'Description' }).tree.find(wrappedNodeTypeGuard(isSchemaDescription))
            this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' }),
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
            this._global = node.data.global
            return
        }
        throw new Error('Schema mismatch in StandardFeature constructor')
    }

    get name() { return this._name }
    get description() { return this._description }
    get global() { return this._global }

    toJSON(): Omit<StandardFeatureData, 'key' | 'universalKey'> {
        return {
            tag: 'Feature',
            name: this.name,
            description: this.description,
            ...(this.global ? { global: true } : {})
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Feature', key, global: this.global },
            children: [this.name, this.description].filter(excludeUndefined).filter(({ children }) => (children.length))
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardFeaturePayload()
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
        const returnValue = new StandardFeaturePayload(this)
        returnValue._description = applyTreeCallbackToNode(callback)(returnValue._description) as GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag> | undefined
        returnValue._name = applyTreeCallbackToNode(callback)(returnValue._name) as GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag> | undefined
        return returnValue as this
    }
}

export class StandardFeature extends componentClassFactory(StandardFeaturePayload, 'StandardFeature') {
    get name() { return this._payload.name }
    get description() { return this._payload.description }
    get global() { return this._payload.global }

    override clone(): StandardFeature {
        const returnValue = new StandardFeature(this)
        returnValue._payload = new StandardFeaturePayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardFeature(super.merge(incoming) as StandardFeature)
    }

    override withUniversalKey(key: string): StandardComponent {
        return new StandardFeature(super.withUniversalKey(key) as StandardFeature)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardFeature(super.withFileName(key) as StandardFeature)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardFeature(super.withImport(importData) as StandardFeature)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardFeature(super.withExport(exportData) as StandardFeature)
    }

}

export default StandardFeature
