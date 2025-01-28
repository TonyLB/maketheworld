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
import { mergeUniqueReferences } from "./utils/references"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference, { diffStandardReferenceList } from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaKnowledge } from "@tonylb/mtw-base/ts/schema/components"
import { StandardRemove } from "./edits"
import { deepEqual } from "../../lib/objects"

export class StandardKnowledgePayload implements ComponentConstructorMethods<StandardKnowledgeData> {
    _examples: (StandardReference | StandardRemove)[] = [];
    tag = 'Knowledge' as const

    constructor(previous?: StandardKnowledgePayload) {
        if (previous) {
            this._examples = previous._examples
        }
    }

    fromJSON(props: StandardKnowledgeData) {
        const { examples } = props
        this._examples = examples?.map((example) => new StandardReference(example)) ?? []
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaKnowledge)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            this._examples = node.children.filter(treeNodeTypeguard(isSchemaExample)).map((reference) => (new StandardReference(reference)))
            return
        }
        throw new Error('Schema mismatch in StandardKnowledge constructor')
    }

    get examples() { return this._examples }

    toJSON(options: StandardToJSONOptions): Omit<StandardKnowledgeData, 'key' | 'universalKey'> {
        return {
            tag: 'Knowledge',
            ...(this.examples.length ? { examples: this.examples.map((reference) => (reference.toJSON() as StandardReferenceData)) } : {})
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Knowledge', key },
            children: this.examples.map((reference) => (reference.schema))
        }
    }

    nestedSchema(byId: Record<string, StandardComponent>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { localKey, globalKey } = options
        return {
            data: { tag: 'Knowledge', key: localKey },
            children: this.examples.map((reference) => (
                reference.global
                    ? reference.schema
                    : byId[`${globalKey}.${reference.key}`]?.nestedSchema(byId, { ...options, localKey: reference.key, globalKey: `${globalKey}.${reference.key}` })
            )).filter(excludeUndefined)
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardKnowledgePayload()
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
        const returnValue = new StandardKnowledgePayload(this)
        return returnValue as this
    }
}

export class StandardKnowledge extends componentClassFactory(StandardKnowledgePayload, 'StandardKnowledge') {
    get examples() { return this._payload.examples }

    override clone(): StandardKnowledge {
        const returnValue = new StandardKnowledge(this)
        returnValue._payload = new StandardKnowledgePayload(this._payload)
        return returnValue
    }

    override diff(incoming: StandardComponent): StandardComponent | undefined {
        if (!(incoming instanceof StandardKnowledge)) {
            throw new Error('Mismatched component types in diff')
        }
        if (deepEqual(this.toNDJSON(), incoming.toNDJSON())) {
            return undefined
        }
        const base = new StandardKnowledge(this.key).withImport(this.import).withExport(this.export) as StandardKnowledge
        base._payload._examples = diffStandardReferenceList(this.examples, incoming.examples)
        return base
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
