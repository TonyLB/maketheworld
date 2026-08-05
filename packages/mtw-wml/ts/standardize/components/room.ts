import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey, StandardDiffOptions } from "./baseClasses"
import { StandardRoomData, StandardRoomInputData, StandardRoomObjectData } from "./dataTypes/room"
import { ReferenceFormat } from "./utils/references"
import { StandardToJSONOptions } from "./baseClasses"
import { ReferenceList } from "./reference"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { StandardReferenceData } from "./dataTypes/reference"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaObject, isSchemaRoom, isSchemaShortName, isSchemaRender } from "@tonylb/mtw-base/ts/schema/components"
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
import type { StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import { renderReference } from "./utils/schema"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { ExitFacetList, StandardExitFacet } from "../keys/facets/exit"
import { parseProseTripletChildren, renderPayloadToSchemaNode, SituationProseFacetList, SituationProseFacetPayload, StandardSituationProseFacet, mapSituationProsePayloadContents } from "../keys/facets/situationRoom"
import { StandardExplicitParent } from "../explicit"
import { StandardFormSubsetRequest } from "../baseClasses"
import { processWithConsumers, StandardizeConsumerFacetListSituation, StandardizeConsumerReferenceList, StandardizeConsumerSimple, type StandardizeConsumer } from "./fromSchemaPipeline"
import { SingleReference } from "../keys/singleReference"

export class StandardRoomPayload implements ComponentConstructorMethods<StandardRoomInputData, StandardRoomData> {
    _shortName?: StandardLiteral;
    _exits: ExitFacetList;
    _situations: SituationProseFacetList;
    _lens: SingleReference;
    _features: ReferenceList;
    _guidance: ReferenceList;
    _characters: ReferenceList;
    _objects: StandardRoomObjectData[];
    _render?: SituationProseFacetPayload;
    tag = 'Room' as const

    constructor(previous?: StandardRoomPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._exits = previous.exits.clone()
            this._situations = previous.situations.clone()
            this._lens = previous._lens.clone()
            this._features = previous._features.clone()
            this._guidance = previous._guidance.clone()
            this._characters = previous._characters.clone()
            this._objects = [...previous._objects]
            this._render = previous._render?.clone()
        }
        else {
            this._exits = new ExitFacetList([])
            this._situations = new SituationProseFacetList([])
            this._lens = new SingleReference([])
            this._guidance = new ReferenceList([])
            this._features = new ReferenceList([])
            this._characters = new ReferenceList([])
            this._objects = []
        }
    }

    fromJSON(props: StandardRoomInputData) {
        const { shortName } = props
        this._shortName = createShortNameFromJSON(shortName)
        this._exits = new ExitFacetList(props.exits ?? [])
        this._situations = new SituationProseFacetList(props.situations ?? [])
        this._lens = SingleReference.fromData(props.lens)
        this._features = new ReferenceList(props.features?.map((reference) => (new StandardReference(reference))) ?? [])
        this._guidance = new ReferenceList(props.guidance?.map((reference) => (new StandardReference(reference))) ?? [])
        this._characters = new ReferenceList(props.characters?.map((reference) => (new StandardReference(reference))) ?? [])
        this._objects = (props.objects ?? []).map((o) => ({
            uuid: enforceTypedKey('OBJECT')(o.uuid),
            shortName: o.shortName,
        }))
        this._render = props.render ? new SituationProseFacetPayload(props.render) : undefined
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaRoom)(node)) {
            // Process-and-remainder pipeline: each step consumes one tag and passes remainder to the next.
            // Unconsumed children (e.g. unknown tags) cause processWithConsumers to throw. See AGENT.implementation.md (fromSchema: process-and-remainder pipeline).
            const consumers: StandardizeConsumer[] = [
                standardizeShortNameConsumer(this),
                new StandardizeConsumerReferenceList(this, {
                    tag: "Lens",
                    update(list) {
                        this._lens = SingleReference.fromReferenceList(list)
                    }
                }),
                new StandardizeConsumerReferenceList(this, { tag: "Feature", update(list) { this._features = list } }),
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
                    tag: 'Object',
                    update(matched) {
                        this._objects = matched.map((objectNode) => {
                            if (!isSchemaObject(objectNode.data)) {
                                throw new Error('Expected Object schema node')
                            }
                            const shortNameNodes = objectNode.children.filter((c) => isSchemaShortName(c.data))
                            if (shortNameNodes.length !== 1) {
                                throw new Error('Object tag must contain exactly one ShortName child')
                            }
                            const textValue = shortNameNodes[0].children
                                .map(({ data }) => data)
                                .filter(isSchemaString)
                                .map(({ value }) => value)
                                .join('')
                                .trim()
                            if (!textValue) {
                                throw new Error('Object ShortName must contain non-empty text after trim')
                            }
                            const objectUuid = objectNode.data.uuid
                            if (!objectUuid) {
                                throw new Error('Object tag must have a non-empty uuid')
                            }
                            return { uuid: enforceTypedKey('OBJECT')(objectUuid), shortName: textValue }
                        })
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
    get objects() {
        return this._objects
    }
    get render() {
        return this._render?.toJSON()
    }
    get exits() { return this._exits }
    get situations() { return this._situations }
    get lens() { return this._lens }
    get features() { return this._features }
    get guidance() { return this._guidance }
    get characters() { return this._characters }

    toJSON(_options?: StandardToJSONOptions): Omit<StandardRoomData, 'key' | 'universalKey'> {
        return {
            tag: 'Room',
            shortName: shortNameToJSON(this.shortName),
            ...(this.exits.length ? { exits: this.exits.toJSON() } : {}),
            ...(this.situations.length ? { situations: this.situations.toJSON() } : {}),
            ...(this.lens.payload.length ? { lens: this.lens.toJSON() } : {}),
            ...(this.features.payload.length ? { features: this.features.toJSON() } : {}),
            ...(this.guidance.payload.length ? { guidance: this.guidance.toJSON() } : {}),
            ...(this.characters.payload.length ? { characters: this.characters.toJSON() } : {}),
            ...(this._objects.length ? { objects: this._objects.map((o) => ({ ...o })) } : {}),
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
        
        const objectSchemas: GenericTreeNode<SchemaTag>[] = this._objects.map((o) => ({
            data: { tag: 'Object', uuid: o.uuid as ComponentUUID },
            children: [
                {
                    data: { tag: 'ShortName' },
                    children: [{ data: { tag: 'String', value: o.shortName }, children: [] }],
                },
            ],
        }))
        const renderSchemas: GenericTreeNode<SchemaTag>[] = this._render ? [renderPayloadToSchemaNode(this._render, mappings)] : []
        return {
            data: { tag: 'Room', key, uuid: universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...this.lens.schema,
                ...this.features.schema,
                ...this.guidance.schema,
                ...this.characters.schema,
                ...situationSchemas,
                ...exitSchemas,
                ...objectSchemas,
                ...renderSchemas
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key, mappings } = options
        
        // If organization is available, use assured references from organization
        // Otherwise, fall back to stored reference lists
        let lensToRender = this.lens
        let featuresToRender = this.features
        let guidanceToRender = this.guidance
        let charactersToRender = this.characters
        let inlineRemainder: StandardReference[] = []

        if (options.organization) {
            // Get children from organization and assure references
            const children = options.organization.getChildrenOfParent(key) ?? []
            const { payload: assured, inlineRemainder: remainder } = this.assureReferences(children)
            lensToRender = assured.lens
            featuresToRender = assured.features
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
        
        const objectSchemas: GenericTreeNode<SchemaTag>[] = this._objects.map((o) => ({
            data: { tag: 'Object', uuid: o.uuid as ComponentUUID },
            children: [
                {
                    data: { tag: 'ShortName' },
                    children: [{ data: { tag: 'String', value: o.shortName }, children: [] }],
                },
            ],
        }))
        const renderSchemas: GenericTreeNode<SchemaTag>[] = this._render ? [renderPayloadToSchemaNode(this._render, mappings)] : []
        // Pass this Room's key as parent context to children for correct rendering
        return {
            data: { tag: 'Room', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...lensToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...featuresToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...guidanceToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...charactersToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...inlineRemainder.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...situationSchemas,
                ...exitSchemas,
                ...objectSchemas,
                ...renderSchemas
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardRoomPayload()
        returnValue._shortName = mergeShortName(this._shortName, incoming._shortName)
        const mergedExits = this._exits.merge(incoming._exits)
        returnValue._exits = mergedExits ?? new ExitFacetList([])
        const mergedSituations = this._situations.merge(incoming._situations)
        returnValue._situations = mergedSituations ?? new SituationProseFacetList([])
        returnValue._lens = this._lens.merge(incoming._lens)
        returnValue._features = this._features.merge(incoming._features) ?? new ReferenceList([])
        returnValue._guidance = this._guidance.merge(incoming._guidance) ?? new ReferenceList([])
        returnValue._characters = this._characters.merge(incoming._characters) ?? new ReferenceList([])
        returnValue._objects = [...this._objects, ...incoming._objects]
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
        returnValue._exits = this._exits.invert()
        returnValue._situations = this._situations.invert()
        // Invert each ReferenceList
        returnValue._lens = this._lens.invert()
        returnValue._features = this._features.invert()
        returnValue._guidance = this._guidance.invert()
        returnValue._characters = this._characters.invert()
        returnValue._objects = []
        returnValue._render = this._render?.invert()
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        const BUCKET_TAGS = ['Lens', 'Feature', 'Guidance', 'Character'] as const
        const bucketChildren = children.filter((c): c is StandardReference => BUCKET_TAGS.includes(c.tag as (typeof BUCKET_TAGS)[number]))
        const remainder = children.filter(c => !BUCKET_TAGS.includes(c.tag as (typeof BUCKET_TAGS)[number]))

        const returnValue = new StandardRoomPayload(this)

        const lensReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Lens').map(child => child.withRef(0))
        )
        const featureReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Feature').map(child => child.withRef(0))
        )
        const guidanceReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Guidance').map(child => child.withRef(0))
        )
        const characterReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Character').map(child => child.withRef(0))
        )

        returnValue._lens = this._lens.merge(SingleReference.fromReferenceList(lensReferences))
        returnValue._features = this._features.merge(featureReferences, { cleanEmptyReferences: false }) ?? this._features
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
        returnValue._features = this._features.filter(
            item => !references.some(ref => item.sameKey(ref))
        )
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
            ...this.features.payload.map((reference) => ({ referenceType: 'Direct' as const, reference })),
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
        returnValue._features = returnValue._features.toFormat(props.mapTo, props.mappings)
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
        else if (child.tag === 'Feature') {
            returnValue._features = returnValue._features.assureItem(child)
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
        const hasExits = this._exits.length > 0
        const hasSituations = this._situations.length > 0
        const hasLens = this._lens.payload.length > 0
        const hasFeatures = this._features.payload.length > 0
        const hasGuidance = this._guidance.payload.length > 0
        const hasCharacters = this._characters.payload.length > 0
        const hasObjects = this._objects.length > 0
        const hasRender = Boolean(this._render)
        return !(hasShortName || hasExits || hasSituations || hasLens || hasFeatures || hasGuidance || hasCharacters || hasObjects || hasRender)
    }
}

export class StandardRoom extends componentClassFactory(StandardRoomPayload, 'StandardRoom') {
    get exits() { return this._payload.exits }
    get situations() { return this._payload.situations }
    get lens() { return this._payload.lens }
    get features() { return this._payload.features }
    get guidance() { return this._payload.guidance }
    get characters() { return this._payload.characters }
    get objects() { return this._payload.objects }
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
        // Intentional non-adoption for this slice: room.render remains strict payload deep-equality
        // until we decide whether render payload should use StandardRender/defaultedEquals semantics
        // or a dedicated SituationRoomFacetPayload.equals contract.
        return !(this.lens.diff(incoming.lens)?.payload.length) &&
            !(this.features.diff(incoming.features)?.payload.length) &&
            !(this.guidance.diff(incoming.guidance)?.payload.length) &&
            !(this.characters.diff(incoming.characters)?.payload.length) &&
            !(exitsDiff?.length) &&
            !(situationsDiff?.length) &&
            shortNameEqual &&
            deepEqual(this.objects, incoming.objects) &&
            deepEqual(this.render, incoming.render)
    }

}

export default StandardRoom
