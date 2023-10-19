import { SchemaConditionMixin, SchemaConditionTag, SchemaExitTag, isSchemaCondition, isSchemaExit } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses";
import { ConditionalTree } from "../conditionTree";
import { RoomExit } from "./baseClasses";
import { unique } from "../../../../lib/lists";
import { extractDependenciesFromJS } from "@tonylb/mtw-wml/dist/convert/utils";
import { objectMap } from "../../../../lib/objects";

type ExitTree = ConditionalTree<RoomExit>

const exitTreeToSourceRooms = (node: ExitTree): string[] => {
    return unique(
        node.items.map(({ from }) => (from)),
        ...node.conditionals.map((conditional) => (unique(
            exitTreeToSourceRooms(conditional.if.node),
            ...conditional.elseIfs.map(({ node }) => (exitTreeToSourceRooms(node))),
            conditional.else ? exitTreeToSourceRooms(conditional.else.node) : []
        )))
    )
}

type SchemaConditionDefinition = SchemaConditionMixin["conditions"][number]

const sortSchemaConditions = (conditionsA: SchemaConditionDefinition[], conditionsB: SchemaConditionDefinition[]): number => {
    if (conditionsA.length === 0 && conditionsB.length === 0) { return 0 }
    if (conditionsA.length === 0) { return -1 }
    if (conditionsB.length === 0) { return 1 }
    const compare = conditionsA[0].if.localeCompare(conditionsB[0].if)
    if (compare) { return compare }
    if (!conditionsA[0].not && conditionsB[0].not) { return -1 }
    if (conditionsA[0].not && !conditionsB[0].not) { return 1 }
    return sortSchemaConditions(conditionsA.slice(1), conditionsB.slice(1))
}

type ExitTreeSchemaReduceOutput = Record<string, (SchemaExitTag | SchemaConditionTag)[]>

const treeToExitMergeSubCondition = (accumulator: ExitTreeSchemaReduceOutput, conditionContext: SchemaConditionDefinition[], merge: ExitTreeSchemaReduceOutput): ExitTreeSchemaReduceOutput => {
    return Object.entries(merge)
        .reduce<ExitTreeSchemaReduceOutput>((previous, [roomId, mergeItem]) => ({
            ...previous,
            [roomId]: [
                ...(previous[roomId] || []),
                {
                    tag: 'If',
                    conditions: conditionContext,
                    contents: mergeItem
                }
            ]
        }), accumulator)
}

const treeToExitMergeCondition = (accumulator: ExitTreeSchemaReduceOutput, condition: ExitTree["conditionals"][number]): ExitTreeSchemaReduceOutput => {
    //
    // Utility function to convert source strings into the dependency-supplemented record that Schema demands
    //
    const conditionWrap = (source: string): SchemaConditionDefinition => ({
        if: source,
        dependencies: extractDependenciesFromJS(source)
    })
    //
    // Merge the primary if condition
    //
    const ifCondition = conditionWrap(condition.if.source)
    const ifMerged = treeToExitMergeSubCondition(
        accumulator,
        [ifCondition],
        treeToExitByRoomId(condition.if.node)
    )
    //
    // Merge each elseIf in sequence, keeping a running tally of conditions that need to have failed to reach each successive elseIf
    //
    const { currentElse, output: elseIfsMerged } = condition.elseIfs.reduce<{ currentElse: SchemaConditionDefinition[], output: ExitTreeSchemaReduceOutput }>((previous, elseIf) => {
        const wrappedCondition = conditionWrap(elseIf.source)
        return {
            currentElse: [...previous.currentElse, { ...wrappedCondition, not: true }],
            output: treeToExitMergeSubCondition(
                previous.output,
                [...previous.currentElse, wrappedCondition],
                treeToExitByRoomId(elseIf.node)
            )
        }
    }, { currentElse: [{ ...ifCondition, not: true }], output: ifMerged })
    //
    // If needed, merge in the remaining sub-condition for an ending else clause
    //
    if (condition.else) {
        return treeToExitMergeSubCondition(
            elseIfsMerged,
            currentElse,
            treeToExitByRoomId(condition.else.node)
        )
    }
    else {
        return elseIfsMerged
    }
}

const treeToExitByRoomId = (node: ExitTree): ExitTreeSchemaReduceOutput => {
    const directItems = node.items.reduce<ExitTreeSchemaReduceOutput>((previous, exit) => ({
        ...previous,
        [exit.from]: [
            ...(previous[exit.from] || []),
            {
                tag: 'Exit' as 'Exit',
                key: `${exit.from}#${exit.to}`,
                from: exit.from,
                to: exit.to,
                name: exit.name,
                contents: []
            } as SchemaExitTag
        ]
    }), {})
    return node.conditionals.reduce<ExitTreeSchemaReduceOutput>(treeToExitMergeCondition, directItems)
}

//
// Reduce a set of exitEditor nodes to a list of SchemaTags (sorted in standard order)
//
export const exitTreeToSchema = (tree: ExitTree): Record<string, (SchemaExitTag | SchemaConditionTag)[]> => {
    const exitsByRoomId = treeToExitByRoomId(tree)

    return objectMap(exitsByRoomId, (unsortedSchema) => {
        const unconditionedItems = [...unsortedSchema].filter(isSchemaExit).sort(({ to: toA  }, { to: toB }) => (toA.localeCompare(toB)))
        const conditionedItems = ([...unsortedSchema].filter(isSchemaCondition) as SchemaConditionTag[]).sort(({ conditions: conditionsA }, { conditions: conditionsB }) => (sortSchemaConditions(conditionsA, conditionsB)))
        return [...unconditionedItems, ...conditionedItems]
    })
}

export default exitTreeToSchema
