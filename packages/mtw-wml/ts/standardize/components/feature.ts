import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey, StandardToJSONOptions } from "./baseClasses"
import { StandardFeatureData } from "./dataTypes/feature"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature, isSchemaRender } from "@tonylb/mtw-base/ts/schema/components"
import { StandardLiteral } from "../literal"
import {
    createShortNameFromJSON,
    invertShortName,
    mergeShortName,
    shortNameSchemaChildren,
    shortNameToJSON,
    standardizeShortNameConsumer,
} from "./shortNameField"
import type { StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import {
    processWithConsumers,
    StandardizeConsumerFacetListSituation,
    StandardizeConsumerInline,
    StandardizeConsumerReferenceList,
    StandardizeConsumerSimple,
    type StandardizeConsumer,
} from "./fromSchemaPipeline"
import { ReferenceFormat } from "./utils/references"
import { parseProseTripletChildren, renderPayloadToSchemaNode, SituationProseFacetList, SituationProseFacetPayload, StandardSituationProseFacet, mapSituationProsePayloadContents } from "../keys/facets/situationRoom"
import type { StandardFacetData } from "../keys/facets/dataTypes/facet"
import type { SituationProseFacetPayloadType } from "../keys/facets/situationRoom"
import { ReferenceList } from "./reference"
import StandardLudicGraph from "./ludicGraph"
import { LUDIC_GRAPH_NODE_TAGS } from "./dataTypes/ludicGraph"
import { excludeUndefined } from "../../lib/lists"
import { renderReference } from "./utils/schema"

const LUDIC_GRAPH_NODE_TAG_SET = new Set<string>(LUDIC_GRAPH_NODE_TAGS)

export class StandardFeaturePayload implements ComponentConstructorMethods<StandardFeatureData, StandardFeatureData> {
    _shortName?: StandardLiteral;
    _situations: SituationProseFacetList;
    _render?: SituationProseFacetPayload;
    _ludicGraph: StandardLudicGraph;
    tag = 'Feature' as const

    constructor(previous?: StandardFeaturePayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._situations = previous._situations.clone()
            this._render = previous._render?.clone()
            this._ludicGraph = previous._ludicGraph.clone()
        }
        else {
            this._situations = new SituationProseFacetList([])
            this._ludicGraph = new StandardLudicGraph()
        }
    }

    get ludicGraph(): StandardLudicGraph {
        return this._ludicGraph
    }

    private withLudicGraphNodes(nodes: ReferenceList): void {
        const graphJSON = this._ludicGraph.toJSON() ?? {}
        this._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: this._ludicGraph.nodes.withComponentRefs(nodes).toJSON(),
        })
    }

    private appendLudicGraphNodes(list: ReferenceList): void {
        const merged = this._ludicGraph.nodes.componentRefs.merge(list) ?? new ReferenceList([])
        this.withLudicGraphNodes(merged)
    }

    fromJSON(props: StandardFeatureData) {
        const { shortName } = props
        this._shortName = createShortNameFromJSON(shortName)
        this._situations = new SituationProseFacetList(props.situations ?? [])
        this._render = props.render ? new SituationProseFacetPayload(props.render) : undefined
        this._ludicGraph = StandardLudicGraph.fromJSON(props.ludicGraph)
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaFeature)(node)) {
            const appendNodes = (list: ReferenceList) => {
                this.appendLudicGraphNodes(list)
            }
            const consumers: StandardizeConsumer[] = [
                ...LUDIC_GRAPH_NODE_TAGS.map((tag) => new StandardizeConsumerReferenceList(this, {
                    tag,
                    update(list) {
                        appendNodes.call(this, list)
                    },
                })),
                standardizeShortNameConsumer(this),
                new StandardizeConsumerFacetListSituation(this, {
                    update(list) {
                        this._situations = list
                    },
                }),
            ]
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
                        const payloadData = parseProseTripletChildren(children, { allowUnconsumed: false })
                        const payload = new SituationProseFacetPayload(payloadData)
                        if (payload.hasDisplayName() && !payload.hasNonEmptyDisplayName()) {
                            throw new Error('Render DisplayName must contain non-empty text after trim')
                        }
                        this._render = payload
                    },
                }),
                new StandardizeConsumerInline(),
            )
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
        const ludicGraphJSON = this._ludicGraph.toJSON()
        return {
            tag: 'Feature',
            shortName: shortNameToJSON(this.shortName),
            ...(this.situations.length ? { situations: this.situations.toJSON() } : {}),
            ...(this._render ? { render: this._render.toJSON() } : {}),
            ...(ludicGraphJSON ? { ludicGraph: ludicGraphJSON } : {}),
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        const situationSchemas = this._situations.items.reduce<GenericTreeNode<SchemaTag>[]>((acc, facet) => {
            const result = facet.renderFacet(undefined, undefined, mappings)
            if (result.aggregatedNode) acc.push(result.aggregatedNode)
            else if (result.newNode) acc.push(result.newNode)
            return acc
        }, [])
        const renderSchemas: GenericTreeNode<SchemaTag>[] = this._render ? [renderPayloadToSchemaNode(this._render, mappings)] : []
        return {
            data: { tag: 'Feature', key, uuid: universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...situationSchemas,
                ...renderSchemas,
                ...this._ludicGraph.nodes.componentRefs.schema,
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key, mappings } = options
        const situationSchemas = this._situations.items.reduce<GenericTreeNode<SchemaTag>[]>((acc, facet) => {
            const result = facet.renderFacet(undefined, lookup, mappings)
            if (result.aggregatedNode) acc.push(result.aggregatedNode)
            else if (result.newNode) acc.push(result.newNode)
            return acc
        }, [])
        const renderSchemas: GenericTreeNode<SchemaTag>[] = this._render ? [renderPayloadToSchemaNode(this._render, mappings)] : []

        let nodesToRender = this._ludicGraph.nodes.componentRefs

        if (options.organization) {
            const graphChildren = (options.organization.getChildrenOfParent(key) ?? [])
                .filter((child) => LUDIC_GRAPH_NODE_TAG_SET.has(child.tag))
            const bucketReferences = new ReferenceList(graphChildren.map((child) => child.withRef(0)))
            nodesToRender = this._ludicGraph.nodes.componentRefs.merge(bucketReferences, { cleanEmptyReferences: false })
                ?? this._ludicGraph.nodes.componentRefs
        }

        return {
            data: { tag: 'Feature', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...situationSchemas,
                ...renderSchemas,
                ...nodesToRender.payload.map(renderReference({ lookup, options })).filter(excludeUndefined).flat(1),
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardFeaturePayload()
        returnValue._shortName = mergeShortName(this._shortName, incoming._shortName)
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
        returnValue._ludicGraph = this._ludicGraph.merge(incoming._ludicGraph)
        return returnValue as this
    }

    subset(): this {
        return new StandardFeaturePayload() as this
    }

    referencedKeys(mapping: StandardReference[]): StandardComponentReferenceKey[] {
        const rootId = this._ludicGraph.rootId
        return [
            ...this.situations.items.flatMap((facet) => {
                const ref = facet.reference as StandardReference
                return [
                    { referenceType: 'Direct' as const, reference: ref },
                    ...facet.payload.referencedLinkKeys(mapping),
                ]
            }),
            ...(this._render ? this._render.referencedLinkKeys(mapping) : []),
            ...this._ludicGraph.nodes.componentRefs.payload
                .filter((reference) => !(rootId && reference.sameKey(rootId)))
                .map((reference) => ({ referenceType: 'Direct' as const, reference })),
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
        const graphJSON = returnValue._ludicGraph.toJSON() ?? {}
        returnValue._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: returnValue._ludicGraph.nodes.toFormat(props.mapTo, props.mappings).toJSON(),
        })
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
        else if (LUDIC_GRAPH_NODE_TAG_SET.has(child.tag)) {
            returnValue.appendLudicGraphNodes(new ReferenceList([child]))
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
        const hasLudicGraph = this._ludicGraph.nodes.payload.length > 0
        return !(hasShortName || hasSituations || hasRender || hasLudicGraph)
    }

    invert(): this {
        const returnValue = new StandardFeaturePayload()
        returnValue._shortName = invertShortName(this._shortName)
        returnValue._situations = this._situations.invert()
        returnValue._render = this._render?.invert()
        const graphJSON = this._ludicGraph.toJSON() ?? {}
        returnValue._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: this._ludicGraph.nodes.invert().toJSON(),
        })
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        const bucketChildren = children.filter((c) => LUDIC_GRAPH_NODE_TAG_SET.has(c.tag))
        const remainder = children.filter((c) => !LUDIC_GRAPH_NODE_TAG_SET.has(c.tag))

        const returnValue = new StandardFeaturePayload(this)
        const bucketReferences = new ReferenceList(
            bucketChildren.map((child) => child.withRef(0))
        )
        const merged = returnValue._ludicGraph.nodes.componentRefs.merge(bucketReferences, { cleanEmptyReferences: false })
            ?? returnValue._ludicGraph.nodes.componentRefs
        returnValue.withLudicGraphNodes(merged)

        return {
            payload: returnValue as this,
            inlineRemainder: remainder.map((c) => c.withRef(0))
        }
    }

    removeReferences(references: StandardReference[]): this {
        const returnValue = new StandardFeaturePayload(this)
        returnValue._situations = new SituationProseFacetList(
            this._situations.items.filter(
                facet => !references.some(ref => facet.reference.sameKey(ref))
            )
        )
        const filteredNodes = returnValue._ludicGraph.nodes.componentRefs.filter(
            (item) => !references.some((ref) => item.sameKey(ref))
        )
        returnValue.withLudicGraphNodes(filteredNodes)
        return returnValue as this
    }
}

export class StandardFeature extends componentClassFactory(StandardFeaturePayload, 'StandardFeature') {
    get situations() { return this._payload.situations }
    get render() { return this._payload.render }
    get ludicGraph() { return this._payload.ludicGraph }

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
            renderEqual &&
            this.ludicGraph.equals(incoming.ludicGraph)
    }

}

export default StandardFeature
