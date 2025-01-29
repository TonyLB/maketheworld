import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent } from "./baseClasses"
import { StandardFeatureData } from "./dataTypes/feature"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardExportItem, StandardImportItem } from "./metaData"
import linkReferenceKeys, { dependencyReferenceKeys, mergeUniqueReferences } from "./utils/references"
import { StandardRender } from "../render"
import { extractStandardRender, rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { stripUIFields } from "../render/utils"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference, { diffStandardReferenceList } from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { isSchemaDescription, isSchemaExample, isSchemaName, SchemaDescriptionTag, SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example"
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature } from "@tonylb/mtw-base/ts/schema/components"
import { StandardRemove } from "./edits"
import { deepEqual } from "../../lib/objects"

export class StandardFeaturePayload implements ComponentConstructorMethods<StandardFeatureData> {
    _examples: (StandardReference | StandardRemove)[] = [];
    _global?: boolean;
    tag = 'Feature' as const

    constructor(previous?: StandardFeaturePayload) {
        if (previous) {
            this._examples = previous._examples
        }
    }

    fromJSON(props: StandardFeatureData) {
        this._examples = props.examples?.map((example) => new StandardReference(example)) ?? []
        this._global = props.global
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaFeature)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            this._examples = node.children.filter(treeNodeTypeguard(isSchemaExample)).map((reference) => (new StandardReference(reference)))
            this._global = node.data.global
            return
        }
        throw new Error('Schema mismatch in StandardFeature constructor')
    }

    get examples() { return this._examples }
    get global() { return this._global }

    toJSON(options?: StandardToJSONOptions): Omit<StandardFeatureData, 'key' | 'universalKey'> {
        return {
            tag: 'Feature',
            ...(this.global ? { global: true } : {}),
            ...(this.examples.length ? { examples: this.examples.map((reference) => (reference.toJSON() as StandardReferenceData)) } : {})
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Feature', key, global: this.global },
            children: this.examples.map((reference) => (reference.schema))
        }
    }

    nestedSchema(byId: Record<string, StandardComponent>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { localKey, globalKey } = options
        return {
            data: { tag: 'Feature', key: localKey },
            children: this.examples.map((reference) => (
                reference.global
                    ? reference.schema
                    : byId[`${globalKey}.${reference.key}`]?.nestedSchema(byId, { ...options, localKey: reference.key, globalKey: `${globalKey}.${reference.key}` })
            )).filter(excludeUndefined),
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardFeaturePayload()
        returnValue._examples = mergeUniqueReferences(this.examples, incoming.examples)
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this.examples.map(({ key }) => ({ referenceType: 'Direct' as const, key })),
            ...this.examples.map((example) => (example.referencedKeys())).flat(1)
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardFeaturePayload(this)
        return returnValue as this
    }
}

export class StandardFeature extends componentClassFactory(StandardFeaturePayload, 'StandardFeature') {
    get examples() { return this._payload.examples }
    override get global() { return this._payload.global }

    override clone(): StandardFeature {
        const returnValue = new StandardFeature(this)
        returnValue._payload = new StandardFeaturePayload(this._payload)
        return returnValue
    }

    override diff(incoming: StandardComponent): StandardComponent | undefined {
        if (!(incoming instanceof StandardFeature)) {
            throw new Error('Mismatched component types in diff')
        }
        if (deepEqual(this.toNDJSON(), incoming.toNDJSON())) {
            return undefined
        }
        const base = new StandardFeature(this.key).withImport(this.import).withExport(this.export) as StandardFeature
        base._payload._examples = diffStandardReferenceList(this.examples, incoming.examples)
        return base
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
