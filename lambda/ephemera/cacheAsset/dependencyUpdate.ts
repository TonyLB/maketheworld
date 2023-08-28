import { EphemeraActionId, EphemeraBookmarkId, EphemeraComputedId, EphemeraFeatureId, EphemeraId, EphemeraKnowledgeId, EphemeraMapId, EphemeraMessageId, EphemeraMomentId, EphemeraRoomId, EphemeraVariableId, isEphemeraActionId, isEphemeraBookmarkId, isEphemeraComputedId, isEphemeraFeatureId, isEphemeraId, isEphemeraKnowledgeId, isEphemeraMapId, isEphemeraMessageId, isEphemeraMomentId, isEphemeraRoomId, isEphemeraVariableId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { TaggedMessageContent } from "@tonylb/mtw-interfaces/dist/messages"
import { MergeActionProperty } from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/merge"
import { SetEdgesNodeArgument } from "@tonylb/mtw-utilities/dist/graphStorage/update/setEdges"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import internalCache from "../internalCache"
import { EphemeraItem, EphemeraItemDependency, isEphemeraBookmarkItem, isEphemeraComputedItem, isEphemeraMapItem, isEphemeraRoomItem } from "./baseClasses"
import GraphUpdate from "@tonylb/mtw-utilities/dist/graphStorage/update"
import { AssetKey } from "@tonylb/mtw-utilities/dist/types"

const isEphemeraBackLinkedToAsset = (EphemeraId: string): EphemeraId is (EphemeraComputedId | EphemeraRoomId | EphemeraKnowledgeId | EphemeraBookmarkId | EphemeraMapId | EphemeraFeatureId | EphemeraActionId | EphemeraVariableId | EphemeraMessageId | EphemeraMomentId) => (
    isEphemeraComputedId(EphemeraId) ||
    isEphemeraRoomId(EphemeraId) ||
    isEphemeraKnowledgeId(EphemeraId) ||
    isEphemeraBookmarkId(EphemeraId) ||
    isEphemeraMapId(EphemeraId) ||
    isEphemeraFeatureId(EphemeraId) ||
    isEphemeraActionId(EphemeraId) ||
    isEphemeraVariableId(EphemeraId) ||
    isEphemeraMessageId(EphemeraId) ||
    isEphemeraMomentId(EphemeraId)
)

const isEphemeraInternallyBacklinked = (EphemeraId: string): EphemeraId is (EphemeraComputedId | EphemeraRoomId | EphemeraKnowledgeId | EphemeraBookmarkId | EphemeraMapId) => (
    isEphemeraComputedId(EphemeraId) ||
    isEphemeraRoomId(EphemeraId) ||
    isEphemeraKnowledgeId(EphemeraId) ||
    isEphemeraBookmarkId(EphemeraId) ||
    isEphemeraMapId(EphemeraId)
)

const dependencyExtractor = ({ dependencies }: { dependencies: EphemeraItemDependency[] }) => (dependencies.map(({ EphemeraId }) => (EphemeraId)).filter(isEphemeraId))

const extractDependenciesFromTaggedContent = (values: TaggedMessageContent[]): EphemeraId[] => {
    //
    // TODO: Extend dependencies to include items included through link
    //
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
    if (!isEphemeraInternallyBacklinked(item.EphemeraId)) {
        return []
    }
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

export const updateDependenciesFromMergeActions = (context: string, graphUpdate: GraphUpdate<typeof internalCache._graphCache, string>) => async (mergeActions: MergeActionProperty<'EphemeraId', string>[]) => {
    mergeActions.forEach((mergeAction) => {
        const { EphemeraId } = mergeAction.key
        const options = { direction: 'back' as const, contextFilter: (checkContext: string) => (checkContext === context)}

        if (!isEphemeraId(EphemeraId) || !isEphemeraBackLinkedToAsset(EphemeraId)) {
            return
        }
        if (mergeAction.action === 'delete') {
            graphUpdate.setEdges([{
                itemId: EphemeraId,
                edges: [],
                options
            }])
        }
        if (typeof mergeAction.action !== 'string') {
            if (!mergeAction.action) {
                return
            }
            graphUpdate.setEdges([{
                itemId: EphemeraId,
                edges: [
                    { target: AssetKey(context), context },
                    ...extractDependenciesFromEphemeraItem(mergeAction.action as unknown as EphemeraItem).map((target) => ({ target, context }))
                ],
                options
            }])
        }
    }, [])
}
