import AssetWorkspace from "@tonylb/mtw-asset-workspace/dist"
import {
    NormalForm,
    NormalReference,
    isNormalCondition
} from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { EphemeraCondition } from "./baseClasses"

export const conditionsFromContext = (assetWorkspace: AssetWorkspace) => (contextStack: NormalReference[]): EphemeraCondition[] => (
    contextStack
        .filter(({ tag }) => (tag === 'If'))
        .map(({ key }) => ((assetWorkspace.normal || {})[key]))
        .filter(isNormalCondition)
        .map((condition) => ({
            dependencies: condition.dependencies
                .map((key) => ({
                    key,
                    EphemeraId: (assetWorkspace.namespaceIdToDB[key] || '')
                })),
            if: condition.if
        }))
)
