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

export interface StandardizeConsumer {
    process(children: GenericTree<SchemaTag>): GenericTree<SchemaTag>
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

    process(children: GenericTree<SchemaTag>): GenericTree<SchemaTag> {
        const { matched, remainder } = splitTaggedChildren({
            children,
            tag: this.options.tag,
        })
        if (matched.length > 0) {
            this.options.update.call(this.context, matched)
        }
        return remainder
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

    process(children: GenericTree<SchemaTag>): GenericTree<SchemaTag> {
        const { matched, remainder } = splitTaggedChildren({
            children,
            tag: this.options.tag,
        })
        if (matched.length > 0) {
            const list = new ReferenceList(matched)
            this.options.update.call(this.context, list)
        }
        return remainder
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

    process(children: GenericTree<SchemaTag>): GenericTree<SchemaTag> {
        const { matched, remainder } = splitTaggedChildren({
            children,
            tag: this.options.tag,
        })
        const literal = matched.length > 0 ? new StandardLiteral(matched, { tag: this.options.tag }) : undefined
        this.options.update.call(this.context, literal)
        return remainder
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
): void {
    let current: GenericTree<SchemaTag> = children
    for (const consumer of consumers) {
        current = consumer.process(current)
    }
    if (current.length > 0) {
        const tagList = [...new Set(collectTagsFromTree(current))].join(", ")
        throw new Error(`Unconsumed child tags: ${tagList}`)
    }
}
