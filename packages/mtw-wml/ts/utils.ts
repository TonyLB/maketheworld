import { ParseTag, isParseTagNesting } from "./parser/baseClasses"

export function *depthFirstParseTagGenerator(tree: ParseTag[]): Generator<ParseTag> {
    for (const node of tree) {
        if (isParseTagNesting(node)) {
            yield* depthFirstParseTagGenerator(node.contents)
        }
        yield node
    }
}

type TransformWithContextCallback = {
    (item: ParseTag, context: ParseTag[]): ParseTag
}

export const transformWithContext = (tree: ParseTag[], callback: TransformWithContextCallback, context: ParseTag[] = []): ParseTag[] => {
    return tree.reduce<ParseTag[]>((previous, item) => {
        const transformedItem = callback(item, context)
        if (isParseTagNesting(item)) {
            return [
                ...previous,
                {
                    ...transformedItem,
                    contents: transformWithContext(item.contents, callback, [...context, transformedItem])
                }
            ]
        }
        return [
            ...previous,
            transformedItem
        ]
    }, [])
}
