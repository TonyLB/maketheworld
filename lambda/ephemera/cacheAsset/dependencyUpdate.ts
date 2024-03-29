import { EphemeraActionId, EphemeraBookmarkId, EphemeraComputedId, EphemeraFeatureId, EphemeraId, EphemeraKnowledgeId, EphemeraMapId, EphemeraMessageId, EphemeraMomentId, EphemeraRoomId, EphemeraVariableId, isEphemeraActionId, isEphemeraBookmarkId, isEphemeraComputedId, isEphemeraFeatureId, isEphemeraId, isEphemeraKnowledgeId, isEphemeraMapId, isEphemeraMessageId, isEphemeraMomentId, isEphemeraRoomId, isEphemeraVariableId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { TaggedMessageContent } from "@tonylb/mtw-interfaces/ts/messages"
import { MergeActionProperty } from "@tonylb/mtw-utilities/ts/dynamoDB/mixins/merge"
import { unique } from "@tonylb/mtw-utilities/ts/lists"
import internalCache from "../internalCache"
import { EphemeraItem, EphemeraItemDependency, isEphemeraBookmarkItem, isEphemeraComputedItem, isEphemeraFeatureItem, isEphemeraMapItem, isEphemeraRoomItem, isEphemeraVariableItem } from "./baseClasses"
import GraphUpdate from "@tonylb/mtw-utilities/ts/graphStorage/update"
import { AssetKey } from "@tonylb/mtw-utilities/ts/types"

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

const isEphemeraInternallyBacklinked = (EphemeraId: string): EphemeraId is (EphemeraComputedId | EphemeraRoomId | EphemeraFeatureId | EphemeraBookmarkId | EphemeraMapId) => (
    isEphemeraComputedId(EphemeraId) ||
    isEphemeraRoomId(EphemeraId) ||
    isEphemeraFeatureId(EphemeraId) ||
    isEphemeraBookmarkId(EphemeraId) ||
    isEphemeraMapId(EphemeraId)
)

const dependencyExtractor = ({ dependencies }: { dependencies: EphemeraItemDependency[] }): { target: EphemeraId; data?: { scopedId?: string } }[] => (
    dependencies.map(({ EphemeraId, key }) => (isEphemeraId(EphemeraId) ? [{ target: EphemeraId, data: { scopedId: key } }]: [])).flat()
)

const extractDependenciesFromTaggedContent = (values: TaggedMessageContent[]): { target: EphemeraId; data?: { scopedId?: string } }[] => {
    const returnValue = values.reduce<{ target: EphemeraId; data?: { scopedId?: string } }[]>((previous, item) => {
        if (item.tag === 'Condition') {
            return [
                ...previous,
                ...[
                    ...item.conditions.map(dependencyExtractor).flat(),
                    ...extractDependenciesFromTaggedContent(item.contents)
                ].filter(({ target }) => (!previous.map(({ target }) => (target)).includes(target)))
            ]
        }
        if (item.tag === 'Bookmark') {
            return [
                ...previous.filter(({ target }) => (target !== item.to)),
                { target: item.to }
            ]
        }
        if (item.tag === 'Link' && (isEphemeraFeatureId(item.to) || isEphemeraActionId(item.to))) {
            return [
                ...previous.filter(({ target }) => (target !== item.to)),
                { target: item.to }
            ]
        }
        return previous
    }, [])
    return returnValue
}

const extractDependenciesFromEphemeraItem = (item: EphemeraItem): { target: EphemeraId; data?: { scopedId?: string } }[] => {
    return [
        ...('stateMapping' in item ? Object.entries(item.stateMapping).map(([scopedId, ephemeraId]) => ({ target: ephemeraId, data: { scopedId } })) : []),
        ...('keyMapping' in item ? Object.entries(item.keyMapping).map(([scopedId, ephemeraId]) => ({ target: ephemeraId })) : [])
    ]
}

const assetBacklink = (context: string) => (item: EphemeraItem) => {
    if (isEphemeraComputedItem(item) || isEphemeraVariableItem(item) || isEphemeraRoomItem(item)) {
        return {
            target: AssetKey(context),
            context,
            data: { scopedId: item.key  }
        }
    }
    return { target: AssetKey(context), context }
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
            const item = mergeAction.action as unknown as EphemeraItem
            graphUpdate.setEdges([{
                itemId: EphemeraId,
                edges: [
                    assetBacklink(context)(item),
                    ...extractDependenciesFromEphemeraItem(item).map((dependency) => ({ ...dependency, context }))
                ],
                options
            }])
        }
    }, [])
}
