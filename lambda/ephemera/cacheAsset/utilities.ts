import AssetWorkspace from "@tonylb/mtw-asset-workspace/dist"
import {
    NormalReference,
    isNormalCondition
} from "@tonylb/mtw-normal"
import { EphemeraCondition } from "./baseClasses"

export const conditionsFromContext = (assetWorkspace: AssetWorkspace) => (contextStack: NormalReference[]): EphemeraCondition[] => (
    contextStack
        .filter(({ tag }) => (tag === 'If'))
        .map(({ key }) => ((assetWorkspace.normal || {})[key]))
        .filter(isNormalCondition)
        .reduce<EphemeraCondition[]>((previous, condition) => ([
            ...previous,
            ...condition.conditions.map((statement) => ({
                dependencies: statement.dependencies
                    .map((key) => ({
                        key,
                        EphemeraId: (assetWorkspace.namespaceIdToDB[key] || '')
                    })),
                if: statement.if,
                not: statement.not
            }))
        ]), [])
)
