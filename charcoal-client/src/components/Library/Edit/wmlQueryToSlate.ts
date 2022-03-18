import { Descendant, Point, Node } from "slate"
import { WMLQuery } from "../../../wml/wmlQuery"

export const wmlQueryToSlate = (wmlQuery: WMLQuery): Descendant[] => {
    const source = wmlQuery.source

    return source.split('\n').map((text) => ({ type: 'line', children: [{ text }] }))
}

export const indexToSlatePoint = (wmlQuery: WMLQuery, index: number): Point => {
    const source = wmlQuery.source
    const lines = source.slice(0, index).split('\n')
    return {
        path: [lines.length - 1],
        offset: lines[lines.length - 1].length
    }
}

export const sourceStringFromSlate = (nodes: Node[]): string => (
    nodes.map((node) => (Node.string(node))).join('\n')
)

export default wmlQueryToSlate
