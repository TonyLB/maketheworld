import { EphemeraActionId, EphemeraBookmarkId, EphemeraComputedId, EphemeraFeatureId, EphemeraId, EphemeraKnowledgeId, EphemeraMapId, EphemeraMessageId, EphemeraMomentId, EphemeraRoomId, EphemeraVariableId, isEphemeraActionId, isEphemeraBookmarkId, isEphemeraComputedId, isEphemeraFeatureId, isEphemeraId, isEphemeraKnowledgeId, isEphemeraMapId, isEphemeraMessageId, isEphemeraMomentId, isEphemeraRoomId, isEphemeraVariableId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { TaggedMessageContent } from "@tonylb/mtw-interfaces/ts/messages"
import { MergeActionProperty } from "@tonylb/mtw-utilities/ts/dynamoDB/mixins/merge"
import { unique } from "@tonylb/mtw-utilities/ts/lists"
import internalCache from "../internalCache"
import { EphemeraItem, EphemeraItemDependency, isEphemeraBookmarkItem, isEphemeraComputedItem, isEphemeraFeatureItem, isEphemeraKnowledgeItem, isEphemeraMapItem, isEphemeraRoomItem, isEphemeraVariableItem } from "./baseClasses"
import GraphUpdate from "@tonylb/mtw-utilities/ts/graphStorage/update"
import { AssetKey } from "@tonylb/mtw-utilities/ts/types"
import { SchemaOutputTag, isSchemaBookmark, isSchemaCondition, isSchemaConditionStatement, isSchemaLink } from "@tonylb/mtw-wml/ts/schema/baseClasses"
import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-wml/ts/tree/baseClasses"

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
    isEphemeraKnowledgeId(EphemeraId) ||
    isEphemeraBookmarkId(EphemeraId) ||
    isEphemeraMapId(EphemeraId)
)

type EphemeraDependency = {
    target: EphemeraId;
    data?: { scopedId?: string };
}

const keysToDependencies = (keyMapping: Record<string, EphemeraId>) => (keys: string[]): EphemeraDependency[] => {
    return keys.map((key) => {
        const ephemeraId = keyMapping[key]
        if (ephemeraId) {
            return [{ target: ephemeraId, data: { scopedId: key } }]
        }
        return []
    }).flat(1)
}

const extractDependenciesFromTaggedContent = (values: GenericTree<SchemaOutputTag>, keyMapping: Record<string, EphemeraId>): EphemeraDependency[] => {
    const returnValue = values.reduce<EphemeraDependency[]>((previous, item) => {
        if (treeNodeTypeguard(isSchemaCondition)(item)) {
            return [
                ...previous,
                ...extractDependenciesFromTaggedContent(item.children, keyMapping)
            ]
        }
        if (treeNodeTypeguard(isSchemaConditionStatement)(item)) {
            return [
                ...previous,
                ...[
                    ...keysToDependencies(keyMapping)(item.data.dependencies ?? []),
                    ...extractDependenciesFromTaggedContent(item.children, keyMapping)
                ].filter((target) => (!previous.includes(target)))
            ]
        }
        if (treeNodeTypeguard(isSchemaBookmark)(item)) {
            return [
                ...previous.filter(({ target }) => (target !== item.data.key)),
                ...keysToDependencies(keyMapping)([item.data.key])
            ]
        }
        if (treeNodeTypeguard(isSchemaLink)(item)) {
            return [
                ...previous.filter(({ target }) => (target !== item.data.to)),
                ...keysToDependencies(keyMapping)([item.data.to])
            ]
        }
        return previous
    }, [])
    return returnValue
}

const extractDependenciesFromEphemeraItem = (item: EphemeraItem): EphemeraDependency[] => {
    let dependencies: EphemeraDependency[] = []
    if (isEphemeraInternallyBacklinked(item.EphemeraId)) {
        if (isEphemeraRoomItem(item)) {
            dependencies = [
                ...dependencies,
                ...extractDependenciesFromTaggedContent(item.render ?? [], item.keyMapping),
                ...extractDependenciesFromTaggedContent(item.summary ?? [], item.keyMapping)
            ]
        }
        if (isEphemeraFeatureItem(item) || isEphemeraKnowledgeItem(item)) {
            dependencies = [
                ...dependencies,
                ...extractDependenciesFromTaggedContent(item.render ?? [], item.keyMapping)
            ]
        }
        if (isEphemeraMapItem(item)) {
            dependencies = [
                ...dependencies,
                ...Object.entries(item.keyMapping).map(([scopedId, EphemeraId]) => ({ target: EphemeraId, data: { scopedId } }))
            ]
        }
    }
    const deduplicate = Object.values(Object.assign({}, ...dependencies.map((dependency) => ({ [dependency.target]: dependency })))) as EphemeraDependency[]
    return [
        ...('stateMapping' in item ? Object.entries(item.stateMapping).map(([scopedId, ephemeraId]) => ({ target: ephemeraId, data: { scopedId } })) : []),
        ...deduplicate
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
