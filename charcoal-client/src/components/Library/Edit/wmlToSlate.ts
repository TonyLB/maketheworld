import { Descendant, Point, Node } from "slate"

export const wmlToSlate = (source: string): Descendant[] => {
    return source.split('\n').map((text) => ({ type: 'line', children: [{ text }] }))
}

export const indexToSlatePoint = (source: string, index: number): Point => {
    const lines = source.slice(0, index).split('\n')
    return {
        path: [lines.length - 1],
        offset: lines[lines.length - 1].length
    }
}

export const sourceStringFromSlate = (nodes: Node[]): string => (
    nodes.map((node) => (Node.string(node))).join('\n')
)

export default wmlToSlate
