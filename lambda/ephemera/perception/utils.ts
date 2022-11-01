import { EphemeraComputedId, EphemeraVariableId, isEphemeraComputedId, isEphemeraVariableId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { TaggedConditionalItemDependency } from "@tonylb/mtw-interfaces/dist/messages"
import { EphemeraCondition } from "../cacheAsset/baseClasses"
import internalCache from "../internalCache"
import { EvaluateCodeAddress } from "../internalCache/assetState"

export const evaluateConditional = async (src: string, dependencies: TaggedConditionalItemDependency[]): Promise<boolean> => {
    return Boolean(await internalCache.EvaluateCode.get({
        source: src,
        mapping: dependencies
            .reduce<Record<string, EphemeraComputedId | EphemeraVariableId>>((previous, { EphemeraId, key }) => (
                (key && (isEphemeraComputedId(EphemeraId) || isEphemeraVariableId(EphemeraId)))
                    ? { ...previous, [key]: EphemeraId }
                    : previous
                ), {})
    }))
}

export const filterAppearances = (evaluateCode: (address: EvaluateCodeAddress) => Promise<any>) => async <T extends { conditions: EphemeraCondition[] }>(possibleAppearances: T[]): Promise<T[]> => {
    //
    // TODO: Aggregate and also return a dependencies map of source and mappings, so that the cache can search
    // for dependencies upon a certain evaluation code and invalidate the render when that evaluation has been
    // invalidated
    //
    const allPromises = possibleAppearances
        .map(async (appearance): Promise<T | undefined> => {
            const conditionsPassList = await Promise.all(appearance.conditions.map(({ if: source, dependencies }) => (
                evaluateCode({
                    source,
                    mapping: dependencies
                        .reduce<Record<string, EphemeraComputedId | EphemeraVariableId>>((previous, { EphemeraId, key }) => (
                            (key && (isEphemeraComputedId(EphemeraId) || isEphemeraVariableId(EphemeraId)))
                                ? { ...previous, [key]: EphemeraId }
                                : previous
                            ), {})
                })
            )))
            const allConditionsPass = conditionsPassList.reduce<boolean>((previous, value) => (previous && Boolean(value)), true)
            if (allConditionsPass) {
                return appearance
            }
            else {
                return undefined
            }
        })
    const allMappedAppearances = await Promise.all(allPromises) as (T | undefined)[]
    return allMappedAppearances.filter((value: T | undefined): value is T => (Boolean(value)))
}
