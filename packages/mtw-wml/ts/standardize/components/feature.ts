import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardFeatureData } from "./dataTypes/feature"
import { childReferenceFactory, ReferenceFormat } from "./utils/references"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference, { ReferenceList, StandardKey } from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature } from "@tonylb/mtw-base/ts/schema/components"
import { deepEqual } from "../../lib/objects"
import { renderReference } from "./utils/schema"

export class StandardFeaturePayload implements ComponentConstructorMethods<StandardFeatureData> {
    _examples: ReferenceList;
    tag = 'Feature' as const

    constructor(previous?: StandardFeaturePayload) {
        if (previous) {
            this._examples = previous._examples
        }
        else {
            this._examples = new ReferenceList([])
        }
    }

    fromJSON(props: StandardFeatureData) {
        this._examples = new ReferenceList(props.examples?.map((reference) => (new StandardReference(reference))) ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaFeature)(node)) {
            this._examples = new ReferenceList(node.children.filter(wrappedNodeTypeGuard(isSchemaExample)).map((node => (childReferenceFactory([node])))))
            return
        }
        throw new Error('Schema mismatch in StandardFeature constructor')
    }

    get examples() { return this._examples }

    toJSON(options?: StandardToJSONOptions): Omit<StandardFeatureData, 'key' | 'universalKey'> {
        return {
            tag: 'Feature',
            ...(this.examples.payload.length ? { examples: this.examples.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Feature', key, uuid: universalKey },
            children: this.examples.schema,
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        return {
            data: key.schema[0].data,
            children: this.examples.payload.map(renderReference({ lookup, options })).filter(excludeUndefined),
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardFeaturePayload()
        returnValue._examples = this.examples.merge(incoming.examples) ?? new ReferenceList([])
        return returnValue as this
    }

    subset(): this {
        return new StandardFeaturePayload() as this
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this.examples.payload.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardFeaturePayload(this)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardKey[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardFeaturePayload(this)
        returnValue._examples = returnValue._examples.lookup(props.mappings).toFormat(props.mapTo)
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardFeaturePayload(this)
        if (child._payload.plain.tag === 'Example') {
            returnValue._examples = returnValue._examples.assureItem(child)
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
        const examplesDiff = this.examples.diff(incoming.examples) ?? new ReferenceList([])
        if (deepEqual(this.toJSON(), incoming.toJSON()) && !examplesDiff.payload.length) {
            return undefined
        }
        const base = this.clone()
        base._payload = new StandardFeaturePayload()
        base._payload._examples = examplesDiff
        return base
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardFeature)) {
            return false
        }
        return !(this.examples.diff(incoming.examples)?.payload?.length)
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

    override withMapping(mapping: StandardKey[]): StandardComponent {
        return new StandardFeature(super.withMapping(mapping) as StandardFeature)
    }

    override withImport(fromAsset: AssetUUID): StandardComponent {
        return new StandardFeature(super.withImport(fromAsset) as StandardFeature)
    }
    
    override withLeastCommonContext(context: StandardKey[]): StandardComponent {
        return new StandardFeature(super.withLeastCommonContext(context) as StandardFeature)
    }

    override withChild(child: StandardReference): StandardComponent {
        return new StandardFeature(super.withChild(child) as StandardFeature)
    }

}

export default StandardFeature
