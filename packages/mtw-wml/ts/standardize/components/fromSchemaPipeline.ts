//
// fromSchema pipeline: StandardizeConsumer interface, StandardizeConsumerSimple,
// and processWithConsumers runner for process-and-remainder fromSchema parsing.
// See AGENT.implementation.md (fromSchema: process-and-remainder pipeline).
//

import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaComponent, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaMark } from "@tonylb/mtw-base/ts/schema/worldState"
import { splitChildrenByPredicate, splitTaggedChildren } from "../../schema/utils"
import { ReferenceList } from "./reference"
import { StandardLiteral } from "../literal"
import { StandardRender } from "../render"
import { PositionFacetList, StandardPositionFacet } from "../keys/facets/position"
import { MarkFacetList, StandardMarkFacet } from "../keys/facets/mark"
import { LensMarkFacetList, StandardLensMarkFacet } from "../keys/facets/lensMark"
import { isSchemaSituation } from "@tonylb/mtw-base/ts/schema/components"
import { SituationProseFacetList, StandardSituationProseFacet } from "../keys/facets/situationRoom"

export interface StandardizeConsumer {
    /**
     * Process a list of children and return:
     * - parsingRemainder: children not consumed by this step (threaded to the next consumer)
     * - returnRemainderAddition: child schema to be re-exposed to processComponents for recursion
     *
     * In the initial two-remainder rollout, real consumers should continue to
     * populate parsingRemainder exactly as before and returnRemainderAddition
     * should remain an empty list (behavior-neutral).
     */
    process(children: GenericTree<SchemaTag>): {
        parsingRemainder: GenericTree<SchemaTag>;
        returnRemainderAddition: GenericTree<SchemaTag>;
    }
}

/**
 * Simple consumer that consumes one tag and calls update(context, matched).
 * D is the context type (typically the payload instance that holds _shortName, _exits, etc.).
 */
export class StandardizeConsumerSimple<D extends object = object> implements StandardizeConsumer {
    constructor(
        private readonly context: D,
        private readonly options: {
            tag: SchemaTag["tag"]
            update: (this: D, nodes: GenericTree<SchemaTag>) => void
        }
    ) {}

    process(children: GenericTree<SchemaTag>): { parsingRemainder: GenericTree<SchemaTag>; returnRemainderAddition: GenericTree<SchemaTag> } {
        const { matched, remainder } = splitTaggedChildren({
            children,
            tag: this.options.tag,
        })
        if (matched.length > 0) {
            this.options.update.call(this.context, matched)
        }
        return {
            parsingRemainder: remainder,
            returnRemainderAddition: []
        }
    }
}

/**
 * Consumer that consumes one tag, builds a ReferenceList from matched nodes (via ReferenceList constructor),
 * and calls update(context, list). Use for Lens, Feature, Example, Guidance, Character, etc.
 */
export class StandardizeConsumerReferenceList<D extends object = object> implements StandardizeConsumer {
    constructor(
        private readonly context: D,
        private readonly options: {
            tag: SchemaTag["tag"]
            update: (this: D, list: ReferenceList) => void
        }
    ) {}

    process(children: GenericTree<SchemaTag>): { parsingRemainder: GenericTree<SchemaTag>; returnRemainderAddition: GenericTree<SchemaTag> } {
        const { matched, remainder } = splitTaggedChildren({
            children,
            tag: this.options.tag,
        })
        if (matched.length > 0) {
            const list = new ReferenceList(matched)
            this.options.update.call(this.context, list)
        }
        //
        // NOTE: In this initial rollout, ReferenceList consumers do not yet
        // contribute to the return remainder. When the two-remainder pipeline
        // is fully wired into processComponents, this consumer will be
        // extended so that matched component tags (e.g. Feature, Example,
        // Guidance, Mark under Lens) can opt-in to exposing child schema back
        // to processComponents for recursion.
        //
        return {
            parsingRemainder: remainder,
            returnRemainderAddition: matched
        }
    }
}

/**
 * Consumer that consumes one tag, builds a StandardLiteral from matched nodes,
 * and calls update(context, literal). Pass undefined when no nodes matched (so optional fields can be cleared).
 * Use for ShortName, Pronouns, Instructions, etc.
 */
