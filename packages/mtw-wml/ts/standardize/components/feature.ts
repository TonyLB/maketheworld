import { excludeUndefined } from "../../lib/lists"
import { isSchemaDescription, isSchemaExample, isSchemaFeature, isSchemaName, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardFeatureData } from "./dataTypes/feature"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardExportItem, StandardImportItem } from "./metaData"
import linkReferenceKeys, { dependencyReferenceKeys, mergeUniqueReferences } from "./utils/references"
import { StandardRender } from "../render"
import { extractStandardRender, rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { stripUIFields } from "../render/utils"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference from "./reference"
import { StandardReferenceData } from "./dataTypes"

export class StandardFeaturePayload implements ComponentConstructorMethods<StandardFeatureData> {
    _name?: StandardRender;
    _description?: StandardRender;
    _examples: StandardReference[] = [];
    _global?: boolean;
    tag = 'Feature' as const

    constructor(previous?: StandardFeaturePayload) {
        if (previous) {
            this._name = previous._name
            this._description = previous._description
        }
    }

    fromJSON(props: StandardFeatureData) {
        const { name, description } = props
        this._name = extractStandardRender(name, isSchemaName, 'Schema mismatch in StandardFeature constructor')
        this._description = extractStandardRender(description, isSchemaDescription, 'Schema mismatch in StandardFeature constructor')
        this._examples = props.examples?.map((example) => new StandardReference(example)) ?? []
        this._global = props.global
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaFeature)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
            const descriptionItem = tagTree.filter({ match: 'Description' }).tree.find(wrappedNodeTypeGuard(isSchemaDescription))
            this._name = extractStandardRender<SchemaNameTag>(nameItem as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>, isSchemaName, 'Schema mismatch in StandardFeature constructor')
            this._description = extractStandardRender<SchemaDescriptionTag>(descriptionItem as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>, isSchemaDescription, 'Schema mismatch in StandardFeature constructor')
            this._examples = node.children.filter(treeNodeTypeguard(isSchemaExample)).map((reference) => (new StandardReference(reference)))
            this._global = node.data.global
            return
        }
        throw new Error('Schema mismatch in StandardFeature constructor')
    }

    get name() { return rebuildSchemaFromStandardRender(this._name, { tag: 'Name' as const }) }
    get description() { return rebuildSchemaFromStandardRender(this._description, { tag: 'Description' as const }) }
    get examples() { return this._examples }
    get global() { return this._global }

    toJSON(options?: StandardToJSONOptions): Omit<StandardFeatureData, 'key' | 'universalKey'> {
        const { stripUIFields: stripUI } = options ?? {}
        return {
            tag: 'Feature',
            name: stripUI
                ? rebuildSchemaFromStandardRender(this._name?.mapContents(stripUIFields), { tag: 'Name' as const })
                : this.name,
            description: stripUI
                ? rebuildSchemaFromStandardRender(this._description?.mapContents(stripUIFields), { tag: 'Description' as const })
                : this.description,
            ...(this.global ? { global: true } : {}),
            ...(this.examples.length ? { examples: this.examples.map((reference) => (reference.toJSON() as StandardReferenceData)) } : {})
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Feature', key, global: this.global },
            children: [
                ...this.examples.map((reference) => (reference.schema)),
                ...[this.name, this.description].filter(excludeUndefined).filter(({ children }) => (children.length))
            ]
        }
    }

    nestedSchema(byId: Record<string, StandardComponent>, localKey: string, globalKey: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Feature', key: localKey },
            children: [
                ...this.examples.map((reference) => (
                    reference.global
                        ? reference.schema
                        : byId[`${globalKey}.${reference.key}`]?.nestedSchema(byId, reference.key, `${globalKey}.${reference.key}`)
                )).filter(excludeUndefined),
                ...[this.name, this.description].filter(excludeUndefined).filter(({ children }) => (children.length))
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardFeaturePayload()
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
        const returnValue = new StandardFeaturePayload(this)
        if (returnValue._name) {
            returnValue._name = returnValue._name.mapContents(callback)
        }
        if (returnValue._description) {
            returnValue._description = returnValue._description.mapContents(callback)
        }
        return returnValue as this
    }
}

export class StandardFeature extends componentClassFactory(StandardFeaturePayload, 'StandardFeature') {
    get name() { return this._payload.name }
    get description() { return this._payload.description }
    override get global() { return this._payload.global }

    override clone(): StandardFeature {
        const returnValue = new StandardFeature(this)
        returnValue._payload = new StandardFeaturePayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardFeature(super.merge(incoming) as StandardFeature)
    }

    override withKey(key: string): StandardComponent {
        return new StandardFeature(super.withKey(key) as StandardFeature)
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
