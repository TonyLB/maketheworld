import { EphemeraExampleId, EphemeraFeatureId, EphemeraId, EphemeraKnowledgeId, EphemeraMapId, EphemeraMessageId, EphemeraMomentId, EphemeraRoomId, isEphemeraExampleId, isEphemeraFeatureId, isEphemeraId, isEphemeraKnowledgeId, isEphemeraMapId, isEphemeraMessageId, isEphemeraMomentId, isEphemeraRoomId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { MergeActionProperty } from "@tonylb/mtw-utilities/ts/dynamoDB/mixins/merge"
import internalCache from "../internalCache"
import { EphemeraKeyMappingMixin } from "./baseClasses"
import GraphUpdate from "@tonylb/mtw-utilities/ts/graphStorage/update"
import { AssetKey } from "@tonylb/mtw-utilities/ts/types"
import { isStandardMap, isStandardRoom, StandardComponentData } from "@tonylb/mtw-wml/ts/standardize/baseClasses"
import { excludeUndefined } from "@tonylb/mtw-utilities/ts/lists"
import { isSchemaLink } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isStandardExample } from "@tonylb/mtw-wml/ts/standardize/components/dataTypes/example"
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"

const isEphemeraBackLinkedToAsset = (EphemeraId: string): EphemeraId is (EphemeraRoomId | EphemeraKnowledgeId | EphemeraExampleId | EphemeraMapId | EphemeraFeatureId | EphemeraMessageId | EphemeraMomentId) => (
    isEphemeraRoomId(EphemeraId) ||
    isEphemeraKnowledgeId(EphemeraId) ||
    isEphemeraExampleId(EphemeraId) ||
    isEphemeraMapId(EphemeraId) ||
    isEphemeraFeatureId(EphemeraId) ||
    isEphemeraMessageId(EphemeraId) ||
    isEphemeraMomentId(EphemeraId)
)

const isEphemeraInternallyBacklinked = (EphemeraId: string): EphemeraId is (EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId | EphemeraMapId | EphemeraExampleId) => (
    isEphemeraRoomId(EphemeraId) ||
    isEphemeraFeatureId(EphemeraId) ||
    isEphemeraKnowledgeId(EphemeraId) ||
    isEphemeraMapId(EphemeraId) ||
    isEphemeraExampleId(EphemeraId)
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

const extractDependenciesFromTaggedContent = (values: RenderTree, keyMapping: Record<string, EphemeraId>): EphemeraDependency[] => {
    const returnValue = values.reduce<EphemeraDependency[]>((previous, item) => {
        if (typeof item === 'string') {
            return previous
        }
        const { data } = item
        if (isSchemaLink(data)) {
            return [
                ...previous.filter(({ target }) => (target !== data.to)),
                ...keysToDependencies(keyMapping)([data.to])
            ]
        }
        return [
            ...previous,
            ...extractDependenciesFromTaggedContent(item.children, keyMapping)
        ]
    }, [])
    return returnValue
}

const extractDependenciesFromEphemeraItem = (item: StandardComponentData & EphemeraKeyMappingMixin, EphemeraId: string): EphemeraDependency[] => {
    let dependencies: EphemeraDependency[] = []
    if (isEphemeraInternallyBacklinked(EphemeraId)) {
        if (isStandardExample(item)) {
            dependencies = [
                ...dependencies,
                ...extractDependenciesFromTaggedContent((item.name ?? []).filter(excludeUndefined), item.keyMapping as Record<string, EphemeraId> ?? {}),
                ...extractDependenciesFromTaggedContent((item.description ?? []).filter(excludeUndefined), item.keyMapping as Record<string, EphemeraId> ?? {}),
                ...extractDependenciesFromTaggedContent((item.summary ?? []).filter(excludeUndefined), item.keyMapping as Record<string, EphemeraId> ?? {})
            ]
        }
        if (isStandardMap(item)) {
            dependencies = [
                ...dependencies,
                ...Object.entries(item.keyMapping ?? {}).map(([scopedId, ephemeraId]) => ({ target: ephemeraId as EphemeraId, data: { scopedId } }))
            ]
        }
    }
    const deduplicate = Object.values(Object.assign({}, ...dependencies.map((dependency) => ({ [dependency.target]: dependency })))) as EphemeraDependency[]
    return [
        // stateMapping dependencies removed - Variable/Computed no longer exist
        ...deduplicate
    ]
}

const assetBacklink = (context: string) => (item: StandardComponentData) => {
    if (isStandardRoom(item) || isStandardExample(item)) {
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
            const item = mergeAction.action as unknown as StandardComponentData & EphemeraKeyMappingMixin
            graphUpdate.setEdges([{
                itemId: EphemeraId,
                edges: [
                    assetBacklink(context)(item),
                    ...extractDependenciesFromEphemeraItem(item, EphemeraId).map((dependency) => ({ ...dependency, context }))
                ],
                options
            }])
        }
    }, [])
}