export class StandardizeConsumerStandardLiteral<D extends object = object> implements StandardizeConsumer {
    constructor(
        private readonly context: D,
        private readonly options: {
            tag: SchemaTag["tag"]
            update: (this: D, literal: StandardLiteral | undefined) => void
        }
    ) {}

    process(children: GenericTree<SchemaTag>): { parsingRemainder: GenericTree<SchemaTag>; returnRemainderAddition: GenericTree<SchemaTag> } {
        const { matched, remainder } = splitTaggedChildren({
            children,
            tag: this.options.tag,
        })
        const literal = matched.length > 0 ? new StandardLiteral(matched, { tag: this.options.tag }) : undefined
        this.options.update.call(this.context, literal)
        return {
            parsingRemainder: remainder,
            returnRemainderAddition: []
        }
    }
}

/**
 * Consumer that consumes one render-bearing tag, builds a StandardRender using the constructor with options.tag
 * (and optional validation), and calls update(context, render). Pass undefined when no nodes matched (so optional fields can be cleared).
 * Use for Description, DisplayName, Summary, etc.
 */
export class StandardizeConsumerRender<D extends object = object, S extends SchemaTag = SchemaTag> implements StandardizeConsumer {
    constructor(
        private readonly context: D,
        private readonly options: {
            tag: SchemaTag["tag"]
            nodeTypeGuard: (data: SchemaTag) => data is S
            errorMessage: string
            update: (this: D, render: StandardRender | undefined) => void
        }
    ) {}

    process(children: GenericTree<SchemaTag>): { parsingRemainder: GenericTree<SchemaTag>; returnRemainderAddition: GenericTree<SchemaTag> } {
        const { matched, remainder } = splitTaggedChildren({
            children,
            tag: this.options.tag,
        })
        const first = matched[0] as any | undefined
        const render = first !== undefined ? new StandardRender(first, { tag: this.options.tag, nodeTypeGuard: this.options.nodeTypeGuard, errorMessage: this.options.errorMessage }) : undefined
        this.options.update.call(this.context, render)
        return {
            parsingRemainder: remainder,
            returnRemainderAddition: []
        }
    }
}

/**
 * Facet-list consumer prototype used initially for Map→Room Position facets.
 *
 * Design notes:
 * - This first-draft implementation is intentionally specialized for Position facets
 *   (Room children with Position tags) but exposes a configuration surface that can be
 *   generalized for other homogeneous facet lists in later phases.
 * - It parses Room children with Position tags into a PositionFacetList and updates
 *   the payload via options.update(list).
 * - It returns a parsingRemainder where the Room nodes have had their Position tags
 *   removed, and a returnRemainderAddition of [] so that upstream behavior remains
 *   unchanged while we prototype the two-remainder shape.
 */
export class StandardizeConsumerFacetListPosition<D extends object = object> implements StandardizeConsumer {
    constructor(
        private readonly context: D,
        private readonly options: {
            update: (this: D, list: PositionFacetList) => void
        }
    ) {}

    process(children: GenericTree<SchemaTag>): { parsingRemainder: GenericTree<SchemaTag>; returnRemainderAddition: GenericTree<SchemaTag> } {
        // Match Room children under the current component.
        const roomNodes: GenericTreeNode<SchemaTag>[] = children.filter(treeNodeTypeguard(isSchemaRoom))

        // Parse Position facets from the original Room nodes.
        const facets = roomNodes
            .map((roomNode) => {
                try {
                    return new StandardPositionFacet([roomNode])
                }
                catch {
                    return undefined
                }
            })
            .filter((facet): facet is StandardPositionFacet => Boolean(facet))

        const list = new PositionFacetList(facets)
        this.options.update.call(this.context, list)

        // Build cleaned Room nodes with Position tags removed from their children.
        const cleanedRooms: GenericTree<SchemaTag> = roomNodes.map((roomNode) => {
            const { remainder: childrenWithoutPosition } = splitTaggedChildren({
                children: roomNode.children,
                tag: 'Position',
            })
            return {
                ...roomNode,
                children: childrenWithoutPosition
            }
        })

        // Pass through non-Room children (e.g. Feature ref={0}) so later consumers (Inline) can process them.
        const parsingRemainder: GenericTree<SchemaTag> = children.filter((child) => !treeNodeTypeguard(isSchemaRoom)(child))
        return {
            parsingRemainder,
            returnRemainderAddition: cleanedRooms
        }
    }
}

