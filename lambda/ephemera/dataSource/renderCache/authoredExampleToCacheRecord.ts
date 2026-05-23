import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { AuthoredExample } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import type { EphemeraSituationId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

import type { PutCacheRecordInput } from './putCacheRecord'

export type AuthoredExampleToCacheRecordParams = {
    example: AuthoredExample;
    perspective: Perspective;
    perspectiveKey: string;
};

/**
 * Map gateway AuthoredExample DTO to renderCache put input (no blueprint merge).
 */
export function authoredExampleToCacheRecord(
    params: AuthoredExampleToCacheRecordParams
): PutCacheRecordInput {
    const { example, perspective, perspectiveKey } = params
    return {
        markState: example.markState,
        renderedContent: example.renderedContent,
        provenance: example.provenance,
        situationId: example.situationId as EphemeraSituationId,
        perspectiveId: perspectiveKey,
        perspectiveMatcher: {
            requiredAssetIds: [...perspective.assetStack] as AssetUUID[],
            forbiddenAssetIds: [],
        },
    }
}
