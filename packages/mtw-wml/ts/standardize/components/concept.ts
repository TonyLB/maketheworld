import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import { StandardToJSONOptions } from "./baseClasses"
import { ReferenceFormat } from "./utils/references"
import { StandardConceptData } from "./dataTypes/concept"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaConcept } from "@tonylb/mtw-base/ts/schema/components"
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
    type GlossHost,
} from "./glossField"
import {
    processWithConsumers,
    StandardizeConsumerInline,
    StandardizeConsumerReferenceList,
    type StandardizeConsumer,
} from "./fromSchemaPipeline"
import { defaultedEquals } from "./utils"
import { ReferenceList } from "./reference"
import StandardLudicGraph from "./ludicGraph"
import { LUDIC_GRAPH_NODE_TAGS } from "./dataTypes/ludicGraph"
import { excludeUndefined } from "../../lib/lists"
import { renderReference } from "./utils/schema"

const LUDIC_GRAPH_NODE_TAG_SET = new Set<string>(LUDIC_GRAPH_NODE_TAGS)

/**
 * A Concept is present only by association (AK-1). It names its members the way every other
 * component does: nested references become `ludicGraph.nodes` memberships, and an inline
 * definition is promoted to a top-level component. It carries no render and no situations
 * (describing one is AK-9, open).
 */
export class StandardConceptPayload implements ComponentConstructorMethods<StandardConceptData, StandardConceptData> {
    _shortName?: StandardLiteral;
    _gloss?: StandardLiteral;
    _ludicGraph: StandardLudicGraph;
    tag = 'Concept' as const