/**
 * Facet-list consumer for Mark facets under Example/Guidance.
 *
 * - Parses Mark children with Match payloads into a MarkFacetList and updates
 *   the payload via options.update(list).
 * - Returns all Mark nodes (with Match children stripped where present) in
 *   returnRemainderAddition so that processComponents can recurse into cleaned
 *   Mark components once the two-remainder pipeline is wired.
 * - Non-Mark children are passed through as parsingRemainder for subsequent
 *   consumers (when this consumer is not the last step).
 */
export class StandardizeConsumerFacetListMark<D extends object = object> implements StandardizeConsumer {
    constructor(
        private readonly context: D,
        private readonly options: {
            update: (this: D, list: MarkFacetList) => void
        }
    ) {}

    process(children: GenericTree<SchemaTag>): { parsingRemainder: GenericTree<SchemaTag>; returnRemainderAddition: GenericTree<SchemaTag> } {
        const markNodes: GenericTreeNode<SchemaTag>[] = children.filter(treeNodeTypeguard(isSchemaMark))

        const facets = markNodes
            .map((markNode) => {
                try {
                    return new StandardMarkFacet([markNode])
                }
                catch {
                    return undefined
                }
            })
            .filter((facet): facet is StandardMarkFacet => Boolean(facet))

        const list = new MarkFacetList(facets)
        this.options.update.call(this.context, list)

        const cleanedMarks: GenericTree<SchemaTag> = markNodes.map((markNode) => {
            const { remainder: childrenWithoutMatch } = splitTaggedChildren({
                children: markNode.children,
                tag: 'Match',
            })
            return {
                ...markNode,
                children: childrenWithoutMatch
            }
        })

        const parsingRemainder: GenericTree<SchemaTag> = children.filter((child) => !treeNodeTypeguard(isSchemaMark)(child))

        return {
            parsingRemainder,
            returnRemainderAddition: cleanedMarks
        }
    }
}

/**
 * Facet-list consumer for Lens Mark facets (Mark reference + optional Default).
 *
 * - Parses Mark children with optional Default payloads into a LensMarkFacetList and updates
 *   the payload via options.update(list).
 * - Returns Mark nodes (with Default children stripped where present) in
 *   returnRemainderAddition so that processComponents can recurse into cleaned
 *   Mark components.
 * - Non-Mark children are passed through as parsingRemainder for subsequent consumers.
 */
export class StandardizeConsumerFacetListLensMark<D extends object = object> implements StandardizeConsumer {
    constructor(
        private readonly context: D,
        private readonly options: {
            update: (this: D, list: LensMarkFacetList) => void
        }
    ) {}

    process(children: GenericTree<SchemaTag>): { parsingRemainder: GenericTree<SchemaTag>; returnRemainderAddition: GenericTree<SchemaTag> } {
        const markNodes: GenericTreeNode<SchemaTag>[] = children.filter(treeNodeTypeguard(isSchemaMark))

        const facets = markNodes
            .map((markNode) => {
                try {
                    return new StandardLensMarkFacet([markNode])
                }
                catch {
                    return undefined
                }
            })
            .filter((facet): facet is StandardLensMarkFacet => Boolean(facet))

        const list = new LensMarkFacetList(facets)
        this.options.update.call(this.context, list)

        const cleanedMarks: GenericTree<SchemaTag> = markNodes.map((markNode) => {
            const { remainder: childrenWithoutDefault } = splitTaggedChildren({
                children: markNode.children,
                tag: 'Default',
            })
            return {
                ...markNode,
                children: childrenWithoutDefault
            }
        })

        const parsingRemainder: GenericTree<SchemaTag> = children.filter((child) => !treeNodeTypeguard(isSchemaMark)(child))

        return {
            parsingRemainder,
            returnRemainderAddition: cleanedMarks
        }
    }
}

