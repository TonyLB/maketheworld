import { EphemeraBookmarkId, EphemeraComputedId, EphemeraId, EphemeraKnowledgeId, EphemeraMapId, EphemeraRoomId, isEphemeraBookmarkId, isEphemeraComputedId, isEphemeraId, isEphemeraKnowledgeId, isEphemeraMapId, isEphemeraRoomId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { TaggedMessageContent } from "@tonylb/mtw-interfaces/dist/messages"
import { MergeActionProperty } from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/merge"
import setEdges, { SetEdgesNodeArgument } from "@tonylb/mtw-utilities/dist/graphStorage/update/setEdges"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import internalCache from "../internalCache"
import { graphStorageDB } from "../dependentMessages/graphCache"
import { EphemeraItem, EphemeraItemDependency, isEphemeraBookmarkItem, isEphemeraComputedItem, isEphemeraMapItem, isEphemeraRoomItem } from "./baseClasses"

const dependencyExtractor = ({ dependencies }: { dependencies: EphemeraItemDependency[] }) => (dependencies.map(({ EphemeraId }) => (EphemeraId)).filter(isEphemeraId))

const extractDependenciesFromTaggedContent = (values: TaggedMessageContent[]): EphemeraId[] => {
    const returnValue = values.reduce<EphemeraId[]>((previous, item) => {
        if (item.tag === 'Condition') {
            return [
                ...previous,
                ...item.conditions.map(dependencyExtractor).flat(),
                ...extractDependenciesFromTaggedContent(item.contents)
            ]
        }
        if (item.tag === 'Bookmark') {
            return [
                ...previous,
                item.to
            ]
        }
        return previous
    }, [])
    return unique(returnValue)
}

const extractDependenciesFromEphemeraItem = (item: EphemeraItem): EphemeraId[] => {
    if (isEphemeraComputedItem(item)) {
        return item.dependencies.map(({ EphemeraId }) => (EphemeraId)).filter(isEphemeraId)
    }
    if (isEphemeraMapItem(item)) {
        return unique(
            item.appearances.map(({ rooms }) => (rooms.map(({ EphemeraId }) => (EphemeraId)))).flat().filter(isEphemeraId)
        )
    }
    if (isEphemeraRoomItem(item)) {
        return unique(
            item.appearances.map(({ conditions, render, name, exits }) => ([
                ...conditions.map(dependencyExtractor),
                ...exits.map(({ conditions }) => (conditions.map(dependencyExtractor))).flat(),
                ...extractDependenciesFromTaggedContent(render),
                ...extractDependenciesFromTaggedContent(name),
            ])).flat(2)
        )
    }
    if (isEphemeraBookmarkItem(item)) {
        return unique(
            item.appearances.map(({ conditions, render }) => ([
                ...conditions.map(dependencyExtractor),
                ...extractDependenciesFromTaggedContent(render)
            ])).flat(2)
        )
    }
    return []
}

const isEphemeraDependentId = (EphemeraId: string): EphemeraId is (EphemeraComputedId | EphemeraRoomId | EphemeraKnowledgeId | EphemeraBookmarkId | EphemeraMapId) => (
    isEphemeraComputedId(EphemeraId) ||
    isEphemeraRoomId(EphemeraId) ||
    isEphemeraKnowledgeId(EphemeraId) ||
    isEphemeraBookmarkId(EphemeraId) ||
    isEphemeraMapId(EphemeraId)
)

export const updateDependenciesFromMergeActions = (context: string) => async (mergeActions: MergeActionProperty<'EphemeraId', string>[]) => {
    const nodeUpdates = mergeActions.reduce<SetEdgesNodeArgument<EphemeraId>[]>((previous, mergeAction) => {
        const { EphemeraId } = mergeAction.key
        const options = { direction: 'back' as const, contextFilter: (checkContext: string) => (checkContext === context)}

        if (!isEphemeraId(EphemeraId) || !isEphemeraDependentId(EphemeraId)) {
            return previous
        }
        if (mergeAction.action === 'delete') {
            return [
                ...previous,
                {
                    itemId: EphemeraId,
                    edges: [],
                    options
                }
            ]
        }
        if (typeof mergeAction.action !== 'string') {
            if (!mergeAction.action) {
                return previous
            }
            return [
                ...previous,
                {
                    itemId: EphemeraId,
                    edges: extractDependenciesFromEphemeraItem(mergeAction.action as unknown as EphemeraItem).map((target) => ({ target, context })),
                    options
                }
            ]
        }
        return previous
    }, [])
    await setEdges({ internalCache: internalCache._graphCache, dbHandler: graphStorageDB })(nodeUpdates)
}