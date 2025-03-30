import { EphemeraActionId, EphemeraComputedId, EphemeraExampleId, EphemeraFeatureId, EphemeraId, EphemeraKnowledgeId, EphemeraMapId, EphemeraMessageId, EphemeraMomentId, EphemeraRoomId, EphemeraVariableId, isEphemeraActionId, isEphemeraComputedId, isEphemeraExampleId, isEphemeraFeatureId, isEphemeraId, isEphemeraKnowledgeId, isEphemeraMapId, isEphemeraMessageId, isEphemeraMomentId, isEphemeraRoomId, isEphemeraVariableId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { MergeActionProperty } from "@tonylb/mtw-utilities/ts/dynamoDB/mixins/merge"
import internalCache from "../internalCache"
import { EphemeraComponentMixin } from "./baseClasses"
import GraphUpdate from "@tonylb/mtw-utilities/ts/graphStorage/update"
import { AssetKey } from "@tonylb/mtw-utilities/ts/types"
import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isStandardComputed, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardRoom, isStandardVariable, StandardComponentData } from "@tonylb/mtw-wml/ts/standardize/baseClasses"
import { excludeUndefined } from "@tonylb/mtw-utilities/ts/lists"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaDescription, isSchemaName, isSchemaSummary, SchemaDescriptionTag, SchemaNameTag, SchemaSummaryTag } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaEdit } from "@tonylb/mtw-base/ts/schema/edit"
import { isSchemaCondition, isSchemaConditionStatement } from "@tonylb/mtw-base/ts/schema/condition"
import { isSchemaLink } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isStandardExample } from "@tonylb/mtw-wml/ts/standardize/components/dataTypes/example"
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"

const isEphemeraBackLinkedToAsset = (EphemeraId: string): EphemeraId is (EphemeraComputedId | EphemeraRoomId | EphemeraKnowledgeId | EphemeraExampleId | EphemeraMapId | EphemeraFeatureId | EphemeraActionId | EphemeraVariableId | EphemeraMessageId | EphemeraMomentId) => (
    isEphemeraComputedId(EphemeraId) ||
    isEphemeraRoomId(EphemeraId) ||
    isEphemeraKnowledgeId(EphemeraId) ||
    isEphemeraExampleId(EphemeraId) ||
    isEphemeraMapId(EphemeraId) ||
    isEphemeraFeatureId(EphemeraId) ||
    isEphemeraActionId(EphemeraId) ||
    isEphemeraVariableId(EphemeraId) ||
    isEphemeraMessageId(EphemeraId) ||
    isEphemeraMomentId(EphemeraId)
)

const isEphemeraInternallyBacklinked = (EphemeraId: string): EphemeraId is (EphemeraComputedId | EphemeraRoomId | EphemeraFeatureId | EphemeraMapId | EphemeraExampleId) => (
    isEphemeraComputedId(EphemeraId) ||
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

const extractDependenciesFromEphemeraItem = (item: StandardComponentData & EphemeraComponentMixin): EphemeraDependency[] => {
    let dependencies: EphemeraDependency[] = []
    if (isEphemeraInternallyBacklinked(item.EphemeraId)) {
        if (isStandardExample(item)) {
            dependencies = [
                ...dependencies,
                ...extractDependenciesFromTaggedContent((item.name ?? []).filter(excludeUndefined), item.keyMapping ?? {}),
                ...extractDependenciesFromTaggedContent((item.description ?? []).filter(excludeUndefined), item.keyMapping ?? {}),
                ...extractDependenciesFromTaggedContent((item.summary ?? []).filter(excludeUndefined), item.keyMapping ?? {})
            ]
        }
        if (isStandardMap(item)) {
            dependencies = [
                ...dependencies,
                ...Object.entries(item.keyMapping ?? {}).map(([scopedId, EphemeraId]) => ({ target: EphemeraId, data: { scopedId } }))
            ]
        }
    }
    const deduplicate = Object.values(Object.assign({}, ...dependencies.map((dependency) => ({ [dependency.target]: dependency })))) as EphemeraDependency[]
    return [
        ...(Object.entries(item.stateMapping ?? {}).map(([scopedId, ephemeraId]) => ({ target: ephemeraId, data: { scopedId } }))),
        ...deduplicate
    ]
}

const assetBacklink = (context: string) => (item: StandardComponentData) => {
    if (isStandardComputed(item) || isStandardVariable(item) || isStandardRoom(item) || isStandardExample(item)) {
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
            const item = mergeAction.action as unknown as StandardComponentData & EphemeraComponentMixin
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
