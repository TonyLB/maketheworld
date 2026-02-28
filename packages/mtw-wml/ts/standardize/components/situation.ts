import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardComponentReferenceKey, NestedSchemaOptions } from "./baseClasses"
import { StandardToJSONOptions } from "./baseClasses"
import { ReferenceFormat } from "./utils/references"
import { StandardSituationData } from "./dataTypes/situation"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaSituation } from "@tonylb/mtw-base/ts/schema/components"
import { deepEqual } from "../../lib/objects"
import { StandardKey } from "../keys/key"
import StandardReference from "../keys/reference"
import { MarkFacetList } from "../keys/facets/mark"
import { StandardFormSubsetRequest } from "../baseClasses"
import { processWithConsumers, StandardizeConsumerFacetListMark, StandardizeConsumerInline } from "./fromSchemaPipeline"

export class StandardSituationPayload implements ComponentConstructorMethods<StandardSituationData> {
    _marks: MarkFacetList;
    tag = 'Situation' as const

    constructor(previous?: StandardSituationPayload) {
        if (previous) {
            this._marks = previous._marks.clone()
        }
        else {
            this._marks = new MarkFacetList([])
        }
    }

    fromJSON(props: StandardSituationData) {
        this._marks = new MarkFacetList(props.marks ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaSituation)(node)) {
            const consumers = [
                new StandardizeConsumerFacetListMark<StandardSituationPayload>(this, {
                    update(list) {
                        this._marks = list
                    },
                }),
                new StandardizeConsumerInline(),
            ]

            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardSituation constructor')
    }

    get marks() { return this._marks }

    toJSON(options?: StandardToJSONOptions): Omit<StandardSituationData, 'key' | 'universalKey'> {
        return {
            tag: 'Situation',
            ...(this.marks.length ? { marks: this.marks.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        const markNodes = this.marks.items.flatMap((facet) => {
            const result = facet.renderFacet(undefined, undefined)
            const node = result.aggregatedNode ?? result.newNode
            return node ? [node] : []
        })
        return {
            data: { tag: 'Situation', key, uuid: universalKey },
            children: markNodes
        }
    }

    subset({ requestType }: StandardFormSubsetRequest): this {
        if (requestType === 'Full') {
            return new StandardSituationPayload(this) as this
        }
        return new StandardSituationPayload() as this
    }

    merge(incoming: this): this {
        const returnValue = new StandardSituationPayload()
        const mergedMarks = (this._marks && incoming._marks)
            ? this._marks.merge(incoming._marks)
            : this._marks ?? incoming._marks ?? new MarkFacetList([])
        returnValue._marks = mergedMarks ?? new MarkFacetList([])
        return returnValue as this
    }

    referencedKeys(mapping: StandardReference[]): StandardComponentReferenceKey[] {
        return this.marks.items.map((facet) => {
            const ref = facet.reference as StandardReference
            return { referenceType: 'Facet' as const, reference: ref }
        })
    }

    isEmpty(): boolean {
        return this._marks.length === 0
    }

    invert(): this {
        const returnValue = new StandardSituationPayload()
        returnValue._marks = this._marks.invert()
        return returnValue as this
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardSituationPayload(this)
        returnValue._marks = this._marks.mapContents((facet) => facet)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardSituationPayload(this)
        returnValue._marks = this._marks.lookup(props.mappings).toFormat(props.mapTo)
        return returnValue as this
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options

        const markNodes: GenericTreeNode<SchemaTag>[] = []
        for (const facet of this.marks.items) {
            const result = facet.renderFacet(undefined, lookup)
            if (result.aggregatedNode) {
                markNodes.push(result.aggregatedNode)
            } else if (result.newNode) {
                markNodes.push(result.newNode)
            }
        }

        return {
            data: { tag: 'Situation', key: key.key ?? '', uuid: key.universalKey },
            children: markNodes
        }
    }
}

export class StandardSituation extends componentClassFactory(StandardSituationPayload, 'StandardSituation') {
    get marks() { return this._payload.marks }

    constructor(props: string | StandardSituationData | GenericTreeNode<SchemaTag> | StandardSituation) {
        super(props)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardSituation(instance as StandardSituation) as this
    }

    override clone(): StandardSituation {
        const returnValue = new StandardSituation(this)
        returnValue._payload = new StandardSituationPayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardSituation)) {
            return false
        }
        return deepEqual(this.toJSON(), incoming.toJSON())
    }
}

export default StandardSituation
