import { NormalExit, NormalForm } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { Descendant, Point, Node } from "slate"
import { ConditionalTree } from "../conditionTree"

export const exitTreeToSlate = (normalForm: NormalForm) => (tree: ConditionalTree<string>): Descendant[] => {
    return [
        ...tree.items.map((key) => {
            const { to, from, appearances = [] } = normalForm[key] as NormalExit
            return {
                type: 'exit' as 'exit',
                key,
                to,
                from,
                children: [{ text: '' }]
            }
        })
    ]
}

export const indexToSlatePoint = (source: string, index: number): Point => {
    const lines = source.slice(0, index).split('\n')
    return {
        path: [lines.length - 1],
        offset: lines[lines.length - 1].length
    }
}

export const slateToString = (nodes: Node[]): string => (
    nodes.map((node) => (Node.string(node))).join('\n')
)

export default exitTreeToSlate
