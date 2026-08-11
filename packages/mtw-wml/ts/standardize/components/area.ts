import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import { StandardAreaData } from "./dataTypes/area"
import { ReferenceFormat } from "./utils/references"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isSchemaArea } from "@tonylb/mtw-base/ts/schema/components"
import { ReferenceList } from "./reference"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { excludeUndefined } from "../../lib/lists"
import { renderReference } from "./utils/schema"
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
    StandardizeConsumerInline,
    StandardizeConsumerReferenceList,
    StandardizeConsumerSimple,
    type StandardizeConsumer,
} from "./fromSchemaPipeline"
import StandardLudicGraph from "./ludicGraph"
import { LUDIC_GRAPH_NODE_TAGS } from "./dataTypes/ludicGraph"
import { ExitEdgeList, StandardExitEdge, validateAreaExitSchemaNode } from "../keys/edges/exitEdge"
import { referencesFromExitEndpoint } from "../keys/edges/endpointReference"
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components"

const LUDIC_GRAPH_NODE_TAG_SET = new Set<string>(LUDIC_GRAPH_NODE_TAGS)

export class StandardAreaPayload implements ComponentConstructorMethods<StandardAreaData, StandardAreaData> {
    _shortName?: StandardLiteral;
    _ludicGraph: StandardLudicGraph;
    tag = 'Area' as const

