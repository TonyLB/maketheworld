import {
    NormalForm,
    NormalReference,
    isNormalCondition
} from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { EphemeraCondition } from "./baseClasses"

export const conditionsFromContext = (normal: NormalForm) => (contextStack: NormalReference[]): EphemeraCondition[] => (
    contextStack
        .filter(({ tag }) => (tag === 'Condition'))
        .map(({ key }) => (normal[key]))
        .filter(isNormalCondition)
        .map((condition) => ({
            dependencies: condition.dependencies,
            if: condition.if
        }))
)
