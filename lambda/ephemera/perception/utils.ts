import { EphemeraComputedId, EphemeraVariableId, isEphemeraComputedId, isEphemeraVariableId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { TaggedConditionalItemDependency } from "@tonylb/mtw-interfaces/dist/messages"
import internalCache from "../internalCache"

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
