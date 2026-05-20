import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey, StandardToJSONOptions } from "./baseClasses"
import { StandardFeatureData } from "./dataTypes/feature"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature, isSchemaRender } from "@tonylb/mtw-base/ts/schema/components"
import { HasShortName } from "./abstract"
import { StandardLiteral } from "../literal"
import { resolveStandardizeFromSchemaContext, type StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import {
    processWithConsumers,
    StandardizeConsumerFacetListSituation,
    StandardizeConsumerInline,
    StandardizeConsumerSimple,
    StandardizeConsumerStandardLiteral,
    type StandardizeConsumer,
} from "./fromSchemaPipeline"
import { ReferenceFormat } from "./utils/references"
import { parseProseTripletChildren, renderPayloadToSchemaNode, SituationProseFacetList, SituationProseFacetPayload, StandardSituationProseFacet, mapSituationProsePayloadContents } from "../keys/facets/situationRoom"
import type { StandardFacetData } from "../keys/facets/dataTypes/facet"
import type { SituationProseFacetPayloadType } from "../keys/facets/situationRoom"

export class StandardFeaturePayload implements HasShortName, ComponentConstructorMethods<StandardFeatureData, StandardFeatureData> {
    _shortName?: StandardLiteral;
    _situations: SituationProseFacetList;
    _render?: SituationProseFacetPayload;
    tag = 'Feature' as const

    constructor(previous?: StandardFeaturePayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._situations = previous._situations.clone()
            this._render = previous._render?.clone()
        }
        else {
            this._situations = new SituationProseFacetList([])
        }
    }

    fromJSON(props: StandardFeatureData) {
        const { shortName } = props
        this._shortName = shortName ? new StandardLiteral(shortName, { tag: 'ShortName' }) : undefined
        this._situations = new SituationProseFacetList(props.situations ?? [])
        this._render = props.render ? new SituationProseFacetPayload(props.render) : undefined
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaFeature)(node)) {
            const consumers: StandardizeConsumer[] = [
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
            ]
            if (resolveStandardizeFromSchemaContext(context).standardizeMode === 'ephemeraWire') {
                consumers.push(
                    new StandardizeConsumerSimple(this, {
                        tag: 'Render',
                        update(matched) {
                            if (matched.length === 0) {
                                return
                            }
                            if (matched.length > 1) {
                                throw new Error('Feature must contain at most one Render tag')
                            }
                            const renderNode = matched[0]
                            if (!isSchemaRender(renderNode.data)) {
                                throw new Error('Expected Render schema node')
                            }
                            const children = renderNode.children
                            if (children.length !== 3) {
                                throw new Error('Render tag must contain exactly three children: DisplayName, Summary, Description in order')
                            }
                            const payloadData = parseProseTripletChildren(children, { allowUnconsumed: false })
                            const payload = new SituationProseFacetPayload(payloadData)
                            if (!payload.hasNonEmptyDisplayName()) {
                                throw new Error('Render DisplayName must contain non-empty text after trim')
                            }
                            this._render = payload
                        },
                    })
                )
            }
            consumers.push(new StandardizeConsumerInline())
            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardFeature constructor')
    }

    get shortName() { return this._shortName }
    get situations() { return this._situations }
    get render() {
        return this._render?.toJSON()
    }

    toJSON(_options?: StandardToJSONOptions): Omit<StandardFeatureData, 'key' | 'universalKey'> {
        return {
            tag: 'Feature',
            shortName: this?.shortName?.toJSON(),
            ...(this.situations.length ? { situations: this.situations.toJSON() } : {}),
            ...(this._render ? { render: this._render.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        const situationSchemas = this._situations.items.reduce<GenericTreeNode<SchemaTag>[]>((acc, facet) => {
            const result = facet.renderFacet()
            if (result.aggregatedNode) acc.push(result.aggregatedNode)
            else if (result.newNode) acc.push(result.newNode)
            return acc
        }, [])
        const renderSchemas: GenericTreeNode<SchemaTag>[] = this._render ? [renderPayloadToSchemaNode(this._render)] : []
        return {
            data: { tag: 'Feature', key, uuid: universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema())).flat(1),
                ...situationSchemas,
                ...renderSchemas,
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
        const renderSchemas: GenericTreeNode<SchemaTag>[] = this._render ? [renderPayloadToSchemaNode(this._render)] : []
        return {
            data: { tag: 'Feature', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema())).flat(1),
                ...situationSchemas,
                ...renderSchemas,
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardFeaturePayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        const mergedSituations = this._situations.merge(incoming._situations)
        returnValue._situations = mergedSituations ?? new SituationProseFacetList([])
        if (incoming._render !== undefined) {
            returnValue._render = this._render !== undefined
                ? this._render.merge(incoming._render) ?? undefined
                : incoming._render.clone()
        }
        else {
            returnValue._render = this._render?.clone()
        }
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
            ...(this._render ? this._render.referencedLinkKeys(mapping) : []),
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardFeaturePayload(this)
        returnValue._situations = new SituationProseFacetList(
            returnValue._situations.items.map((facet) => {
                const remappedPayload = mapSituationProsePayloadContents(facet.payload, callback)
                return new StandardSituationProseFacet({
                    reference: facet.reference.toJSON(),
                    payload: remappedPayload.toJSON(),
                })
            })
        )
        if (returnValue._render) {
            returnValue._render = mapSituationProsePayloadContents(returnValue._render, callback)
        }
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardFeaturePayload(this)
        returnValue._situations = returnValue._situations.lookup(props.mappings).remapReferences(props)
        if (returnValue._render) {
            returnValue._render = returnValue._render.remapReferences(props)
        }
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
        const hasRender = Boolean(this._render)
        return !(hasShortName || hasSituations || hasRender)
    }

    invert(): this {
        const returnValue = new StandardFeaturePayload()
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        returnValue._situations = this._situations.invert()
        returnValue._render = this._render?.invert()
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
    get render() { return this._payload.render }

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
        const renderA = this._payload._render
        const renderB = incoming._payload._render
        const renderEqual =
            (!renderA && !renderB) ||
            (Boolean(renderA && renderB) && renderA!.diff(renderB) === undefined)
        return !(situationsDiff?.length) &&
            shortNameEqual &&
            renderEqual
    }

}

export default StandardFeature
