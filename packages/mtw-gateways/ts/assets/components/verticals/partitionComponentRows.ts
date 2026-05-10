import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { isStandardNDJSONLine } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'

/**
 * Parse NDJSON component lines from a universal-key partition `Query` (`AssetId` = universal component id,
 * `DataCategory` = child asset id). Output feeds {@link deriveRawImportVerticalHopsFromComponents}.
 *
 * Matches assets lambda `syncImportVerticalPartition` / projector authoritative reads.
 */
export function componentRowsFromUniversalPartitionLines(
    rows: ReadonlyArray<StandardComponentData & { AssetId: string; DataCategory: string }>
): { childAssetId: string; component: StandardComponent }[] {
    return rows
        .filter(isStandardNDJSONLine)
        .map((line) => {
            const childAssetId = line.DataCategory as `ASSET#${string}`
            const { component } = standardComponentFactory(line)
            if (childAssetId && component) {
                return {
                    childAssetId,
                    component,
                }
            }
            return undefined
        })
        .filter(excludeUndefined)
}
