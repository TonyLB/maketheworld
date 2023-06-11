import { extractDependenciesFromJS } from "@tonylb/mtw-wml/dist/convert/utils"
import { NormalConditionStatement } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { isSchemaCondition, isSchemaExit, SchemaConditionTagRoomContext, SchemaExitTag, SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { Node } from "slate"
import { unique } from "../../../../lib/lists"
import { CustomBlock, isCustomElseBlock, isCustomElseIfBlock, isCustomExitBlock, isCustomIfBlock } from "../baseClasses"

const slateToSourceRooms = (nodes: CustomBlock[]): string[] => {
    return nodes.reduce<string[]>((previous, node) => {
        if (isCustomExitBlock(node)) {
            return unique(previous, [node.from])
        }
        if (isCustomIfBlock(node) || isCustomElseIfBlock(node) || isCustomElseBlock(node)) {
            return unique(previous, slateToSourceRooms(node.children))
        }
        return previous
    }, [])
}

const slateToExitReducer = (nodes: CustomBlock[], currentElseConditions: NormalConditionStatement[]) => (previous, roomId) => ({
    ...previous,
    [roomId]: nodes.reduce<SchemaTag[]>((accumulator, node) => {
        if (isCustomIfBlock(node) || isCustomElseIfBlock(node)) {
            const conditionStatement = {
                if: node.source,
                dependencies: extractDependenciesFromJS(node.source)
            }
            if (isCustomIfBlock(node)) {
                currentElseConditions = []
            }
            currentElseConditions = [...currentElseConditions, { ...conditionStatement, not: true }]
            const childrenSchema = slateToExitSchema(node.children, { roomId })
            const contents = (childrenSchema?.[roomId] || []).filter((child: SchemaTag): child is SchemaExitTag | SchemaConditionTagRoomContext => (isSchemaExit(child) || isSchemaCondition(child)))
            if (contents.length) {
                return [
                    ...accumulator,
                    {
                        tag: 'If' as 'If',
                        contextTag: 'Room',
                        conditions: [...currentElseConditions.slice(0, -1), conditionStatement],
                        contents
                    }
                ]
            }
        }
        if (isCustomElseBlock(node)) {
            const contents = slateToExitSchema(node.children, { roomId })[roomId].filter((child: SchemaTag): child is SchemaExitTag | SchemaConditionTagRoomContext => (isSchemaExit(child) || isSchemaCondition(child)))
            if (contents.length) {
                const returnElse: SchemaConditionTagRoomContext = {
                    tag: 'If' as 'If',
                    contextTag: 'Room',
                    conditions: currentElseConditions,
                    contents
                }
                currentElseConditions = []
                return [
                    ...accumulator,
                    returnElse
                ]
            }
        }
        if (isCustomExitBlock(node) && node.from === roomId && node.to && Node.string(node)) {
            return [
                ...accumulator,
                {
                    tag: 'Exit' as 'Exit',
                    key: `${node.from}#${node.to}`,
                    from: node.from,
                    to: node.to,
                    name: Node.string(node),
                    contents: []
                }
            ]
        }
        return accumulator
    }, [])
})

export const slateToExitSchema = (nodes: CustomBlock[], options?: { roomId?: string }): Record<string, SchemaTag[]> => {
    //
    // TODO: Reduce a set of exitEditor nodes to a list of SchemaTags
    //
    let currentElseConditions: NormalConditionStatement[] = []
    const allSourceRooms = options?.roomId ? [options?.roomId] : slateToSourceRooms(nodes)
    return allSourceRooms.reduce<Record<string, SchemaTag[]>>(slateToExitReducer(nodes, currentElseConditions), {})
}

export default slateToExitSchema
