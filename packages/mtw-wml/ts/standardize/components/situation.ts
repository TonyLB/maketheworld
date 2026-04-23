import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardComponentReferenceKey, NestedSchemaOptions } from "./baseClasses"
import { StandardToJSONOptions } from "./baseClasses"
import { ReferenceFormat } from "./utils/references"
import { StandardSituationData, StandardSituationInputData } from "./dataTypes/situation"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaSituation } from "@tonylb/mtw-base/ts/schema/components"
import { deepEqual } from "../../lib/objects"
import { StandardKey } from "../keys/key"
import StandardReference from "../keys/reference"
import { MarkFacetList } from "../keys/facets/mark"
import { StandardFormSubsetRequest } from "../baseClasses"
import { StandardLiteral } from "../literal"
import type { StandardFormConstructionOptions, StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import { HasShortName } from "./abstract"
import { excludeUndefined } from "../../lib/lists"
import { processWithConsumers, StandardizeConsumerFacetListMark, StandardizeConsumerInline, StandardizeConsumerStandardLiteral } from "./fromSchemaPipeline"

export class StandardSituationPayload implements HasShortName, ComponentConstructorMethods<StandardSituationInputData, StandardSituationData> {
    _shortName?: StandardLiteral;
    _marks: MarkFacetList;
    tag = 'Situation' as const

    constructor(previous?: StandardSituationPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._marks = previous._marks.clone()
        }
        else {
            this._marks = new MarkFacetList([])
        }
    }

    fromJSON(props: StandardSituationInputData) {
        const { shortName } = props
        this._shortName = shortName ? new StandardLiteral(shortName, { tag: 'ShortName' }) : undefined
        this._marks = new MarkFacetList(props.marks ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaSituation)(node)) {
            const consumers = [
                new StandardizeConsumerStandardLiteral(this, {
                    tag: "ShortName",
                    update(literal) {
                        this._shortName = literal
                    },
                }),
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

    get shortName() {
        return this._shortName
    }

    get marks() { return this._marks }

    toJSON(options?: StandardToJSONOptions): Omit<StandardSituationData, 'key' | 'universalKey'> {
        return {
            tag: 'Situation',
            ...(this.shortName ? { shortName: this.shortName.toJSON() } : {}),
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
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema())).flat(1),
                ...markNodes
            ]
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
        //
        // For shortName, follow the same merge pattern as Guidance:
        // - When both sides have a shortName, delegate to StandardLiteral.merge
        //   so that diff/overlay semantics are respected.
        // - Otherwise, take whichever side has a value.
        //
        returnValue._shortName = (this._shortName && incoming._shortName)
            ? (this._shortName.merge(incoming._shortName) as StandardLiteral | undefined)
            : this._shortName ?? incoming._shortName
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
        return (typeof this._shortName === 'undefined') && this._marks.length === 0
    }

    invert(): this {
        const returnValue = new StandardSituationPayload()
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
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
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema())).flat(1),
                ...markNodes
            ]
        }
    }
}

export class StandardSituation extends componentClassFactory(StandardSituationPayload, 'StandardSituation') {
    get shortName() { return this._payload.shortName }
    get marks() { return this._payload.marks }

    constructor(
        props: string | StandardSituationInputData | GenericTreeNode<SchemaTag> | StandardSituation,
        options?: StandardFormConstructionOptions,
    ) {
        super(props, options)
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
