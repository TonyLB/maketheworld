import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey, StandardToJSONOptions } from "./baseClasses"
import { StandardFeatureData } from "./dataTypes/feature"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature } from "@tonylb/mtw-base/ts/schema/components"
import { HasShortName } from "./abstract"
import { StandardLiteral } from "../literal"
import type { StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import {
    processWithConsumers,
    StandardizeConsumerFacetListSituation,
    StandardizeConsumerInline,
    StandardizeConsumerStandardLiteral,
} from "./fromSchemaPipeline"
import { ReferenceFormat } from "./utils/references"
import { SituationProseFacetList, StandardSituationProseFacet } from "../keys/facets/situationRoom"
import type { StandardFacetData } from "../keys/facets/dataTypes/facet"
import type { SituationProseFacetPayloadType } from "../keys/facets/situationRoom"

export class StandardFeaturePayload implements HasShortName, ComponentConstructorMethods<StandardFeatureData, StandardFeatureData> {
    _shortName?: StandardLiteral;
    _situations: SituationProseFacetList;
    tag = 'Feature' as const

    constructor(previous?: StandardFeaturePayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._situations = previous._situations.clone()
        }
        else {
            this._situations = new SituationProseFacetList([])
        }
    }

    fromJSON(props: StandardFeatureData) {
        const { shortName } = props
        this._shortName = shortName ? new StandardLiteral(shortName, { tag: 'ShortName' }) : undefined
        this._situations = new SituationProseFacetList(props.situations ?? [])
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
                new StandardizeConsumerFacetListSituation(this, {
                    update(list) {
                        this._situations = list
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
    get situations() { return this._situations }

    toJSON(_options?: StandardToJSONOptions): Omit<StandardFeatureData, 'key' | 'universalKey'> {
        return {
            tag: 'Feature',
            shortName: this?.shortName?.toJSON(),
            ...(this.situations.length ? { situations: this.situations.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        const situationSchemas = this._situations.items.reduce<GenericTreeNode<SchemaTag>[]>((acc, facet) => {
            const result = facet.renderFacet()
            if (result.aggregatedNode) acc.push(result.aggregatedNode)
            else if (result.newNode) acc.push(result.newNode)
            return acc
        }, [])
        return {
            data: { tag: 'Feature', key, uuid: universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema())).flat(1),
                ...situationSchemas,
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        const situationSchemas = this._situations.items.reduce<GenericTreeNode<SchemaTag>[]>((acc, facet) => {
            const result = facet.renderFacet(undefined, lookup)
            if (result.aggregatedNode) acc.push(result.aggregatedNode)
            else if (result.newNode) acc.push(result.newNode)
            return acc
        }, [])
        return {
            data: { tag: 'Feature', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema())).flat(1),
                ...situationSchemas,
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardFeaturePayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        const mergedSituations = this._situations.merge(incoming._situations)
        returnValue._situations = mergedSituations ?? new SituationProseFacetList([])
        return returnValue as this
    }

    subset(): this {
        return new StandardFeaturePayload() as this
    }

    referencedKeys(mapping: StandardReference[]): StandardComponentReferenceKey[] {
        return [
            ...this.situations.items.flatMap((facet) => {
                const ref = facet.reference as StandardReference
                return [
                    { referenceType: 'Direct' as const, reference: ref },
                    ...facet.payload.referencedLinkKeys(mapping),
                ]
            }),
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardFeaturePayload(this)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardFeaturePayload(this)
        returnValue._situations = returnValue._situations.lookup(props.mappings).toFormat(props.mapTo)
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardFeaturePayload(this)
        if (child.tag === 'Situation') {
            const facetData: StandardFacetData<SituationProseFacetPayloadType> = {
                reference: child.toJSON(),
                payload: {},
            }
            const newFacet = new StandardSituationProseFacet(facetData)
            returnValue._situations = this._situations.merge(new SituationProseFacetList([newFacet])) ?? new SituationProseFacetList([newFacet])
        }
        else {
            throw new Error(`Invalid child type ${child.tag} for StandardFeature`)
        }
        return returnValue as this
    }

    isEmpty(): boolean {
        const hasShortName = Boolean(this._shortName)
        const hasSituations = this._situations.length > 0
        return !(hasShortName || hasSituations)
    }

    invert(): this {
        const returnValue = new StandardFeaturePayload()
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        returnValue._situations = this._situations.invert()
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        return {
            payload: new StandardFeaturePayload(this) as this,
            inlineRemainder: children.map(c => c.withRef(0))
        }
    }

    removeReferences(references: StandardReference[]): this {
        const returnValue = new StandardFeaturePayload(this)
        returnValue._situations = new SituationProseFacetList(
            this._situations.items.filter(
                facet => !references.some(ref => facet.reference.sameKey(ref))
            )
        )
        return returnValue as this
    }
}

export class StandardFeature extends componentClassFactory(StandardFeaturePayload, 'StandardFeature') {
    get shortName() { return this._payload.shortName }
    get situations() { return this._payload.situations }

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
        const shortNameEqual = (this.shortName ?? new StandardLiteral('')).equals(incoming.shortName ?? new StandardLiteral(''))
        const situationsDiff = this.situations.diff(incoming.situations)
        return !(situationsDiff?.length) &&
            shortNameEqual
    }

}

export default StandardFeature
