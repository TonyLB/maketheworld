import { RenderTree, RenderTreeNode } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaDoubleBR, isSchemaDoubleSpace, isSchemaLineBreak } from "@tonylb/mtw-base/ts/schema/renderTree"

const displayBreakNode: RenderTreeNode = { data: { tag: 'br' }, children: [] }

const normalizeNode = (item: RenderTreeNode): RenderTreeNode => {
    if (typeof item === 'string') {
        return item
    }
    if (isSchemaDoubleSpace(item.data)) {
        return ' '
    }
    if (isSchemaDoubleBR(item.data)) {
        return displayBreakNode
    }
    return item
}

const collapseConsecutiveBreaks = (tree: RenderTree): RenderTree => {
    const result: RenderTree = []
    for (const item of tree) {
        if (typeof item !== 'string' && isSchemaLineBreak(item.data)) {
            const prev = result[result.length - 1]
            if (prev && typeof prev !== 'string' && isSchemaLineBreak(prev.data)) {
                continue
            }
        }
        result.push(item)
    }
    return result
}

const joinAdjacentStrings = (tree: RenderTree): RenderTree => {
    const result: RenderTree = []
    for (const item of tree) {
        if (typeof item === 'string' && result.length > 0 && typeof result[result.length - 1] === 'string') {
            result[result.length - 1] = (result[result.length - 1] as string) + item
        } else {
            result.push(item)
        }
    }
    return result
}

export const collapseDisplayWhitespace = (list: RenderTree): RenderTree => {
    const normalized = list.map(normalizeNode)
    return joinAdjacentStrings(collapseConsecutiveBreaks(normalized))
}
