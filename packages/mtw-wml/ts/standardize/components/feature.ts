import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey, StandardDiffOptions, StandardToJSONOptions } from "./baseClasses"
import { StandardFeatureData } from "./dataTypes/feature"
import { ReferenceList } from "./reference"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { StandardReferenceData } from "./dataTypes/reference"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature } from "@tonylb/mtw-base/ts/schema/components"
import { deepEqual } from "../../lib/objects"
import { renderReference } from "./utils/schema"
import { HasShortName } from "./abstract"
import { StandardLiteral } from "../literal"
import type { StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import { StandardExplicitParent } from "../explicit"
import {
    processWithConsumers,
    StandardizeConsumerInline,
    StandardizeConsumerReferenceList,
    StandardizeConsumerStandardLiteral,
} from "./fromSchemaPipeline"
import { ReferenceFormat } from "./utils/references"

export class StandardFeaturePayload implements HasShortName, ComponentConstructorMethods<StandardFeatureData, StandardFeatureData> {
    _shortName?: StandardLiteral;
    _examples: ReferenceList;
    tag = 'Feature' as const

    constructor(previous?: StandardFeaturePayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._examples = previous._examples
        }
        else {
            this._examples = new ReferenceList([])
        }
    }

    fromJSON(props: StandardFeatureData) {
        const { shortName } = props
        this._shortName = shortName ? new StandardLiteral(shortName, { tag: 'ShortName' }) : undefined
        this._examples = new ReferenceList(props.examples?.map((reference) => (new StandardReference(reference))) ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaFeature)(node)) {
            const consumers = [
                new StandardizeConsumerStandardLiteral(this, {
                    tag: "ShortName",
                    update(literal) {
                        this._shortName = literal
                    },
                }),
                new StandardizeConsumerReferenceList(this, {
                    tag: "Example",
                    update(list) {
                        this._examples = list
                    },
                }),
                new StandardizeConsumerInline(),
            ]
            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardFeature constructor')
    }

    get shortName() { return this._shortName }
    get examples() { return this._examples }

    toJSON(options?: StandardToJSONOptions): Omit<StandardFeatureData, 'key' | 'universalKey'> {
        return {
            tag: 'Feature',
            shortName: this?.shortName?.toJSON(),
            ...(this.examples.payload.length ? { examples: this.examples.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Feature', key, uuid: universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema())).flat(1),
                ...this.examples.schema,
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        
        // If organization is available, use assured references from organization
        // Otherwise, fall back to stored reference lists
        let examplesToRender = this.examples
        let inlineRemainder: StandardReference[] = []

        if (options.organization) {
            // Get children from organization and assure references
            const children = options.organization.getChildrenOfParent(key) ?? []
            const { payload: assured, inlineRemainder: remainder } = this.assureReferences(children)
            examplesToRender = assured.examples
            inlineRemainder = remainder
        }

        return {
            data: { tag: 'Feature', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema())).flat(1),
                ...examplesToRender.payload.map(renderReference({ lookup, options })).filter(excludeUndefined),
                ...inlineRemainder.map(renderReference({ lookup, options })).filter(excludeUndefined),
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardFeaturePayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._examples = this.examples.merge(incoming.examples) ?? new ReferenceList([])
        return returnValue as this
    }

    subset(): this {
        return new StandardFeaturePayload() as this
    }

    referencedKeys(): StandardComponentReferenceKey[] {
        return [
            ...this.examples.payload.map((reference) => ({ referenceType: 'Direct' as const, reference }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardFeaturePayload(this)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardFeaturePayload(this)
        returnValue._examples = returnValue._examples.toFormat(props.mapTo, props.mappings)
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardFeaturePayload(this)
        if (child.tag === 'Example') {
            returnValue._examples = returnValue._examples.assureItem(child)
        }
        else {
            throw new Error(`Invalid child type ${child.tag} for StandardFeature`)
        }
        return returnValue as this
    }

    isEmpty(): boolean {
        // A feature is empty if it has no shortName and no examples
        const hasShortName = Boolean(this._shortName)
        const hasExamples = this._examples.payload.length > 0
        return !(hasShortName || hasExamples)
    }

    invert(): this {
        const returnValue = new StandardFeaturePayload()
        // Invert shortName if it exists (StandardLiteral has invert() from standardEditableFactory)
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        // Invert examples ReferenceList
        returnValue._examples = this._examples.invert()
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        const BUCKET_TAGS = ['Example'] as const
        const bucketChildren = children.filter(c => BUCKET_TAGS.includes(c.tag as (typeof BUCKET_TAGS)[number]))
        const remainder = children.filter(c => !BUCKET_TAGS.includes(c.tag as (typeof BUCKET_TAGS)[number]))

        const returnValue = new StandardFeaturePayload(this)
        const exampleReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Example').map(child => child.withRef(0))
        )
        returnValue._examples = this._examples.merge(exampleReferences, { cleanEmptyReferences: false }) ?? this._examples

        return {
            payload: returnValue as this,
            inlineRemainder: remainder.map(c => c.withRef(0))
        }
    }

    removeReferences(references: StandardReference[]): this {
        const returnValue = new StandardFeaturePayload(this)
        
        // Filter reference list by removing items that match any reference in the input
        returnValue._examples = this._examples.filter(
            item => !references.some(ref => item.sameKey(ref))
        )
        
        return returnValue as this
    }
}

export class StandardFeature extends componentClassFactory(StandardFeaturePayload, 'StandardFeature') {
    get shortName() { return this._payload.shortName }
    get examples() { return this._payload.examples }

    override _wrap(instance: StandardComponent): this {
        return new StandardFeature(instance as StandardFeature) as this
    }

    override clone(): StandardFeature {
        const returnValue = new StandardFeature(this)
        returnValue._payload = new StandardFeaturePayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardFeature)) {
            return false
        }
        return !(this.examples.diff(incoming.examples)?.payload?.length) &&
            deepEqual(this.shortName?.toJSON(), incoming.shortName?.toJSON())
    }

}

export default StandardFeature
