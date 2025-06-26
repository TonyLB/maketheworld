import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardFeatureData } from "./dataTypes/feature"
import { assureItemInReferenceList, childReferenceFactory, mapReferenceToFormat, mergeUniqueReferences, ReferenceFormat } from "./utils/references"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference, { diffStandardReferenceList, StandardKey } from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature } from "@tonylb/mtw-base/ts/schema/components"
import { deepEqual } from "../../lib/objects"
import { renderReference } from "./utils/schema"

export class StandardFeaturePayload implements ComponentConstructorMethods<StandardFeatureData> {
    _examples: StandardReference[] = [];
    tag = 'Feature' as const

    constructor(previous?: StandardFeaturePayload) {
        if (previous) {
            this._examples = previous._examples
        }
    }

    fromJSON(props: StandardFeatureData) {
        this._examples = props.examples?.map((example) => new StandardReference(example)) ?? []
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaFeature)(node)) {
            this._examples = node.children.filter(wrappedNodeTypeGuard(isSchemaExample)).map((node) => (childReferenceFactory([node])))
            return
        }
        throw new Error('Schema mismatch in StandardFeature constructor')
    }

    get examples() { return this._examples }

    toJSON(options?: StandardToJSONOptions): Omit<StandardFeatureData, 'key' | 'universalKey'> {
        return {
            tag: 'Feature',
            ...(this.examples.length ? { examples: this.examples.map((reference) => (reference.toJSON() as StandardReferenceData)) } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Feature', key, uuid: universalKey },
            children: this.examples.map((reference) => (reference.schema)).flat(1)
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        return {
            data: key.schema[0].data,
            children: this.examples.map(renderReference({ lookup, options })).filter(excludeUndefined),
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardFeaturePayload()
        returnValue._examples = mergeUniqueReferences(this.examples, incoming.examples)
        return returnValue as this
    }

    subset(): this {
        return new StandardFeaturePayload() as this
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this.examples.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardFeaturePayload(this)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardKey[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardFeaturePayload(this)
        const mapReference = mapReferenceToFormat(props.mappings, props.mapTo)
        returnValue._examples = returnValue._examples.map(mapReference)
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardFeaturePayload(this)
        if (child._payload.plain.tag === 'Example') {
            returnValue._examples = assureItemInReferenceList(returnValue._examples, child)
        }
        else {
            throw new Error(`Invalid child type ${child._payload.tag} for StandardFeature`)
        }
        return returnValue as this
    }
}

export class StandardFeature extends componentClassFactory(StandardFeaturePayload, 'StandardFeature') {
    get examples() { return this._payload.examples }

    override clone(): StandardFeature {
        const returnValue = new StandardFeature(this)
        returnValue._payload = new StandardFeaturePayload(this._payload)
        return returnValue
    }

    override diff(incoming: StandardComponent, options?: StandardDiffOptions): StandardComponent | undefined {
        if (!(incoming instanceof StandardFeature)) {
            throw new Error('Mismatched component types in diff')
        }
        const examplesDiff = diffStandardReferenceList({ base: this.examples, incoming: incoming.examples })
        if (deepEqual(this.toJSON(), incoming.toJSON()) && !examplesDiff.length) {
            return undefined
        }
        const base = this.clone()
        base._payload = new StandardFeaturePayload()
        base._payload._examples = examplesDiff
        return base
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardFeature(super.merge(incoming) as StandardFeature)
    }

    override withKey(key: string): StandardComponent {
        return new StandardFeature(super.withKey(key) as StandardFeature)
    }
    
    override withUniversalKey(key: ComponentUUID): StandardComponent {
        return new StandardFeature(super.withUniversalKey(key) as StandardFeature)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardFeature(super.withFileName(key) as StandardFeature)
    }

}

export default StandardFeature
