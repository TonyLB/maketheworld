import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardComponentReferenceKey, NestedSchemaOptions } from "./baseClasses"
import { StandardToJSONOptions } from "./baseClasses"
import { ReferenceFormat } from "./utils/references"
import { StandardGuidanceData, StandardGuidanceInputData, StandardGuidanceNDJSONData, StandardGuidanceNDJSONInputData } from "./dataTypes/guidance"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaGuidance } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { StandardKey } from "../keys/key"
import StandardReference from "../keys/reference"
import { MarkFacetList } from "../keys/facets/mark"
import { StandardFormSubsetRequest } from "../baseClasses"
import { StandardLiteral } from "../literal"
import type { StandardFormConstructionOptions, StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import { HasShortName } from "./abstract"
import { processWithConsumers, StandardizeConsumerFacetListMark, StandardizeConsumerInline, StandardizeConsumerStandardLiteral } from "./fromSchemaPipeline"
import { defaultedEquals } from "./utils"

export class StandardGuidancePayload implements HasShortName, ComponentConstructorMethods<StandardGuidanceNDJSONInputData | StandardGuidanceInputData, StandardGuidanceData> {
    _instructions?: StandardLiteral;
    _shortName?: StandardLiteral;
    _marks: MarkFacetList;
    tag = 'Guidance' as const

    constructor(previous?: StandardGuidancePayload) {
        if (previous) {
            this._instructions = previous._instructions
            this._shortName = previous._shortName
            this._marks = previous._marks.clone()
        }
        else {
            this._marks = new MarkFacetList([])
        }
    }

    fromJSON(props: StandardGuidanceInputData | StandardGuidanceNDJSONInputData) {
        const { instructions, marks, shortName } = props
        this._instructions = instructions ? new StandardLiteral(instructions, { tag: 'Instructions' }) : undefined
        this._shortName = shortName ? new StandardLiteral(shortName, { tag: 'ShortName' }) : undefined
        this._marks = new MarkFacetList(marks ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaGuidance)(node)) {
            const consumers = [
                new StandardizeConsumerStandardLiteral<StandardGuidancePayload>(this, {
                    tag: "Instructions",
                    update(literal) {
                        this._instructions = literal
                    },
                }),
                new StandardizeConsumerStandardLiteral<StandardGuidancePayload>(this, {
                    tag: "ShortName",
                    update(literal) {
                        this._shortName = literal
                    },
                }),
                new StandardizeConsumerFacetListMark<StandardGuidancePayload>(this, {
                    update(list) {
                        this._marks = list
                    },
                }),
                new StandardizeConsumerInline(),
            ]

            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardGuidance constructor')
    }

    get instructions() { return this._instructions }
    get shortName() { return this._shortName }
    get marks() { return this._marks }

    toJSON(options?: StandardToJSONOptions): Omit<StandardGuidanceData, 'key' | 'universalKey'> {
        return {
            tag: 'Guidance',
            ...(this._instructions ? { instructions: this._instructions.toJSON() } : {}),
            ...(this._shortName ? { shortName: this._shortName.toJSON() } : {}),
            ...(this.marks.length ? { marks: this.marks.toJSON() } : {})
        }
    }

    toNDJSON(options?: StandardToJSONOptions): Omit<StandardGuidanceNDJSONData, 'key' | 'universalKey'> {
        return {
            tag: 'Guidance',
            ...(this._instructions ? { instructions: this._instructions.toJSON() } : {}),
            ...(this._shortName ? { shortName: this._shortName.toJSON() } : {}),
            ...(this.marks.length ? { marks: this.marks.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        const markNodes = this.marks.items.flatMap((facet) => {
            const result = facet.renderFacet(undefined, undefined)
            const node = result.aggregatedNode ?? result.newNode
            return node ? [node] : []
        })
        const children = [
            ...[this._shortName].filter(excludeUndefined).map((s) => s.nestedSchema()).flat(1),
            ...[this._instructions].filter(excludeUndefined).map((i) => i.nestedSchema()).flat(1),
            ...markNodes
        ].filter(excludeUndefined)
        return {
            data: { tag: 'Guidance', key, uuid: universalKey },
            children
        }
    }

    subset({ requestType }: StandardFormSubsetRequest): this {
        if (requestType === 'Full') {
            return new StandardGuidancePayload(this) as this
        }
        const returnValue = new StandardGuidancePayload()
        return returnValue as this
    }

    merge(incoming: this): this {
        const returnValue = new StandardGuidancePayload()
        returnValue._instructions = (this._instructions && incoming._instructions)
            ? this._instructions.merge(incoming._instructions)
            : this._instructions ?? incoming._instructions
        returnValue._shortName = (this._shortName && incoming._shortName)
            ? this._shortName.merge(incoming._shortName)
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

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardGuidancePayload(this)
        if (returnValue._shortName) {
            returnValue._shortName = returnValue._shortName.mapContents((value: string): string => {
                const tree = callback([{ data: { tag: 'String', value }, children: [] }])
                if (!tree.length) return ''
                const first = tree[0]
                if (!isSchemaString(first.data)) return ''
                return first.data.value
            })
        }
        if (returnValue._instructions) {
            returnValue._instructions = returnValue._instructions.mapContents((value: string): string => {
                const tree = callback([{ data: { tag: 'String', value }, children: [] }])
                if (!tree.length) return ''
                const first = tree[0]
                if (!isSchemaString(first.data)) return ''
                return first.data.value
            })
        }
        returnValue._marks = this._marks.mapContents((facet) => facet)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardGuidancePayload(this)
        returnValue._marks = this._marks.lookup(props.mappings).toFormat(props.mapTo)
        return returnValue as this
    }

    invert(): this {
        const returnValue = new StandardGuidancePayload()
        returnValue._instructions = this._instructions ? this._instructions.invert() as StandardLiteral : undefined
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        returnValue._marks = this._marks.invert()
        return returnValue as this
    }

    isEmpty(): boolean {
        const hasInstructions = Boolean(this._instructions)
        const hasShortName = Boolean(this._shortName)
        const hasMarks = this._marks.length > 0
        return !(hasInstructions || hasShortName || hasMarks)
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options

        // Apply facet rendering for Mark facets
        const markNodes: GenericTreeNode<SchemaTag>[] = []
        for (const facet of this.marks.items) {
            const result = facet.renderFacet(undefined, lookup)
            if (result.aggregatedNode) {
                markNodes.push(result.aggregatedNode)
            } else if (result.newNode) {
                markNodes.push(result.newNode)
            }
        }

        const children = [
            ...[this._shortName].filter(excludeUndefined).map((s) => s.nestedSchema()).flat(1),
            ...[this._instructions].filter(excludeUndefined).map((i) => i.nestedSchema()).flat(1),
            ...markNodes
        ].filter(excludeUndefined)

        return {
            data: { tag: 'Guidance', key: key.key ?? '', uuid: key.universalKey },
            children
        }
    }
}

export class StandardGuidance extends componentClassFactory(StandardGuidancePayload, 'StandardGuidance') {
    get instructions() { return this._payload.instructions }
    get shortName() { return this._payload.shortName }
    get marks() { return this._payload.marks }

    constructor(
        props: string | StandardGuidanceInputData | StandardGuidanceNDJSONInputData | GenericTreeNode<SchemaTag> | StandardGuidance,
        options?: StandardFormConstructionOptions,
    ) {
        super(props, options)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardGuidance(instance as StandardGuidance) as this
    }

    override clone(): StandardGuidance {
        const returnValue = new StandardGuidance(this)
        returnValue._payload = new StandardGuidancePayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardGuidance)) {
            return false
        }
        return this.marks.equals(incoming.marks) &&
            defaultedEquals(this.instructions, incoming.instructions) &&
            defaultedEquals(this.shortName, incoming.shortName)
    }
}

export default StandardGuidance
