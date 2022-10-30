import { EphemeraComputedId, EphemeraVariableId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import internalCache from "../internalCache"

export const evaluateConditional = async (src: string, dependencies: Record<string, EphemeraVariableId | EphemeraComputedId>): Promise<boolean> => {
    return Boolean(await internalCache.EvaluateCode.get({
        source: src,
        mapping: dependencies
    }))
}
