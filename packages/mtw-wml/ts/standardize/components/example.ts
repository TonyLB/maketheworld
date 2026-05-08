import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardComponentReferenceKey, NestedSchemaOptions } from "./baseClasses"
import { ReferenceFormat } from "./utils/references"
import { StandardRender } from "../render"
import { StandardToJSONOptions } from "./baseClasses"
import { StandardExampleData, StandardExampleInputData, StandardExampleNDJSONData, StandardExampleNDJSONInputData } from "./dataTypes/example"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaExample, isSchemaDisplayName, isSchemaSummary, isSchemaDescription, SchemaDisplayNameTag, SchemaSummaryTag, SchemaDescriptionTag } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { renderTreeToSchema, schemaToRenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardKey } from "../keys/key"
import StandardReference from "../keys/reference"
import { StandardExplicitParent } from "../explicit"
import { MarkFacetList } from "../keys/facets/mark"
import { SituationRoomFacetPayload } from "../keys/facets/situationRoom"
import { StandardFormSubsetRequest } from "../baseClasses"
import { StandardLiteral } from "../literal"
import { defaultedEquals } from "./utils"
import type { StandardFormConstructionOptions, StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import { HasShortName } from "./abstract"
import { processWithConsumers, StandardizeConsumerFacetListMark, StandardizeConsumerInline, StandardizeConsumerRender, StandardizeConsumerStandardLiteral } from "./fromSchemaPipeline"

export class StandardExamplePayload implements HasShortName, ComponentConstructorMethods<StandardExampleNDJSONInputData | StandardExampleInputData, StandardExampleData> {
    _displayName?: StandardLiteral;
    _summary?: StandardRender;
    _description?: StandardRender;
    _shortName?: StandardLiteral;
    _marks: MarkFacetList;
    tag = 'Example' as const

    constructor(previous?: StandardExamplePayload) {
        if (previous) {
            this._displayName = previous._displayName
            this._summary = previous._summary
            this._description = previous._description
            this._shortName = previous._shortName
            this._marks = previous._marks.clone()
        }
        else {
            this._marks = new MarkFacetList([])
        }
    }

    fromJSON(props: StandardExampleInputData | StandardExampleNDJSONInputData) {
        const { displayName, summary, description, marks, shortName } = props
        this._displayName = displayName ? new StandardLiteral(displayName, { tag: 'DisplayName' }) : undefined
        this._summary = summary ? new StandardRender(summary) : undefined
        this._description = description ? new StandardRender(description) : undefined
        this._shortName = shortName ? new StandardLiteral(shortName, { tag: 'ShortName' }) : undefined
        this._marks = new MarkFacetList(marks ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaExample)(node)) {
            const consumers = [
                new StandardizeConsumerStandardLiteral<StandardExamplePayload>(this, {
                    tag: "ShortName",
                    update(literal) {
                        this._shortName = literal
                    },
                }),
                new StandardizeConsumerStandardLiteral<StandardExamplePayload>(this, {
                    tag: "DisplayName",
                    update(literal) {
                        this._displayName = literal
                    },
                }),
                new StandardizeConsumerRender<StandardExamplePayload, SchemaSummaryTag>(this, {
                    tag: "Summary",
                    nodeTypeGuard: isSchemaSummary,
                    errorMessage: "Schema mismatch in StandardExample constructor",
                    update(render) {
                        this._summary = render
                    },
                }),
                new StandardizeConsumerRender<StandardExamplePayload, SchemaDescriptionTag>(this, {
                    tag: "Description",
                    nodeTypeGuard: isSchemaDescription,
                    errorMessage: "Schema mismatch in StandardExample constructor",
                    update(render) {
                        this._description = render
                    },
                }),
                new StandardizeConsumerFacetListMark<StandardExamplePayload>(this, {
                    update(list) {
                        this._marks = list
                    },
                }),
                new StandardizeConsumerInline(),
            ]

            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardExample constructor')
    }

    get displayName() { return this._displayName }
    get summary() { return this._summary }
    get description() { return this._description }
    get shortName() { return this._shortName }
    get marks() { return this._marks }

    toJSON(options?: StandardToJSONOptions): Omit<StandardExampleData, 'key' | 'universalKey'> {
        const { stripUIFields: stripUI } = options ?? {}
        return {
            tag: 'Example',
            displayName: this._displayName?.toJSON(),
            summary: this._summary?.toJSON(),
            description: this._description?.toJSON(),
            ...(this._shortName ? { shortName: this._shortName.toJSON() } : {}),
            ...(this.marks.length ? { marks: this.marks.toJSON() } : {})
        }
    }

    toNDJSON(options?: StandardToJSONOptions): Omit<StandardExampleNDJSONData, 'key' | 'universalKey'> {
        return {
            tag: 'Example',
            displayName: this._displayName?.toJSON(),
            summary: this._summary?.toJSON(),
            description: this._description?.toJSON(),
            ...(this._shortName ? { shortName: this._shortName.toJSON() } : {}),
            ...(this.marks.length ? { marks: this.marks.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        const children = [
            ...[this._shortName].filter(excludeUndefined).map((s) => s.nestedSchema()).flat(1),
            ...(this._displayName?.nestedSchema({ tag: 'DisplayName' }) ?? []),
            ...(this._summary?.nestedSchema({ tag: 'Summary', mappings }) ?? []),
            ...(this._description?.nestedSchema({ tag: 'Description', mappings }) ?? []),
            ...this.marks.items.map(facet => {
                // TypeScript doesn't narrow the reference type correctly, so we need to assert
                const ref = facet.reference as StandardReference
                return ref.schema
            }).flat(1)
        ].filter(excludeUndefined)
        return {
            data: { tag: 'Example', key, uuid: universalKey },
            children
        }
    }

    subset({ requestType }: StandardFormSubsetRequest): this {
        if (requestType === 'Full') {
            return new StandardExamplePayload(this) as this
        }
        const returnValue = new StandardExamplePayload()
        return returnValue as this
    }

    merge(incoming: this): this {
        const returnValue = new StandardExamplePayload()
        returnValue._displayName = (this._displayName && incoming._displayName) ? this._displayName.merge(incoming._displayName) : this._displayName ?? incoming._displayName
        returnValue._summary = (this._summary && incoming._summary) ? this._summary.merge(incoming._summary) : this._summary ?? incoming._summary
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        const mergedMarks = (this._marks && incoming._marks) ? this._marks.merge(incoming._marks) : this._marks ?? incoming._marks ?? new MarkFacetList([])
        returnValue._marks = mergedMarks ?? new MarkFacetList([])
        return returnValue as this
    }

    referencedKeys(mapping: StandardReference[]): StandardComponentReferenceKey[] {
        return [
            ...SituationRoomFacetPayload.linkReferenceKeysFromSummaryDescription(mapping, this._summary, this._description),
            ...this.marks.items.map((facet) => {
                // Facets are structural relationships with associated payload data
                const ref = facet.reference as StandardReference
                return { referenceType: 'Facet' as const, reference: ref }
            })
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardExamplePayload(this)
        if (returnValue._shortName) {
            returnValue._shortName = returnValue._shortName
                .mapContents((value: string): string => {
                    const tree = callback([{ data: { tag: 'String', value }, children: [] }])
                    if (!tree.length) return ''
                    const first = tree[0]
                    if (!isSchemaString(first.data)) return ''
                    return first.data.value
                })
        }
        // _displayName is a StandardLiteral; mapContents is not applied to it here.
        if (returnValue._summary) {
            returnValue._summary = returnValue._summary.mapContents((renderTree) => (schemaToRenderTree(callback(renderTreeToSchema(renderTree)))))
        }
        if (returnValue._description) {
            returnValue._description = returnValue._description.mapContents((renderTree) => (schemaToRenderTree(callback(renderTreeToSchema(renderTree)))))
        }
        returnValue._marks = this._marks.mapContents((facet) => facet)
        return returnValue as this
    }
    
    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardExamplePayload(this)
        // DisplayName is a StandardLiteral (string-based) and should not participate in link remapping.
        returnValue._summary = returnValue._summary?.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        returnValue._description = returnValue._description?.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        returnValue._marks = this._marks.lookup(props.mappings).toFormat(props.mapTo)
        return returnValue as this
    }

    invert(): this {
        const returnValue = new StandardExamplePayload()
        returnValue._displayName = this._displayName ? this._displayName.invert() : undefined
        returnValue._summary = this._summary ? this._summary.invert() : undefined
        returnValue._description = this._description ? this._description.invert() : undefined
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        // Invert marks (creates Remove operations with ref=-1)
        returnValue._marks = this._marks.invert()
        return returnValue as this
    }

    isEmpty(): boolean {
        // An example is empty if it has no displayName, summary, description, marks, or shortName
        const hasDisplayName = Boolean(this._displayName)
        const hasSummary = Boolean(this._summary)
        const hasDescription = Boolean(this._description)
        const hasShortName = Boolean(this._shortName)
        const hasMarks = this._marks.length > 0
        return !(hasDisplayName || hasSummary || hasDescription || hasShortName || hasMarks)
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options

        // Apply facet rendering: For each Mark facet, call renderFacet() without referenceRender parameter
        // The facet will generate its own reference render internally and enhance it with Match children
        const markNodes: GenericTreeNode<SchemaTag>[] = []
        for (const facet of this.marks.items) {
            const result = facet.renderFacet(undefined, lookup) // No referenceRender parameter - facet generates its own
            if (result.aggregatedNode) {
                markNodes.push(result.aggregatedNode)
            } else if (result.newNode) {
                // Handle Exit-style facets (not applicable for Mark facets, but pattern supports it)
                markNodes.push(result.newNode)
            }
        }

        // Combine with other Example content
        const children = [
            ...[this._shortName].filter(excludeUndefined).map((s) => s.nestedSchema()).flat(1),
            ...(this._displayName?.nestedSchema({ tag: 'DisplayName' }) ?? []),
            ...(this._summary?.nestedSchema({ tag: 'Summary', mappings: options.mappings }) ?? []),
            ...(this._description?.nestedSchema({ tag: 'Description', mappings: options.mappings }) ?? []),
            ...markNodes
        ].filter(excludeUndefined)

        return {
            data: { tag: 'Example', key: key.key ?? '', uuid: key.universalKey },
            children
        }
    }

}

export class StandardExample extends componentClassFactory(StandardExamplePayload, 'StandardExample') {
    get displayName() { return this._payload.displayName }
    get summary() { return this._payload.summary }
    get description() { return this._payload.description }
    get shortName() { return this._payload.shortName }
    get marks() { return this._payload.marks }

    constructor(
        props: string | StandardExampleInputData | StandardExampleNDJSONInputData | GenericTreeNode<SchemaTag> | StandardExample,
        options?: StandardFormConstructionOptions,
    ) {
        super(props, options)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardExample(instance as StandardExample) as this
    }

    override clone(): StandardExample {
        const returnValue = new StandardExample(this)
        returnValue._payload = new StandardExamplePayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardExample)) {
            return false
        }
        return this.marks.equals(incoming.marks) &&
            defaultedEquals(this.displayName, incoming.displayName) &&
            defaultedEquals(this.summary, incoming.summary) &&
            defaultedEquals(this.description, incoming.description) &&
            defaultedEquals(this.shortName, incoming.shortName)
    }

}

export default StandardExample
