//
// fromSchema pipeline: StandardizeConsumer interface, StandardizeConsumerSimple,
// and processWithConsumers runner for process-and-remainder fromSchema parsing.
// See AGENT.fromSchema.planning.md Phase 1 Step 2 (detailed).
//

import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardComponent } from "./baseClasses"
import { splitTaggedChildren } from "../../schema/utils"

export interface StandardizeConsumer {
    process(children: GenericTree<SchemaTag>): GenericTree<SchemaTag>
}

export class StandardizeConsumerSimple<D extends StandardComponent> implements StandardizeConsumer {
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