/**
 * Facet-list consumer for Situation prose facets (Situation reference + DisplayName/Summary/Description).
 * Used on Room, Feature, and Knowledge.
 */
export class StandardizeConsumerFacetListSituation<D extends object = object> implements StandardizeConsumer {
    constructor(
        private readonly context: D,
        private readonly options: {
            update: (this: D, list: SituationProseFacetList) => void
        }
    ) {}

    process(children: GenericTree<SchemaTag>): { parsingRemainder: GenericTree<SchemaTag>; returnRemainderAddition: GenericTree<SchemaTag> } {
        const situationNodes: GenericTreeNode<SchemaTag>[] = children.filter(treeNodeTypeguard(isSchemaSituation))

        const facets = situationNodes
            .map((situationNode) => {
                try {
                    return new StandardSituationProseFacet([situationNode])
                } catch {
                    return undefined
                }
            })
            .filter((facet): facet is StandardSituationProseFacet => Boolean(facet))

        const list = new SituationProseFacetList(facets)
        this.options.update.call(this.context, list)

        const cleanedSituations: GenericTree<SchemaTag> = situationNodes.map((situationNode) => {
            let remainder = situationNode.children ?? []
            for (const tag of ["DisplayName", "Summary", "Description"] as const) {
                remainder = splitTaggedChildren({ children: remainder, tag }).remainder
            }
            return {
                ...situationNode,
                children: remainder
            }
        })

        const parsingRemainder: GenericTree<SchemaTag> = children.filter((child) => !treeNodeTypeguard(isSchemaSituation)(child))
        return {
            parsingRemainder,
            returnRemainderAddition: cleanedSituations
        }
    }
}

/**
 * Consumer that accepts any direct child that is a component tag with ref={0}
 * (inline shared resource) and passes it unchanged to returnRemainderAddition.
 * Does not mutate context. Uses splitChildrenByPredicate so Remove/Replace
 * wrappers are respected. Should run last in payloads that have ReferenceList
 * or FacetList consumers. See AGENT.fromSchema.inlines.planning.md.
 */
export class StandardizeConsumerInline implements StandardizeConsumer {
    process(children: GenericTree<SchemaTag>): { parsingRemainder: GenericTree<SchemaTag>; returnRemainderAddition: GenericTree<SchemaTag> } {
        const predicate = (node: GenericTreeNode<SchemaTag>) =>
            treeNodeTypeguard(isSchemaComponent)(node) && (node.data as { ref?: number }).ref === 0
        const { matched, remainder } = splitChildrenByPredicate(children, predicate)
        return {
            parsingRemainder: remainder,
            returnRemainderAddition: matched
        }
    }
}

function collectTagsFromTree(tree: GenericTree<SchemaTag>): string[] {
    const tags: string[] = []
    for (const node of tree) {
        tags.push(node.data.tag)
        if (node.children.length > 0) {
            tags.push(...collectTagsFromTree(node.children))
        }
    }
    return tags
}

export function processWithConsumers<T>(
    _context: T,
    consumers: StandardizeConsumer[],
    children: GenericTree<SchemaTag>,
    options?: { allowUnconsumed?: boolean }
): GenericTree<SchemaTag> {
    let parsingRemainder: GenericTree<SchemaTag> = children
    let returnRemainder: GenericTree<SchemaTag> = []
    for (const consumer of consumers) {
        const { parsingRemainder: nextParsingRemainder, returnRemainderAddition } = consumer.process(parsingRemainder)
        parsingRemainder = nextParsingRemainder
        if (returnRemainderAddition.length) {
            returnRemainder = [...returnRemainder, ...returnRemainderAddition]
        }
    }
    if (parsingRemainder.length > 0 && !options?.allowUnconsumed) {
        const tagList = [...new Set(collectTagsFromTree(parsingRemainder))].join(", ")
        throw new Error(`Unconsumed child tags: ${tagList}`)
    }
    return returnRemainder
}
