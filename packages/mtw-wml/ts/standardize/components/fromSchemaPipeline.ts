//
// fromSchema pipeline: StandardizeConsumer interface, StandardizeConsumerSimple,
// and processWithConsumers runner for process-and-remainder fromSchema parsing.
// See AGENT.fromSchema.planning.md Phase 1 Step 2 (detailed).
//

import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { splitTaggedChildren } from "../../schema/utils"
import { ReferenceList } from "./reference"
import { StandardLiteral } from "../literal"
import { StandardRender } from "../render"
import { extractStandardRender } from "./utils/extractStandardRender"

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
            returnRemainderAddition: []
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
 * Consumer that consumes one render-bearing tag, builds a StandardRender using extractStandardRender,
 * and calls update(context, render). Pass undefined when no nodes matched (so optional fields can be cleared).
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
        const render = extractStandardRender(first, this.options.nodeTypeGuard, this.options.errorMessage)
        this.options.update.call(this.context, render)
        return {
            parsingRemainder: remainder,
            returnRemainderAddition: []
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
    children: GenericTree<SchemaTag>
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
    if (parsingRemainder.length > 0) {
        const tagList = [...new Set(collectTagsFromTree(parsingRemainder))].join(", ")
        throw new Error(`Unconsumed child tags: ${tagList}`)
    }
    return returnRemainder
}
