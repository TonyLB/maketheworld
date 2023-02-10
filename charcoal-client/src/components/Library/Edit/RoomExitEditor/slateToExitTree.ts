import { extractDependenciesFromJS } from "@tonylb/mtw-wml/dist/convert/utils"
import { NormalConditionStatement } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { isSchemaCondition, isSchemaExit, SchemaConditionTagRoomContext, SchemaExitTag, SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { Node } from "slate"
import { CustomBlock, isCustomElseBlock, isCustomElseIfBlock, isCustomExitBlock, isCustomIfBlock } from "../baseClasses"

export const slateToExitSchema = (nodes: CustomBlock[]): SchemaTag[] => {
    //
    // TODO: Reduce a set of exitEditor nodes to a list of SchemaTags
    //
    let currentElseConditions: NormalConditionStatement[] = []
    return nodes.reduce<SchemaTag[]>((previous, node) => {
        if (isCustomIfBlock(node) || isCustomElseIfBlock(node)) {
            const conditionStatement = {
                if: node.source,
                dependencies: extractDependenciesFromJS(node.source)
            }
            if (isCustomIfBlock(node)) {
                currentElseConditions = []
            }
            currentElseConditions = [...currentElseConditions, { ...conditionStatement, not: true }]
            const contents = slateToExitSchema(node.children).filter((child: SchemaTag): child is SchemaExitTag | SchemaConditionTagRoomContext => (isSchemaExit(child) || isSchemaCondition(child)))
            if (contents.length) {
                return [
                    ...previous,
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
            const contents = slateToExitSchema(node.children).filter((child: SchemaTag): child is SchemaExitTag | SchemaConditionTagRoomContext => (isSchemaExit(child) || isSchemaCondition(child)))
            if (contents.length) {
                const returnElse: SchemaConditionTagRoomContext = {
                    tag: 'If' as 'If',
                    contextTag: 'Room',
                    conditions: currentElseConditions,
                    contents
                }
                currentElseConditions = []
                return [
                    ...previous,
                    returnElse
                ]
            }
        }
        if (isCustomExitBlock(node) && node.from && node.to && Node.string(node)) {
            return [
                ...previous,
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
        return previous
    }, [])
}

export default slateToExitSchema