    constructor(previous?: StandardConceptPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._gloss = previous._gloss
            this._ludicGraph = previous._ludicGraph.clone()
        }
        else {
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

    fromJSON(props: StandardConceptData) {
        this._shortName = createShortNameFromJSON(props.shortName)
        this._gloss = createGlossFromJSON(props.gloss)
        this._ludicGraph = StandardLudicGraph.fromJSON(props.ludicGraph)
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaConcept)(node)) {
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
                new StandardizeConsumerInline(),
            ]
            return processWithConsumers(this, consumers, node.children)
        }
        throw new Error('Schema mismatch in StandardConcept constructor')
    }

    get shortName() {
        return this._shortName
    }
    get gloss() {
        return this._gloss
    }

    toJSON(_options?: StandardToJSONOptions): Omit<StandardConceptData, 'key' | 'universalKey'> {
        const ludicGraphJSON = this._ludicGraph.toJSON()
        return {
            tag: 'Concept',
            ...(this.shortName ? { shortName: shortNameToJSON(this.shortName) } : {}),
            ...(this.gloss ? { gloss: glossToJSON(this.gloss) } : {}),
            ...(ludicGraphJSON ? { ludicGraph: ludicGraphJSON } : {}),
        }
    }

    schema(_key: string, universalKey?: ComponentUUID, _mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Concept', uuid: universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...glossSchemaChildren(this.gloss),
                ...this._ludicGraph.nonRootComponentRefs.schema,
            ],
        }
    }

    subset({ requestType }: StandardFormSubsetRequest): this {
        if (requestType === 'Full') {
            return new StandardConceptPayload(this) as this
        }
        return new StandardConceptPayload() as this
    }

    merge(incoming: this): this {
        const returnValue = new StandardConceptPayload()
        returnValue._shortName = mergeShortName(this._shortName, incoming._shortName)
        returnValue._gloss = mergeGloss(this._gloss, incoming._gloss)
        returnValue._ludicGraph = this._ludicGraph.merge(incoming._ludicGraph)
        return returnValue as this
    }

    referencedKeys(_mapping: StandardReference[]): StandardComponentReferenceKey[] {
        const rootId = this._ludicGraph.rootId
        return this._ludicGraph.nodes.componentRefs.payload
            .filter((reference) => !(rootId && reference.sameKey(rootId)))
            .map((reference) => ({ referenceType: 'Direct' as const, reference }))
    }

    isEmpty(): boolean {
        return !(Boolean(this._shortName) || Boolean(this._gloss) || this._ludicGraph.nodes.payload.length > 0)
    }

    invert(): this {
        const returnValue = new StandardConceptPayload()
        returnValue._shortName = invertShortName(this._shortName)
        returnValue._gloss = invertGloss(this._gloss)
        const graphJSON = this._ludicGraph.toJSON() ?? {}
        returnValue._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: this._ludicGraph.nodes.invert().toJSON(),
        })
        return returnValue as this
    }

    mapContents(_callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return new StandardConceptPayload(this) as this
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardConceptPayload(this)
        const graphJSON = returnValue._ludicGraph.toJSON() ?? {}
        returnValue._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: returnValue._ludicGraph.nodes.toFormat(props.mapTo, props.mappings).toJSON(),
        })
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardConceptPayload(this)
        if (LUDIC_GRAPH_NODE_TAG_SET.has(child.tag)) {
            returnValue.appendLudicGraphNodes(new ReferenceList([child]))
        }
        else {
            throw new Error(`Invalid child type ${child.tag} for StandardConcept`)
        }
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        const bucketChildren = children.filter((c) => LUDIC_GRAPH_NODE_TAG_SET.has(c.tag))
        const remainder = children.filter((c) => !LUDIC_GRAPH_NODE_TAG_SET.has(c.tag))

        const returnValue = new StandardConceptPayload(this)
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
        const returnValue = new StandardConceptPayload(this)
        const filteredNodes = returnValue._ludicGraph.nodes.componentRefs.filter(
            (item) => !references.some((ref) => item.sameKey(ref))
        )
        returnValue.withLudicGraphNodes(filteredNodes)
        return returnValue as this
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options

        let nodesToRender = this._ludicGraph.nodes.componentRefs

        if (options.organization) {
            const graphChildren = (options.organization.getChildrenOfParent(key) ?? [])
                .filter((child) => LUDIC_GRAPH_NODE_TAG_SET.has(child.tag))
            const bucketReferences = new ReferenceList(graphChildren.map((child) => child.withRef(0)))
            nodesToRender = this._ludicGraph.nodes.componentRefs.merge(bucketReferences, { cleanEmptyReferences: false })
                ?? this._ludicGraph.nodes.componentRefs
        }

        // Excludes the root itself (see StandardObject.nestedSchema): a self-referencing
        // `<Concept uuid=(id) />` inside its own `<Concept uuid=(id)>` is semantically empty and
        // structurally invalid on re-parse.
        const nonRootNodesToRender = this._ludicGraph.excludeRoot(nodesToRender)

        return {
            data: { tag: 'Concept', uuid: key.universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...glossSchemaChildren(this.gloss),
                ...nonRootNodesToRender.payload.map(renderReference({ lookup, options })).filter(excludeUndefined).flat(1),
            ],
        }
    }
}

export class StandardConcept extends componentClassFactory(StandardConceptPayload, 'StandardConcept') implements GlossHost {
    get ludicGraph() { return this._payload.ludicGraph }

    constructor(
        props: string | StandardConceptData | GenericTreeNode<SchemaTag> | StandardConcept,
        options?: StandardFormConstructionOptions,
    ) {
        super(props, options)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardConcept(instance as StandardConcept) as this
    }

    override clone(): StandardConcept {
        const returnValue = new StandardConcept(this)
        returnValue._payload = new StandardConceptPayload(this._payload)
        return returnValue
    }

    get gloss(): StandardLiteral | undefined { return this._payload._gloss }

    withGloss(gloss: StandardLiteral | undefined): this {
        const returnValue = this.clone()
        returnValue._payload._gloss = gloss
        return this._wrap(returnValue)
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardConcept)) {
            return false
        }
        return defaultedEquals(this.shortName, incoming.shortName) &&
            defaultedEquals(this.gloss, incoming.gloss) &&
            this.ludicGraph.equals(incoming.ludicGraph)
    }
}

export default StandardConcept
