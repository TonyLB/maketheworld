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
    type StandardizeConsumer,
} from "./fromSchemaPipeline"
import StandardPositionGraph from "./positionGraph"
import { POSITION_GRAPH_NODE_TAGS } from "./dataTypes/positionGraph"

const POSITION_GRAPH_NODE_TAG_SET = new Set<string>(POSITION_GRAPH_NODE_TAGS)

export class StandardAreaPayload implements ComponentConstructorMethods<StandardAreaData, StandardAreaData> {
    _shortName?: StandardLiteral;
    _positionGraph: StandardPositionGraph;
    tag = 'Area' as const

    constructor(previous?: StandardAreaPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._positionGraph = previous._positionGraph.clone()
        }
        else {
            this._positionGraph = new StandardPositionGraph()
        }
    }

    get positionGraph(): StandardPositionGraph {
        return this._positionGraph
    }

    get shortName() { return this._shortName }

    private appendPositionGraphNodes(list: ReferenceList): void {
        const merged = this._positionGraph.nodes.merge(list) ?? new ReferenceList([])
        this._positionGraph = new StandardPositionGraph(merged)
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
        const hasSelfReference = this._positionGraph.nodes.payload.some(
            (reference) => reference.tag === 'Area' && reference.sameKey(selfReference)
        )
        if (hasSelfReference) {
            throw new Error('Area cannot reference itself in positionGraph.nodes')
        }
    }

    fromJSON(props: StandardAreaData) {
        this._shortName = createShortNameFromJSON(props.shortName)
        this._positionGraph = StandardPositionGraph.fromJSON(props.positionGraph)
        this.assertNoSelfAreaReference({ key: props.key, universalKey: props.universalKey })
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaArea)(node)) {
            const appendNodes = (list: ReferenceList) => {
                this.appendPositionGraphNodes(list)
            }
            const consumers: StandardizeConsumer[] = [
                standardizeShortNameConsumer(this),
                ...POSITION_GRAPH_NODE_TAGS.map((tag) => new StandardizeConsumerReferenceList(this, {
                    tag,
                    update(list) {
                        appendNodes.call(this, list)
                    },
                })),
                new StandardizeConsumerInline(),
            ]
            const returnRemainder = processWithConsumers(this, consumers, node.children)
            this.assertNoSelfAreaReference({ key: node.data.key, universalKey: node.data.uuid })
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardArea constructor')
    }

    toJSON(): Omit<StandardAreaData, 'key' | 'universalKey'> {
        const positionGraphJSON = this._positionGraph.toJSON()
        return {
            tag: 'Area',
            ...(this._shortName ? { shortName: shortNameToJSON(this._shortName) } : {}),
            ...(positionGraphJSON ? { positionGraph: positionGraphJSON } : {}),
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Area', key, uuid: universalKey },
            children: [
                ...shortNameSchemaChildren(this._shortName),
                ...this._positionGraph.nodes.schema,
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options

        let nodesToRender = this._positionGraph.nodes
        let inlineRemainder: StandardReference[] = []

        if (options.organization) {
            const children = options.organization.getChildrenOfParent(key) ?? []
            const { payload: assured, inlineRemainder: remainder } = this.assureReferences(children)
            nodesToRender = assured._positionGraph.nodes
            inlineRemainder = remainder
        }

        return {
            data: { tag: 'Area', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...shortNameSchemaChildren(this._shortName),
                ...nodesToRender.payload.map(renderReference({ lookup, options })).filter(excludeUndefined).flat(1),
                ...inlineRemainder.map(renderReference({ lookup, options })).filter(excludeUndefined),
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardAreaPayload()
        returnValue._shortName = mergeShortName(this._shortName, incoming._shortName)
        returnValue._positionGraph = this._positionGraph.merge(incoming._positionGraph)
        return returnValue as this
    }

    subset(): this {
        return new StandardAreaPayload() as this
    }

    referencedKeys(): StandardComponentReferenceKey[] {
        return [
            ...this._positionGraph.nodes.payload.map((reference) => ({ referenceType: 'Direct' as const, reference })),
            ...this._positionGraph.nodes.payload.map((reference) => ({ referenceType: 'Dependency' as const, reference })),
        ]
    }

    mapContents(_callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardAreaPayload(this)
        returnValue._positionGraph = new StandardPositionGraph(
            returnValue._positionGraph.nodes.toFormat(props.mapTo, props.mappings)
        )
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardAreaPayload(this)
        if (!POSITION_GRAPH_NODE_TAG_SET.has(child.tag)) {
            throw new Error(`Invalid child type ${child.tag} for StandardArea`)
        }
        returnValue.appendPositionGraphNodes(new ReferenceList([child]))
        return returnValue as this
    }

    isEmpty(): boolean {
        return this._positionGraph.nodes.payload.length === 0
    }

    invert(): this {
        const returnValue = new StandardAreaPayload()
        returnValue._shortName = invertShortName(this._shortName)
        returnValue._positionGraph = new StandardPositionGraph(this._positionGraph.nodes.invert())
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        const bucketChildren = children.filter((c) => POSITION_GRAPH_NODE_TAG_SET.has(c.tag))
        const remainder = children.filter((c) => !POSITION_GRAPH_NODE_TAG_SET.has(c.tag))

        const returnValue = new StandardAreaPayload(this)
        const bucketReferences = new ReferenceList(
            bucketChildren.map((child) => child.withRef(0))
        )
        const merged = returnValue._positionGraph.nodes.merge(bucketReferences, { cleanEmptyReferences: false })
            ?? returnValue._positionGraph.nodes
        returnValue._positionGraph = new StandardPositionGraph(merged)

        return {
            payload: returnValue as this,
            inlineRemainder: remainder.map((c) => c.withRef(0))
        }
    }

    removeReferences(references: StandardReference[]): this {
        const returnValue = new StandardAreaPayload(this)
        returnValue._positionGraph = new StandardPositionGraph(
            returnValue._positionGraph.nodes.filter(
                (item) => !references.some((ref) => item.sameKey(ref))
            )
        )
        return returnValue as this
    }
}

export class StandardArea extends componentClassFactory(StandardAreaPayload, 'StandardArea') {
    get positionGraph() { return this._payload.positionGraph }

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
        return shortNameEqual && this.positionGraph.equals(incoming.positionGraph)
    }

    override invert(): StandardArea {
        return new StandardArea(super.invert() as StandardArea)
    }
}

export default StandardArea
