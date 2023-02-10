import { NormalExit, NormalForm } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { Descendant } from "slate"
import { isCustomBlock } from "../baseClasses"
import { ConditionalTree } from "../conditionTree"

export const exitTreeToSlate = (normalForm: NormalForm) => (tree: ConditionalTree<string>): Descendant[] => {
    return [
        ...tree.items.map((key) => {
            const { to, from, name } = normalForm[key] as NormalExit
            return {
                type: 'exit' as 'exit',
                key,
                to,
                from,
                children: [{ text: name ?? '' }]
            }
        }),
        ...tree.conditionals.map(({ if: ifBase, elseIfs, else: elsePredicate }) => ([
            {
                type: 'ifBase' as 'ifBase',
                source: ifBase.source,
                children: exitTreeToSlate(normalForm)(ifBase.node).filter(isCustomBlock)
            },
            ...(elseIfs || []).map(({ source, node }) => ({
                type: 'elseif' as 'elseif',
                source,
                children: exitTreeToSlate(normalForm)(node).filter(isCustomBlock)
            })),
            ...(elsePredicate
                ? [{
                    type: 'else' as 'else',
                    children: exitTreeToSlate(normalForm)(elsePredicate.node).filter(isCustomBlock)
                }]
                : [])
        ])).flat(2)
    ]
}

export default exitTreeToSlate
