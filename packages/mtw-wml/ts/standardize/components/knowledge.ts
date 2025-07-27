import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import { childReferenceFactory, mapReferenceToFormat, ReferenceFormat } from "./utils/references"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference, { ReferenceList, StandardKey } from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaKnowledge } from "@tonylb/mtw-base/ts/schema/components"
import { deepEqual } from "../../lib/objects"
import { renderReference } from "./utils/schema"

export class StandardKnowledgePayload implements ComponentConstructorMethods<StandardKnowledgeData> {
    _examples: ReferenceList;
    tag = 'Knowledge' as const

    constructor(previous?: StandardKnowledgePayload) {
        if (previous) {
            this._examples = previous._examples
        }
        else {
            this._examples = new ReferenceList([])
        }
    }

    fromJSON(props: StandardKnowledgeData) {
        this._examples = new ReferenceList(props.examples?.map((reference) => (new StandardReference(reference))) ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaKnowledge)(node)) {
            this._examples = new ReferenceList(node.children.filter(wrappedNodeTypeGuard(isSchemaExample)).map((node => (childReferenceFactory([node])))))
            return
        }
        throw new Error('Schema mismatch in StandardKnowledge constructor')
    }

    get examples() { return this._examples }

    toJSON(options: StandardToJSONOptions): Omit<StandardKnowledgeData, 'key' | 'universalKey'> {
        return {
            tag: 'Knowledge',
            ...(this.examples.payload.length ? { examples: this.examples.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Knowledge', key, uuid: universalKey },
            children: this.examples.schema,
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        return {
            data: { tag: 'Knowledge', key: key.key ?? '', uuid: key.universalKey },
            children: this.examples.payload.map(renderReference({ lookup, options })).filter(excludeUndefined),
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardKnowledgePayload()
        returnValue._examples = this.examples.merge(incoming.examples) ?? new ReferenceList([])
        return returnValue as this
    }

    subset(): this {
        return new StandardKnowledgePayload() as this
    }


    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this.examples.payload.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardKnowledgePayload(this)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardKey[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardKnowledgePayload(this)
        const mapReference = mapReferenceToFormat(props.mappings, props.mapTo)
        returnValue._examples = returnValue._examples.map(mapReference as any)
        return returnValue as this
    }
    
    withChild(child: StandardReference): this {
        const returnValue = new StandardKnowledgePayload(this)
        if (child._payload.plain.tag === 'Example') {
            returnValue._examples = returnValue._examples.assureItem(child)
        }
        else {
            throw new Error(`Invalid child type ${child._payload.tag} for StandardKnowledge`)
        }
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
        const examplesDiff = this.examples.diff(incoming.examples) ?? new ReferenceList([])
        if (deepEqual(this.toJSON(), incoming.toJSON()) && !examplesDiff.payload.length) {
            return undefined
        }
        const base = this.clone()
        base._payload = new StandardKnowledgePayload()
        base._payload._examples = examplesDiff
        return base
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardKnowledge)) {
            return false
        }
        return !(this.examples.diff(incoming.examples)?.payload?.length)
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

    override withMapping(mapping: StandardKey[]): StandardComponent {
        return new StandardKnowledge(super.withMapping(mapping) as StandardKnowledge)
    }

    override withImport(fromAsset: AssetUUID): StandardComponent {
        return new StandardKnowledge(super.withImport(fromAsset) as StandardKnowledge)
    }
    
}

export default StandardKnowledge
