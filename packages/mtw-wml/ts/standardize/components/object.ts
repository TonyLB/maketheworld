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
    processWithConsumers,
    StandardizeConsumerFacetListSituation,
    StandardizeConsumerInline,
    StandardizeConsumerSimple,
    type StandardizeConsumer,
} from "./fromSchemaPipeline"
import { defaultedEquals } from "./utils"
import { parseProseTripletChildren, renderPayloadToSchemaNode, SituationProseFacetList, SituationProseFacetPayload, StandardSituationProseFacet, mapSituationProsePayloadContents } from "../keys/facets/situationRoom"
import type { StandardFacetData } from "../keys/facets/dataTypes/facet"
import type { SituationProseFacetPayloadType } from "../keys/facets/situationRoom"

export class StandardObjectPayload implements ComponentConstructorMethods<StandardObjectData, StandardObjectData> {
    _shortName?: StandardLiteral;
    _situations: SituationProseFacetList;
    _render?: SituationProseFacetPayload;
    tag = 'Object' as const

    constructor(previous?: StandardObjectPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._situations = previous._situations.clone()
            this._render = previous._render?.clone()
        }
        else {
            this._situations = new SituationProseFacetList([])
        }
    }

    fromJSON(props: StandardObjectData) {
        const { shortName } = props
        this._shortName = createShortNameFromJSON(shortName)
        this._situations = new SituationProseFacetList(props.situations ?? [])
        this._render = props.render ? new SituationProseFacetPayload(props.render) : undefined
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaObject)(node)) {
            const consumers: StandardizeConsumer[] = [
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
    get situations() { return this._situations }
    get render() {
        return this._render?.toJSON()
    }

    toJSON(_options?: StandardToJSONOptions): Omit<StandardObjectData, 'key' | 'universalKey'> {
        return {
            tag: 'Object',
            ...(this.shortName ? { shortName: shortNameToJSON(this.shortName) } : {}),
            ...(this.situations.length ? { situations: this.situations.toJSON() } : {}),
            ...(this._render ? { render: this._render.toJSON() } : {}),
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
                ...situationSchemas,
                ...renderSchemas,
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

    isEmpty(): boolean {
        const hasShortName = Boolean(this._shortName)
        const hasSituations = this._situations.length > 0
        const hasRender = Boolean(this._render)
        return !(hasShortName || hasSituations || hasRender)
    }

    invert(): this {
        const returnValue = new StandardObjectPayload()
        returnValue._shortName = invertShortName(this._shortName)
        returnValue._situations = this._situations.invert()
        returnValue._render = this._render?.invert()
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
        else {
            throw new Error(`Invalid child type ${child.tag} for StandardObject`)
        }
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        return {
            payload: new StandardObjectPayload(this) as this,
            inlineRemainder: children.map(c => c.withRef(0)),
        }
    }

    removeReferences(references: StandardReference[]): this {
        const returnValue = new StandardObjectPayload(this)
        returnValue._situations = new SituationProseFacetList(
            this._situations.items.filter(
                facet => !references.some(ref => facet.reference.sameKey(ref))
            )
        )
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
        return {
            data: { tag: 'Object', uuid: key.universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...situationSchemas,
                ...renderSchemas,
            ],
        }
    }
}

export class StandardObject extends componentClassFactory(StandardObjectPayload, 'StandardObject') {
    get situations() { return this._payload.situations }
    get render() { return this._payload.render }

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

export default StandardObject
