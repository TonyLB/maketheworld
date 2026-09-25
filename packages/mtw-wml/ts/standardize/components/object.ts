import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import { StandardToJSONOptions } from "./baseClasses"
import { ReferenceFormat } from "./utils/references"
import { StandardObjectData } from "./dataTypes/object"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaObject, isSchemaRender } from "@tonylb/mtw-base/ts/schema/components"
import { StandardKey } from "../keys/key"
import StandardReference from "../keys/reference"
import { StandardFormSubsetRequest } from "../baseClasses"
import { StandardLiteral } from "../literal"
import type { StandardFormConstructionOptions, StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import {
    createShortNameFromJSON,
    invertShortName,
    mergeShortName,
    shortNameSchemaChildren,
    shortNameToJSON,
    standardizeShortNameConsumer,
} from "./shortNameField"
import {
    createGlossFromJSON,
    invertGloss,
    mergeGloss,
    glossSchemaChildren,
    glossToJSON,
    standardizeGlossConsumer,
} from "./glossField"
import {
    processWithConsumers,
    StandardizeConsumerFacetListSituation,
    StandardizeConsumerInline,
    StandardizeConsumerReferenceList,
    StandardizeConsumerSimple,
    type StandardizeConsumer,
} from "./fromSchemaPipeline"
import { defaultedEquals } from "./utils"
import { parseProseTripletChildren, renderPayloadToSchemaNode, SituationProseFacetList, SituationProseFacetPayload, StandardSituationProseFacet, mapSituationProsePayloadContents } from "../keys/facets/situationRoom"
import type { StandardFacetData } from "../keys/facets/dataTypes/facet"
import type { SituationProseFacetPayloadType } from "../keys/facets/situationRoom"
import { ReferenceList } from "./reference"
import StandardLudicGraph from "./ludicGraph"
import { LUDIC_GRAPH_NODE_TAGS } from "./dataTypes/ludicGraph"
import { excludeUndefined } from "../../lib/lists"
import { renderReference } from "./utils/schema"

const LUDIC_GRAPH_NODE_TAG_SET = new Set<string>(LUDIC_GRAPH_NODE_TAGS)

export class StandardObjectPayload implements ComponentConstructorMethods<StandardObjectData, StandardObjectData> {
    _shortName?: StandardLiteral;
    _gloss?: StandardLiteral;
    _situations: SituationProseFacetList;
    _render?: SituationProseFacetPayload;
    _ludicGraph: StandardLudicGraph;
    tag = 'Object' as const

    constructor(previous?: StandardObjectPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._gloss = previous._gloss
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

    fromJSON(props: StandardObjectData) {
        const { shortName } = props
        this._shortName = createShortNameFromJSON(shortName)
        this._gloss = createGlossFromJSON(props.gloss)
        this._situations = new SituationProseFacetList(props.situations ?? [])
        this._render = props.render ? new SituationProseFacetPayload(props.render) : undefined
        this._ludicGraph = StandardLudicGraph.fromJSON(props.ludicGraph)
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaObject)(node)) {
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
                standardizeGlossConsumer(this),
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
                            throw new Error('Object must contain at most one Render tag')
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
        throw new Error('Schema mismatch in StandardObject constructor')
    }

    get shortName() {
        return this._shortName
    }
    get gloss() {
        return this._gloss
    }
    get situations() { return this._situations }
    get render() {
        return this._render?.toJSON()
    }

    toJSON(_options?: StandardToJSONOptions): Omit<StandardObjectData, 'key' | 'universalKey'> {
        const ludicGraphJSON = this._ludicGraph.toJSON()
        return {
            tag: 'Object',
            ...(this.shortName ? { shortName: shortNameToJSON(this.shortName) } : {}),
            ...(this.gloss ? { gloss: glossToJSON(this.gloss) } : {}),
            ...(this.situations.length ? { situations: this.situations.toJSON() } : {}),
            ...(this._render ? { render: this._render.toJSON() } : {}),
            ...(ludicGraphJSON ? { ludicGraph: ludicGraphJSON } : {}),
        }
    }

    schema(_key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        const situationSchemas = this._situations.items.reduce<GenericTreeNode<SchemaTag>[]>((acc, facet) => {
            const result = facet.renderFacet(undefined, undefined, mappings)
            if (result.aggregatedNode) acc.push(result.aggregatedNode)
            else if (result.newNode) acc.push(result.newNode)
            return acc
        }, [])
        const renderSchemas: GenericTreeNode<SchemaTag>[] = this._render ? [renderPayloadToSchemaNode(this._render, mappings)] : []
        return {
            data: { tag: 'Object', uuid: universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...glossSchemaChildren(this.gloss),
                ...situationSchemas,
                ...renderSchemas,
                ...this._ludicGraph.nonRootComponentRefs.schema,
            ],
        }
    }

    subset({ requestType }: StandardFormSubsetRequest): this {
        if (requestType === 'Full') {
            return new StandardObjectPayload(this) as this
        }
        return new StandardObjectPayload() as this
    }

    merge(incoming: this): this {
        const returnValue = new StandardObjectPayload()
        returnValue._shortName = mergeShortName(this._shortName, incoming._shortName)
        returnValue._gloss = mergeGloss(this._gloss, incoming._gloss)
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

    isEmpty(): boolean {
        const hasShortName = Boolean(this._shortName)
        const hasGloss = Boolean(this._gloss)
        const hasSituations = this._situations.length > 0
        const hasRender = Boolean(this._render)
        const hasLudicGraph = this._ludicGraph.nodes.payload.length > 0
        return !(hasShortName || hasGloss || hasSituations || hasRender || hasLudicGraph)
    }

    invert(): this {
        const returnValue = new StandardObjectPayload()
        returnValue._shortName = invertShortName(this._shortName)
        returnValue._gloss = invertGloss(this._gloss)
        returnValue._situations = this._situations.invert()
        returnValue._render = this._render?.invert()
        const graphJSON = this._ludicGraph.toJSON() ?? {}
        returnValue._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: this._ludicGraph.nodes.invert().toJSON(),
        })
        return returnValue as this
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardObjectPayload(this)
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
        const returnValue = new StandardObjectPayload(this)
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
        const returnValue = new StandardObjectPayload(this)
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
            throw new Error(`Invalid child type ${child.tag} for StandardObject`)
        }
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        const bucketChildren = children.filter((c) => LUDIC_GRAPH_NODE_TAG_SET.has(c.tag))
        const remainder = children.filter((c) => !LUDIC_GRAPH_NODE_TAG_SET.has(c.tag))

        const returnValue = new StandardObjectPayload(this)
        const bucketReferences = new ReferenceList(
            bucketChildren.map((child) => child.withRef(0))
        )
        const merged = returnValue._ludicGraph.nodes.componentRefs.merge(bucketReferences, { cleanEmptyReferences: false })
            ?? returnValue._ludicGraph.nodes.componentRefs
        returnValue.withLudicGraphNodes(merged)

        return {
            payload: returnValue as this,
            inlineRemainder: remainder.map((c) => c.withRef(0)),
        }
    }

    removeReferences(references: StandardReference[]): this {
        const returnValue = new StandardObjectPayload(this)
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

    nestedSchema(_lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key, mappings } = options
        const situationSchemas = this._situations.items.reduce<GenericTreeNode<SchemaTag>[]>((acc, facet) => {
            const result = facet.renderFacet(undefined, _lookup, mappings)
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

        // Excludes the root itself --- the root is always a member of `nodes` (concepts clause 3),
        // correct for the graph model but wrong as a rendered child: a self-referencing
        // `<Object uuid=(id) />` inside its own `<Object uuid=(id)>` is both semantically empty
        // and structurally invalid on re-parse (a reference-only occurrence has no `ShortName`).
        const nonRootNodesToRender = this._ludicGraph.excludeRoot(nodesToRender)

        return {
            data: { tag: 'Object', uuid: key.universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...glossSchemaChildren(this.gloss),
                ...situationSchemas,
                ...renderSchemas,
                ...nonRootNodesToRender.payload.map(renderReference({ lookup: _lookup, options })).filter(excludeUndefined).flat(1),
            ],
        }
    }
}

export class StandardObject extends componentClassFactory(StandardObjectPayload, 'StandardObject') {
    get situations() { return this._payload.situations }
    get render() { return this._payload.render }
    get ludicGraph() { return this._payload.ludicGraph }

    constructor(
        props: string | StandardObjectData | GenericTreeNode<SchemaTag> | StandardObject,
        options?: StandardFormConstructionOptions,
    ) {
        super(props, options)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardObject(instance as StandardObject) as this
    }

    override clone(): StandardObject {
        const returnValue = new StandardObject(this)
        returnValue._payload = new StandardObjectPayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardObject)) {
            return false
        }
        const shortNameEqual = defaultedEquals(this.shortName, incoming.shortName)
        const glossEqual = defaultedEquals(this.gloss, incoming.gloss)
        const situationsDiff = this.situations.diff(incoming.situations)
        const renderA = this._payload._render
        const renderB = incoming._payload._render
        const renderEqual =
            (!renderA && !renderB) ||
            (Boolean(renderA && renderB) && renderA!.diff(renderB) === undefined)
        return !(situationsDiff?.length) &&
            shortNameEqual &&
            glossEqual &&
            renderEqual &&
            this.ludicGraph.equals(incoming.ludicGraph)
    }
}

export default StandardObject
