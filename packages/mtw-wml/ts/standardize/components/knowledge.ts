import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { mergeUniqueReferences } from "./utils/references"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference, { diffStandardReferenceList } from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaKnowledge } from "@tonylb/mtw-base/ts/schema/components"
import { deepEqual } from "../../lib/objects"

export class StandardKnowledgePayload implements ComponentConstructorMethods<StandardKnowledgeData> {
    _examples: StandardReference[] = [];
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
            this._examples = node.children.filter(wrappedNodeTypeGuard(isSchemaExample)).map((node => (new StandardReference(node))))
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

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Knowledge', key, uuid: universalKey },
            children: this.examples.map((reference) => (reference.schema)).flat(1)
        }
    }

    nestedSchema(byId: Record<string, StandardComponent>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { localKey, globalKey, universalKey } = options
        return {
            data: { tag: 'Knowledge', key: localKey, uuid: universalKey },
            children: this.examples.map((reference) => (
                reference.global
                    ? reference.schema[0]
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

    override diff(incoming: StandardComponent, options?: StandardDiffOptions): StandardComponent | undefined {
        if (!(incoming instanceof StandardKnowledge)) {
            throw new Error('Mismatched component types in diff')
        }
        const { hasDiff } = options ?? {}
        const examplesDiff = diffStandardReferenceList({ base: this.examples, incoming: incoming.examples, hasDiff, parentKey: this.key })
        if (deepEqual(this.toJSON(), incoming.toJSON()) && !examplesDiff.length) {
            return undefined
        }
        const base = new StandardKnowledge(this.key).withImport(this.import).withExport(this.export) as StandardKnowledge
        base._payload._examples = examplesDiff
        return base
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardKnowledge(super.merge(incoming) as StandardKnowledge)
    }

    override withKey(key: string): StandardComponent {
        return new StandardKnowledge(super.withKey(key) as StandardKnowledge)
    }
    
    override withUniversalKey(key: ComponentUUID): StandardComponent {
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
