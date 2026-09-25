import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey, StandardDiffOptions } from "./baseClasses"
import { StandardRoomData, StandardRoomInputData } from "./dataTypes/room"
import { ReferenceFormat } from "./utils/references"
import { StandardToJSONOptions } from "./baseClasses"
import { ReferenceList } from "./reference"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { StandardReferenceData } from "./dataTypes/reference"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRoom, isSchemaRender } from "@tonylb/mtw-base/ts/schema/components"
import { deepEqual } from "../../lib/objects"
import { StandardLiteral } from "../literal"
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
import type { StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import { renderReference } from "./utils/schema"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { ExitFacetList, StandardExitFacet } from "../keys/facets/exit"
import { parseProseTripletChildren, renderPayloadToSchemaNode, SituationProseFacetList, SituationProseFacetPayload, StandardSituationProseFacet, mapSituationProsePayloadContents } from "../keys/facets/situationRoom"
import { StandardExplicitParent } from "../explicit"
import { StandardFormSubsetRequest } from "../baseClasses"
import { processWithConsumers, StandardizeConsumerFacetListSituation, StandardizeConsumerReferenceList, StandardizeConsumerSimple, type StandardizeConsumer } from "./fromSchemaPipeline"
import { SingleReference } from "../keys/singleReference"
import StandardLudicGraph from "./ludicGraph"

export class StandardRoomPayload implements ComponentConstructorMethods<StandardRoomInputData, StandardRoomData> {
    _shortName?: StandardLiteral;
    _gloss?: StandardLiteral;
    _exits: ExitFacetList;
    _situations: SituationProseFacetList;
    _lens: SingleReference;
    _ludicGraph: StandardLudicGraph;
    _guidance: ReferenceList;
    _characters: ReferenceList;
    _render?: SituationProseFacetPayload;
    tag = 'Room' as const

    constructor(previous?: StandardRoomPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._gloss = previous._gloss
            this._exits = previous.exits.clone()
            this._situations = previous.situations.clone()
            this._lens = previous._lens.clone()
            this._ludicGraph = previous._ludicGraph.clone()
            this._guidance = previous._guidance.clone()
            this._characters = previous._characters.clone()
            this._render = previous._render?.clone()
        }
        else {
            this._exits = new ExitFacetList([])
            this._situations = new SituationProseFacetList([])
            this._lens = new SingleReference([])
            this._guidance = new ReferenceList([])
            this._ludicGraph = new StandardLudicGraph()
            this._characters = new ReferenceList([])
        }
    }

    private withLudicGraphNodes(nodes: ReferenceList): void {
        const graphJSON = this._ludicGraph.toJSON() ?? {}
        this._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: this._ludicGraph.nodes.withComponentRefs(nodes).toJSON(),
        })
    }

    fromJSON(props: StandardRoomInputData) {
        const { shortName } = props
        this._shortName = createShortNameFromJSON(shortName)
        this._gloss = createGlossFromJSON(props.gloss)
        this._exits = new ExitFacetList(props.exits ?? [])
        this._situations = new SituationProseFacetList(props.situations ?? [])
        this._lens = SingleReference.fromData(props.lens)
        this._ludicGraph = StandardLudicGraph.fromJSON(props.ludicGraph)
        this._guidance = new ReferenceList(props.guidance?.map((reference) => (new StandardReference(reference))) ?? [])
        this._characters = new ReferenceList(props.characters?.map((reference) => (new StandardReference(reference))) ?? [])
        this._render = props.render ? new SituationProseFacetPayload(props.render) : undefined
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaRoom)(node)) {
            // Process-and-remainder pipeline: each step consumes one tag and passes remainder to the next.
            // Unconsumed children (e.g. unknown tags) cause processWithConsumers to throw. See AGENT.implementation.md (fromSchema: process-and-remainder pipeline).
            const consumers: StandardizeConsumer[] = [
                standardizeShortNameConsumer(this),
                standardizeGlossConsumer(this),
                new StandardizeConsumerReferenceList(this, {
                    tag: "Lens",
                    update(list) {
                        this._lens = SingleReference.fromReferenceList(list)
                    }
                }),
                new StandardizeConsumerReferenceList(this, { tag: "Feature", update(list) { this.withLudicGraphNodes(list) } }),
                // Object is a graph membership reference here (LG-2), not a full inline definition:
                // this only records "this object is a node in the room's ludicGraph." The matched
                // schema is also returned via returnRemainderAddition (StandardizeConsumerReferenceList's
                // contract), so processComponents's recursive walk independently discovers and builds
                // the real top-level StandardObject from the same tag when it carries a full definition.
                // Merges with (rather than replaces) whatever withLudicGraphNodes already holds, since
                // Feature's consumer above populates the same node list.
                new StandardizeConsumerReferenceList(this, {
                    tag: "Object",
                    update(list) {
                        const merged = this._ludicGraph.nodes.componentRefs.merge(list, { cleanEmptyReferences: false })
                            ?? this._ludicGraph.nodes.componentRefs
                        this.withLudicGraphNodes(merged)
                    }
                }),
                new StandardizeConsumerFacetListSituation(this, { update(list) { this._situations = list } }),
                new StandardizeConsumerReferenceList(this, { tag: "Guidance", update(list) { this._guidance = list } }),
                new StandardizeConsumerReferenceList(this, { tag: "Character", update(list) { this._characters = list } }),
                // Position is consumed as no-op for backward compatibility (Room may contain Position from Map context; we do not store it).
                new StandardizeConsumerSimple(this, { tag: "Position", update: () => {} }),
                // Grant and DisplayName consumed as no-op so Room accepts WML that previously was silently ignored.
                new StandardizeConsumerSimple(this, { tag: "Grant", update: () => {} }),
                new StandardizeConsumerSimple(this, { tag: "DisplayName", update: () => {} }),
                new StandardizeConsumerSimple(this, {
                    tag: 'Exit',
                    update(matched) {
                        const parsedFacets = matched.map((exitNode) => {
                            try {
                                return new StandardExitFacet([exitNode])
                            } catch {
                                return undefined
                            }
                        }).filter(excludeUndefined)
                        this._exits = new ExitFacetList(parsedFacets)
                    },
                }),
                new StandardizeConsumerSimple(this, {
                    tag: 'Render',
                    update(matched) {
                        if (matched.length === 0) {
                            return
                        }
                        if (matched.length > 1) {
                            throw new Error('Room must contain at most one Render tag')
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
            ]
            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardRoom constructor')
    }

    get shortName() {
        return this._shortName
    }
    get gloss() {
        return this._gloss
    }
    get render() {
        return this._render?.toJSON()
    }
    get exits() { return this._exits }
    get situations() { return this._situations }
    get lens() { return this._lens }
    get ludicGraph() { return this._ludicGraph }
    get guidance() { return this._guidance }
    get characters() { return this._characters }

    toJSON(_options?: StandardToJSONOptions): Omit<StandardRoomData, 'key' | 'universalKey'> {
        const ludicGraphJSON = this._ludicGraph.toJSON()
        return {
            tag: 'Room',
            shortName: shortNameToJSON(this.shortName),
            ...(this.gloss ? { gloss: glossToJSON(this.gloss) } : {}),
            ...(this.exits.length ? { exits: this.exits.toJSON() } : {}),
            ...(this.situations.length ? { situations: this.situations.toJSON() } : {}),
            ...(this.lens.payload.length ? { lens: this.lens.toJSON() } : {}),
            ...(ludicGraphJSON ? { ludicGraph: ludicGraphJSON } : {}),
            ...(this.guidance.payload.length ? { guidance: this.guidance.toJSON() } : {}),
            ...(this.characters.payload.length ? { characters: this.characters.toJSON() } : {}),
            ...(this._render ? { render: this._render.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        const remappedFacets = mappings
            ? this._exits.items.map((facet) => facet.lookup(mappings).toFormat('key'))
            : this._exits.items.map((facet) => facet.toFormat('key'))
        const exitSchemas = remappedFacets.map((facet) => {
            const result = facet.renderFacet()
            return result.newNode ?? result.aggregatedNode
        }).filter(excludeUndefined) as GenericTreeNode<SchemaTag>[]

        const situationSchemas = (mappings
            ? this._situations.items.map((facet) => facet.lookup(mappings).toFormat('key'))
            : this._situations.items.map((facet) => facet.toFormat('key'))
        ).map((facet) => {
            const result = (facet as StandardSituationProseFacet).renderFacet(undefined, undefined, mappings)
            return result.newNode ?? result.aggregatedNode
        }).filter(excludeUndefined) as GenericTreeNode<SchemaTag>[]

        const renderSchemas: GenericTreeNode<SchemaTag>[] = this._render ? [renderPayloadToSchemaNode(this._render, mappings)] : []
        return {
            data: { tag: 'Room', key, uuid: universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...glossSchemaChildren(this.gloss),
                ...this.lens.schema,
                ...this._ludicGraph.nonRootComponentRefs.schema,
                ...this.guidance.schema,
                ...this.characters.schema,
                ...situationSchemas,
                ...exitSchemas,
                ...renderSchemas
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key, mappings } = options

        // If organization is available, use assured references from organization
        // Otherwise, fall back to stored reference lists
        let lensToRender = this.lens
        let nodesToRender = this._ludicGraph.nodes.componentRefs
        let guidanceToRender = this.guidance
        let charactersToRender = this.characters
        let inlineRemainder: StandardReference[] = []

        if (options.organization) {
            // Get children from organization and assure references
            const children = options.organization.getChildrenOfParent(key) ?? []
            const { payload: assured, inlineRemainder: remainder } = this.assureReferences(children)
            lensToRender = assured.lens
            nodesToRender = assured._ludicGraph.nodes.componentRefs
            guidanceToRender = assured.guidance
            charactersToRender = assured.characters
            inlineRemainder = remainder
        }

        const exitSchemas = this._exits.items.reduce<GenericTreeNode<SchemaTag>[]>((acc, facet) => {
            const result = facet.renderFacet(undefined, lookup)
            if (result.newNode) {
                acc.push(result.newNode)
            } else if (result.aggregatedNode) {
                acc.push(result.aggregatedNode)
            }
            return acc
        }, [])

        const situationSchemas = this._situations.items.reduce<GenericTreeNode<SchemaTag>[]>((acc, facet) => {
            const result = facet.renderFacet(undefined, lookup, mappings)
            if (result.aggregatedNode) acc.push(result.aggregatedNode)
            else if (result.newNode) acc.push(result.newNode)
            return acc
        }, [])

        const renderSchemas: GenericTreeNode<SchemaTag>[] = this._render ? [renderPayloadToSchemaNode(this._render, mappings)] : []
        // Excludes the root itself --- see the identical note in `object.ts`'s `nestedSchema`.
        const nonRootNodesToRender = this._ludicGraph.excludeRoot(nodesToRender)
        // Pass this Room's key as parent context to children for correct rendering
        return {
            data: { tag: 'Room', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...glossSchemaChildren(this.gloss),
                ...lensToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...nonRootNodesToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...guidanceToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...charactersToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...inlineRemainder.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...situationSchemas,
                ...exitSchemas,
                ...renderSchemas
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardRoomPayload()
        returnValue._shortName = mergeShortName(this._shortName, incoming._shortName)
        returnValue._gloss = mergeGloss(this._gloss, incoming._gloss)
        const mergedExits = this._exits.merge(incoming._exits)
        returnValue._exits = mergedExits ?? new ExitFacetList([])
        const mergedSituations = this._situations.merge(incoming._situations)
        returnValue._situations = mergedSituations ?? new SituationProseFacetList([])
        returnValue._lens = this._lens.merge(incoming._lens)
        returnValue._ludicGraph = this._ludicGraph.merge(incoming._ludicGraph)
        returnValue._guidance = this._guidance.merge(incoming._guidance) ?? new ReferenceList([])
        returnValue._characters = this._characters.merge(incoming._characters) ?? new ReferenceList([])
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

    invert(): this {
        const returnValue = new StandardRoomPayload()
        // Invert shortName if it exists (StandardLiteral has invert() from standardEditableFactory)
        returnValue._shortName = invertShortName(this._shortName)
        returnValue._gloss = invertGloss(this._gloss)
        returnValue._exits = this._exits.invert()
        returnValue._situations = this._situations.invert()
        // Invert each ReferenceList
        returnValue._lens = this._lens.invert()
        const graphJSON = this._ludicGraph.toJSON() ?? {}
        returnValue._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: this._ludicGraph.nodes.invert().toJSON(),
            edges: this._ludicGraph.edges.invert().toJSON(),
        })
        returnValue._guidance = this._guidance.invert()
        returnValue._characters = this._characters.invert()
        returnValue._render = this._render?.invert()
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        const BUCKET_TAGS = ['Lens', 'Feature', 'Object', 'Guidance', 'Character'] as const
        const bucketChildren = children.filter((c): c is StandardReference => BUCKET_TAGS.includes(c.tag as (typeof BUCKET_TAGS)[number]))
        const remainder = children.filter(c => !BUCKET_TAGS.includes(c.tag as (typeof BUCKET_TAGS)[number]))

        const returnValue = new StandardRoomPayload(this)

        const lensReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Lens').map(child => child.withRef(0))
        )
        const featureReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Feature').map(child => child.withRef(0))
        )
        const objectReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Object').map(child => child.withRef(0))
        )
        const guidanceReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Guidance').map(child => child.withRef(0))
        )
        const characterReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Character').map(child => child.withRef(0))
        )

        returnValue._lens = this._lens.merge(SingleReference.fromReferenceList(lensReferences))
        const mergedFeatureNodes = returnValue._ludicGraph.nodes.componentRefs.merge(featureReferences, { cleanEmptyReferences: false })
            ?? returnValue._ludicGraph.nodes.componentRefs
        const mergedNodes = mergedFeatureNodes.merge(objectReferences, { cleanEmptyReferences: false }) ?? mergedFeatureNodes
        returnValue.withLudicGraphNodes(mergedNodes)
        returnValue._guidance = this._guidance.merge(guidanceReferences, { cleanEmptyReferences: false }) ?? this._guidance
        returnValue._characters = this._characters.merge(characterReferences, { cleanEmptyReferences: false }) ?? this._characters

        return {
            payload: returnValue as this,
            inlineRemainder: remainder.map(c => c.withRef(0))
        }
    }

    removeReferences(references: StandardReference[]): this {
        const returnValue = new StandardRoomPayload(this)

        // Filter reference lists by removing items that match any reference in the input
        returnValue._lens = this._lens.filter(
            item => !references.some(ref => item.sameKey(ref))
        )
        const filteredNodes = returnValue._ludicGraph.nodes.componentRefs.filter(
            item => !references.some(ref => item.sameKey(ref))
        )
        returnValue.withLudicGraphNodes(filteredNodes)
        returnValue._guidance = this._guidance.filter(
            item => !references.some(ref => item.sameKey(ref))
        )
        returnValue._characters = this._characters.filter(
            item => !references.some(ref => item.sameKey(ref))
        )

        return returnValue as this
    }

    subset({ requestType }: StandardFormSubsetRequest): this {
        if (requestType === 'Full') {
            return new StandardRoomPayload(this) as this
        }
        const returnValue = new StandardRoomPayload()
        if (requestType === 'ShortName') {
            returnValue._shortName = this._shortName ? new StandardLiteral(this._shortName) : undefined
        }
        return returnValue as this
    }

    referencedKeys(mapping: StandardReference[]): StandardComponentReferenceKey[] {
        const rootId = this._ludicGraph.rootId
        return [
            ...this.exits.items.map((facet) => {
                // Extract reference from facet - exits always reference rooms
                const ref = facet.reference as StandardReference
                return { referenceType: 'Exit' as const, reference: ref }
            }),
            ...this.situations.items.flatMap((facet) => {
                const ref = facet.reference as StandardReference
                return [
                    { referenceType: 'Direct' as const, reference: ref },
                    ...facet.payload.referencedLinkKeys(mapping),
                ]
            }),
            ...(this._render ? this._render.referencedLinkKeys(mapping) : []),
            ...this.lens.payload.map((reference) => ({ referenceType: 'Direct' as const, reference })),
            ...this._ludicGraph.nodes.componentRefs.payload
                .filter((reference) => !(rootId && reference.sameKey(rootId)))
                .map((reference) => ({ referenceType: 'Direct' as const, reference })),
            ...this.guidance.payload.map((reference) => ({ referenceType: 'Direct' as const, reference })),
            ...this.characters.payload.map((reference) => ({ referenceType: 'Direct' as const, reference }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardRoomPayload(this)
        if (returnValue._shortName) {
            returnValue._shortName = returnValue._shortName
                .mapContents((value: string): string => {
                    const returnValue = callback([{ data: { tag: 'String', value }, children: [] }])
                    if (!returnValue.length || !isSchemaString(returnValue[0].data)) {
                        return ''
                    }
                    return returnValue[0].data.value
                })
        }
        if (returnValue._gloss) {
            returnValue._gloss = returnValue._gloss
                .mapContents((value: string): string => {
                    const returnValue = callback([{ data: { tag: 'String', value }, children: [] }])
                    if (!returnValue.length || !isSchemaString(returnValue[0].data)) {
                        return ''
                    }
                    return returnValue[0].data.value
                })
        }
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
        const returnValue = new StandardRoomPayload(this)
        returnValue._lens = returnValue._lens.toFormat(props.mapTo, props.mappings)
        const graphJSON = returnValue._ludicGraph.toJSON() ?? {}
        returnValue._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: returnValue._ludicGraph.nodes.toFormat(props.mapTo, props.mappings).toJSON(),
            edges: returnValue._ludicGraph.edges.toFormat(props.mapTo).lookup(props.mappings).toJSON(),
        })
        returnValue._guidance = returnValue._guidance.toFormat(props.mapTo, props.mappings)
        returnValue._exits = returnValue._exits.lookup(props.mappings).toFormat(props.mapTo)
        returnValue._situations = returnValue._situations.lookup(props.mappings).remapReferences(props)
        if (returnValue._render) {
            returnValue._render = returnValue._render.remapReferences(props)
        }
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardRoomPayload(this)
        if (child.tag === 'Lens') {
            returnValue._lens = returnValue._lens.assureItem(child)
        }
        else if (child.tag === 'Feature' || child.tag === 'Object') {
            const mergedNodes = returnValue._ludicGraph.nodes.componentRefs.assureItem(child)
            returnValue.withLudicGraphNodes(mergedNodes)
        }
        else if (child.tag === 'Guidance') {
            returnValue._guidance = returnValue._guidance.assureItem(child)
        }
        else if (child.tag === 'Character') {
            returnValue._characters = returnValue._characters.assureItem(child)
        }
        else {
            throw new Error(`Invalid child type ${child.tag} for StandardRoom`)
        }
        return returnValue as this
    }

    isEmpty(): boolean {
        // A room is empty if it has no shortName, no exits, no situations, and no references (lens, features, guidance, characters)
        const hasShortName = Boolean(this._shortName)
        const hasGloss = Boolean(this._gloss)
        const hasExits = this._exits.length > 0
        const hasSituations = this._situations.length > 0
        const hasLens = this._lens.payload.length > 0
        const hasFeatures = this._ludicGraph.nodes.payload.length > 0
        const hasGuidance = this._guidance.payload.length > 0
        const hasCharacters = this._characters.payload.length > 0
        const hasRender = Boolean(this._render)
        return !(hasShortName || hasGloss || hasExits || hasSituations || hasLens || hasFeatures || hasGuidance || hasCharacters || hasRender)
    }
}

export class StandardRoom extends componentClassFactory(StandardRoomPayload, 'StandardRoom') {
    get exits() { return this._payload.exits }
    get situations() { return this._payload.situations }
    get lens() { return this._payload.lens }
    get ludicGraph() { return this._payload.ludicGraph }
    get guidance() { return this._payload.guidance }
    get characters() { return this._payload.characters }
    get render() { return this._payload.render }

    override _wrap(instance: StandardComponent): this {
        return new StandardRoom(instance as StandardRoom) as this
    }

    override clone(): StandardRoom {
        const returnValue = new StandardRoom(this)
        returnValue._payload = new StandardRoomPayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardRoom)) {
            return false
        }
        const exitsDiff = this.exits.diff(incoming.exits)
        const situationsDiff = this.situations.diff(incoming.situations)
        const shortNameEqual = (this.shortName ?? new StandardLiteral('')).equals(incoming.shortName ?? new StandardLiteral(''))
        const glossEqual = (this.gloss ?? new StandardLiteral('')).equals(incoming.gloss ?? new StandardLiteral(''))
        // Intentional non-adoption for this slice: room.render remains strict payload deep-equality
        // until we decide whether render payload should use StandardRender/defaultedEquals semantics
        // or a dedicated SituationRoomFacetPayload.equals contract.
        return !(this.lens.diff(incoming.lens)?.payload.length) &&
            this.ludicGraph.equals(incoming.ludicGraph) &&
            !(this.guidance.diff(incoming.guidance)?.payload.length) &&
            !(this.characters.diff(incoming.characters)?.payload.length) &&
            !(exitsDiff?.length) &&
            !(situationsDiff?.length) &&
            shortNameEqual &&
            glossEqual &&
            deepEqual(this.render, incoming.render)
    }

}

export default StandardRoom
