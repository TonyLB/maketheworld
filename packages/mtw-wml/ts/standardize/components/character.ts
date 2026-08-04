import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { EditWrappedStandardNode } from "../baseClasses"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardCharacterData } from "./dataTypes/character"
import { AssetUUID, ComponentUUID, isSchemaCharacter, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaImage, SchemaImageTag } from "@tonylb/mtw-base/ts/schema/image"
import { isSchemaDisplayName, SchemaDisplayNameTag } from "@tonylb/mtw-base/ts/schema/prose"
import { isSchemaRender } from "@tonylb/mtw-base/ts/schema/components"
import { StandardLiteral } from "../literal"
import {
    createShortNameFromJSON,
    invertShortName,
    mergeShortName,
    shortNameSchemaChildren,
    shortNameToJSON,
    standardizeShortNameConsumer,
} from "./shortNameField"
import type { StandardFormConstructionOptions, StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { StandardRender } from "../render"
import { StandardExplicitParent } from "../explicit"
import { ReferenceFormat } from "./utils/references"
import {
    processWithConsumers,
    StandardizeConsumerFacetListSituation,
    StandardizeConsumerRender,
    StandardizeConsumerSimple,
    StandardizeConsumerStandardLiteral,
    type StandardizeConsumer,
} from "./fromSchemaPipeline"
import { parseProseTripletChildren, renderPayloadToSchemaNode, SituationProseFacetList, SituationProseFacetPayload, StandardSituationProseFacet, mapSituationProsePayloadContents } from "../keys/facets/situationRoom"
import type { StandardFacetData } from "../keys/facets/dataTypes/facet"
import type { SituationProseFacetPayloadType } from "../keys/facets/situationRoom"

export class StandardCharacterPayload implements ComponentConstructorMethods<StandardCharacterData, StandardCharacterData> {
    _displayName?: StandardLiteral;
    _shortName?: StandardLiteral;
    _pronouns?: StandardLiteral;
    _image?: EditWrappedStandardNode<SchemaImageTag, SchemaTag>;
    _situations: SituationProseFacetList;
    _render?: SituationProseFacetPayload;
    tag = 'Character' as const

    constructor(previous?: StandardCharacterPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._displayName = previous._displayName
            this._image = previous._image
            this._pronouns = previous._pronouns
            this._situations = previous._situations.clone()
            this._render = previous._render?.clone()
        }
        else {
            this._situations = new SituationProseFacetList([])
        }
    }

    fromJSON(props: StandardCharacterData) {
        const { shortName, pronouns, displayName } = props
        this._shortName = createShortNameFromJSON(shortName)
        this._pronouns = pronouns ? new StandardLiteral(pronouns, { tag: 'Pronouns' }) : undefined
        this._displayName = displayName ? new StandardLiteral(displayName, { tag: 'DisplayName' }) : undefined
        this._image = props.image
        this._situations = new SituationProseFacetList(props.situations ?? [])
        this._render = props.render ? new SituationProseFacetPayload(props.render) : undefined
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaCharacter)(node)) {
            const consumers: StandardizeConsumer[] = [
                standardizeShortNameConsumer(this),
                new StandardizeConsumerStandardLiteral(this, {
                    tag: "Pronouns",
                    update(literal) {
                        this._pronouns = literal
                    },
                }),
                new StandardizeConsumerStandardLiteral(this, {
                    tag: "DisplayName",
                    update(literal) {
                        this._displayName = literal
                    },
                }),
                new StandardizeConsumerSimple(this, {
                    tag: "Image",
                    update(matched) {
                        const findImage = (nodes: GenericTree<SchemaTag>): EditWrappedStandardNode<SchemaImageTag, SchemaTag> | undefined => {
                            for (const node of nodes) {
                                if (treeNodeTypeguard(isSchemaImage)(node)) {
                                    return node as EditWrappedStandardNode<SchemaImageTag, SchemaTag>
                                }
                                const childFound = findImage(node.children)
                                if (childFound) {
                                    return childFound
                                }
                            }
                            return undefined
                        }
                        this._image = findImage(matched)
                    },
                }),
                new StandardizeConsumerFacetListSituation(this, {
                    update(list) {
                        this._situations = list
                    },
                }),
                new StandardizeConsumerSimple(this, {
                    tag: 'Render',
                    update(matched) {
                        if (matched.length === 0) {
                            return
                        }
                        if (matched.length > 1) {
                            throw new Error('Character must contain at most one Render tag')
                        }
                        const renderNode = matched[0]
                        if (!isSchemaRender(renderNode.data)) {
                            throw new Error('Expected Render schema node')
                        }
                        const children = renderNode.children
                        const payloadData = parseProseTripletChildren(children, { allowUnconsumed: false })
                        const payload = new SituationProseFacetPayload(payloadData)
                        if (!payload.hasNonEmptyDisplayName()) {
                            throw new Error('Render DisplayName must contain non-empty text after trim')
                        }
                        this._render = payload
                    },
                }),
            ]
            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardCharacter constructor')
    }

    get shortName() { return this._shortName }
    get pronouns() { return this._pronouns}
    get displayName() { return this._displayName }
    get image() { return this._image }
    get situations() { return this._situations }
    get render() {
        return this._render?.toJSON()
    }

    toJSON(): Omit<StandardCharacterData, 'key' | 'universalKey'> {
        return {
            tag: 'Character',
            shortName: shortNameToJSON(this.shortName),
            pronouns: this?.pronouns?.toJSON(),
            displayName: this.displayName?.toJSON(),
            image: this.image,
            ...(this.situations.length ? { situations: this.situations.toJSON() } : {}),
            ...(this._render ? { render: this._render.toJSON() } : {}),
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
            data: { tag: 'Character', key, uuid: universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...[this.pronouns].filter(excludeUndefined).map((pronouns) => (pronouns.nestedSchema())).flat(1),
                ...(this._displayName?.nestedSchema({ tag: 'DisplayName' }) ?? []),
                this.image,
                ...situationSchemas,
                ...renderSchemas,
            ].filter(excludeUndefined).flat(1)
        }
    }

    merge(incoming: this): this {
        if (!(incoming instanceof StandardCharacterPayload)) {
            throw new Error('Type mistmatch on StandardCharacter merge')
        }
        const returnValue = new StandardCharacterPayload()
        returnValue._shortName = mergeShortName(this._shortName, incoming._shortName)
        returnValue._pronouns = (this._pronouns && incoming._pronouns) ? this._pronouns.merge(incoming._pronouns) : this._pronouns ?? incoming._pronouns
        returnValue._displayName = (this._displayName && incoming._displayName) ? this._displayName.merge(incoming._displayName) : this._displayName ?? incoming._displayName
        returnValue._image = this._image ?? incoming._image
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
        return new StandardCharacterPayload() as this
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
        const returnValue = new StandardCharacterPayload(this)
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
        const returnValue = new StandardCharacterPayload(this)
        returnValue._situations = returnValue._situations.lookup(props.mappings).remapReferences(props)
        if (returnValue._render) {
            returnValue._render = returnValue._render.remapReferences(props)
        }
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardCharacterPayload(this)
        if (child.tag === 'Situation') {
            const facetData: StandardFacetData<SituationProseFacetPayloadType> = {
                reference: child.toJSON(),
                payload: {},
            }
            const newFacet = new StandardSituationProseFacet(facetData)
            returnValue._situations = this._situations.merge(new SituationProseFacetList([newFacet])) ?? new SituationProseFacetList([newFacet])
        }
        else {
            throw new Error(`Invalid child type ${child.tag} for StandardCharacter`)
        }
        return returnValue as this
    }

    isEmpty(): boolean {
        // A character is empty if it has no displayName, shortName, pronouns, image, situations, or render
        const hasDisplayName = Boolean(this._displayName)
        const hasShortName = Boolean(this._shortName)
        const hasPronouns = Boolean(this._pronouns)
        const hasImage = Boolean(this._image)
        const hasSituations = this._situations.length > 0
        const hasRender = Boolean(this._render)
        return !(hasDisplayName || hasShortName || hasPronouns || hasImage || hasSituations || hasRender)
    }

    invert(): this {
        const returnValue = new StandardCharacterPayload()
        // Invert shortName if it exists (StandardLiteral has invert() from standardEditableFactory)
        returnValue._shortName = invertShortName(this._shortName)
        // Invert pronouns if it exists (StandardLiteral has invert() from standardEditableFactory)
        returnValue._pronouns = this._pronouns ? this._pronouns.invert() as StandardLiteral : undefined
        // Invert displayName if it exists (StandardLiteral has invert())
        returnValue._displayName = this._displayName ? this._displayName.invert() as StandardLiteral : undefined
        // Leave _image unchanged (EditWrappedStandardNode doesn't have invert support)
        returnValue._image = this._image
        returnValue._situations = this._situations.invert()
        returnValue._render = this._render?.invert()
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        return {
            payload: new StandardCharacterPayload(this) as this,
            inlineRemainder: children.map(c => c.withRef(0)),
        }
    }

    removeReferences(references: StandardReference[]): this {
        const returnValue = new StandardCharacterPayload(this)
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
            data: { tag: 'Character', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...[this.pronouns].filter(excludeUndefined).map((pronouns) => (pronouns.nestedSchema())).flat(1),
                ...(this._displayName?.nestedSchema({ tag: 'DisplayName' }) ?? []),
                this.image,
                ...situationSchemas,
                ...renderSchemas,
            ].filter(excludeUndefined).flat(1)
        }
    }
}

export class StandardCharacter extends componentClassFactory(StandardCharacterPayload, 'StandardCharacter') {
    get pronouns() { return this._payload.pronouns }
    get displayName() { return this._payload.displayName }
    get image() { return this._payload.image }
    get situations() { return this._payload.situations }
    get render() { return this._payload.render }

    constructor(
        props: string | StandardCharacterData | GenericTreeNode<SchemaTag> | StandardCharacter,
        options?: StandardFormConstructionOptions,
    ) {
        super(props, options)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardCharacter(instance as StandardCharacter) as this
    }

    override clone(): StandardCharacter {
        const returnValue = new StandardCharacter(this)
        returnValue._payload = new StandardCharacterPayload(this._payload)
        return returnValue
    }

    // No equals() override: the base class default (deepEqual on toJSON()) already
    // covers situations/render now that toJSON() serializes them, same as it already
    // covered pronouns/displayName/image.
}

export default StandardCharacter