    constructor(previous?: StandardAreaPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._ludicGraph = previous._ludicGraph.clone()
        }
        else {
            this._ludicGraph = new StandardLudicGraph()
        }
    }

    get ludicGraph(): StandardLudicGraph {
        return this._ludicGraph
    }

    get shortName() { return this._shortName }

    private withLudicGraphNodes(nodes: ReferenceList): void {
        const graphJSON = this._ludicGraph.toJSON() ?? {}
        this._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: nodes.toJSON(),
        })
    }

    private appendLudicGraphNodes(list: ReferenceList): void {
        const merged = this._ludicGraph.nodes.merge(list) ?? new ReferenceList([])
        this.withLudicGraphNodes(merged)
    }

    private appendLudicGraphEdges(list: ExitEdgeList): void {
        const merged = this._ludicGraph.edges.merge(list) ?? new ExitEdgeList([])
        const graphJSON = this._ludicGraph.toJSON() ?? {}
        this._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            edges: merged.toJSON(),
        })
    }

    private assertNoSelfAreaReference(identity: {
        key?: string | StandardEditableData<string>;
        universalKey?: ComponentUUID;
    }): void {
        const plainKey = typeof identity.key === 'string' ? identity.key : undefined
        if (!plainKey && !identity.universalKey) {
            return
        }
        const selfReference = new StandardReference({
            tag: 'Area',
            ...(plainKey ? { key: plainKey } : {}),
            ...(identity.universalKey ? { universalKey: identity.universalKey } : {}),
        })
        const hasSelfReference = this._ludicGraph.nodes.payload.some(
            (reference) => reference.tag === 'Area' && reference.sameKey(selfReference)
        )
        if (hasSelfReference) {
            throw new Error('Area cannot reference itself in ludicGraph.nodes')
        }
    }

    fromJSON(props: StandardAreaData) {
        this._shortName = createShortNameFromJSON(props.shortName)
        this._ludicGraph = StandardLudicGraph.fromJSON(props.ludicGraph)
        this.assertNoSelfAreaReference({ key: props.key, universalKey: props.universalKey })
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaArea)(node)) {
            const appendNodes = (list: ReferenceList) => {
                this.appendLudicGraphNodes(list)
            }
            const consumers: StandardizeConsumer[] = [
                standardizeShortNameConsumer(this),
                ...LUDIC_GRAPH_NODE_TAGS.map((tag) => new StandardizeConsumerReferenceList(this, {
                    tag,
                    update(list) {
                        appendNodes.call(this, list)
                    },
                })),
                new StandardizeConsumerSimple(this, {
                    tag: 'Exit',
                    update(matched) {
                        const parsedEdges = matched.map((exitNode) => {
                            if (!treeNodeTypeguard(isSchemaExit)(exitNode)) {
                                throw new Error('Expected Exit schema node')
                            }
                            validateAreaExitSchemaNode(exitNode)
                            return new StandardExitEdge([exitNode])
                        })
                        this.appendLudicGraphEdges(new ExitEdgeList(parsedEdges))
                    },
                }),
                new StandardizeConsumerInline(),
            ]
            const returnRemainder = processWithConsumers(this, consumers, node.children)
            this.assertNoSelfAreaReference({ key: node.data.key, universalKey: node.data.uuid })
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardArea constructor')
    }

    toJSON(): Omit<StandardAreaData, 'key' | 'universalKey'> {
        const ludicGraphJSON = this._ludicGraph.toJSON()
        return {
            tag: 'Area',
            ...(this._shortName ? { shortName: shortNameToJSON(this._shortName) } : {}),
            ...(ludicGraphJSON ? { ludicGraph: ludicGraphJSON } : {}),
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Area', key, uuid: universalKey },
            children: [
                ...shortNameSchemaChildren(this._shortName),
                ...this._ludicGraph.nodes.schema,
                ...this._ludicGraph.edges.schema,
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options

        let nodesToRender = this._ludicGraph.nodes
        let inlineRemainder: StandardReference[] = []

        if (options.organization) {
            const children = options.organization.getChildrenOfParent(key) ?? []
            const { payload: assured, inlineRemainder: remainder } = this.assureReferences(children)
            nodesToRender = assured._ludicGraph.nodes
            inlineRemainder = remainder
        }

        return {
            data: { tag: 'Area', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...shortNameSchemaChildren(this._shortName),
                ...nodesToRender.payload.map(renderReference({ lookup, options })).filter(excludeUndefined).flat(1),
                ...this._ludicGraph.edges.schema,
                ...inlineRemainder.map(renderReference({ lookup, options })).filter(excludeUndefined),
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardAreaPayload()
        returnValue._shortName = mergeShortName(this._shortName, incoming._shortName)
        returnValue._ludicGraph = this._ludicGraph.merge(incoming._ludicGraph)
        return returnValue as this
    }

    subset(): this {
        return new StandardAreaPayload() as this
    }

    referencedKeys(): StandardComponentReferenceKey[] {
        const nodeKeys: StandardComponentReferenceKey[] = [
            ...this._ludicGraph.nodes.payload.map((reference) => ({ referenceType: 'Direct' as const, reference })),
            ...this._ludicGraph.nodes.payload.map((reference) => ({ referenceType: 'Dependency' as const, reference })),
        ]
        const edgeKeys: StandardComponentReferenceKey[] = this._ludicGraph.edges.items.flatMap((edge) => {
            const endpointRefs = [
                ...referencesFromExitEndpoint(edge.from),
                ...referencesFromExitEndpoint(edge.to),
            ]
            return endpointRefs.map((reference) => ({ referenceType: 'Edge' as const, reference }))
        })
        return [...nodeKeys, ...edgeKeys]
    }

    mapContents(_callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardAreaPayload(this)
        const graphJSON = returnValue._ludicGraph.toJSON() ?? {}
        returnValue._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: returnValue._ludicGraph.nodes.toFormat(props.mapTo, props.mappings).toJSON(),
            edges: returnValue._ludicGraph.edges.toFormat(props.mapTo).lookup(props.mappings).toJSON(),
        })
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardAreaPayload(this)
        if (!LUDIC_GRAPH_NODE_TAG_SET.has(child.tag)) {
            throw new Error(`Invalid child type ${child.tag} for StandardArea`)
        }
        returnValue.appendLudicGraphNodes(new ReferenceList([child]))
        return returnValue as this
    }

    isEmpty(): boolean {
        const hasShortName = Boolean(this._shortName)
        const hasLudicGraph =
            this._ludicGraph.nodes.payload.length > 0 || !this._ludicGraph.edges.isEmpty()
        return !(hasShortName || hasLudicGraph)
    }

    invert(): this {
        const returnValue = new StandardAreaPayload()
        returnValue._shortName = invertShortName(this._shortName)
        const graphJSON = this._ludicGraph.toJSON() ?? {}
        returnValue._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: this._ludicGraph.nodes.invert().toJSON(),
            edges: this._ludicGraph.edges.invert().toJSON(),
        })
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        const bucketChildren = children.filter((c) => LUDIC_GRAPH_NODE_TAG_SET.has(c.tag))
        const remainder = children.filter((c) => !LUDIC_GRAPH_NODE_TAG_SET.has(c.tag))

        const returnValue = new StandardAreaPayload(this)
        const bucketReferences = new ReferenceList(
            bucketChildren.map((child) => child.withRef(0))
        )
        const merged = returnValue._ludicGraph.nodes.merge(bucketReferences, { cleanEmptyReferences: false })
            ?? returnValue._ludicGraph.nodes
        const graphJSON = returnValue._ludicGraph.toJSON() ?? {}
        returnValue._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: merged.toJSON(),
        })

        return {
            payload: returnValue as this,
            inlineRemainder: remainder.map((c) => c.withRef(0))
        }
    }

    removeReferences(references: StandardReference[]): this {
        const returnValue = new StandardAreaPayload(this)
        const graphJSON = returnValue._ludicGraph.toJSON() ?? {}
        returnValue._ludicGraph = new StandardLudicGraph({
            ...graphJSON,
            nodes: returnValue._ludicGraph.nodes.filter(
                (item) => !references.some((ref) => item.sameKey(ref))
            ).toJSON(),
        })
        return returnValue as this
    }
}

export class StandardArea extends componentClassFactory(StandardAreaPayload, 'StandardArea') {
    get ludicGraph() { return this._payload.ludicGraph }

    override _wrap(instance: StandardComponent): this {
        return new StandardArea(instance as StandardArea) as this
    }

    override clone(): StandardArea {
        const returnValue = new StandardArea(this)
        returnValue._payload = new StandardAreaPayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardArea)) {
            return false
        }
        const shortNameEqual = (this.shortName ?? new StandardLiteral('')).equals(incoming.shortName ?? new StandardLiteral(''))
        return shortNameEqual && this.ludicGraph.equals(incoming.ludicGraph)
    }

    override invert(): StandardArea {
        return new StandardArea(super.invert() as StandardArea)
    }
}

export default StandardArea
