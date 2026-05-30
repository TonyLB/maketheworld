import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { tagFromEphemeraId } from '@tonylb/mtw-utilities/ts/graphStorage/cache'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import {
    buildReferencedByPatchesForAsset,
    collectReferencedTargetsInAsset,
    type PersistedReferencedByEntry,
} from '@tonylb/mtw-gateways/ts/assets/components/componentData/referencedBy'

export type ReferencedByPatchResult = {
    patchedTargetIds: ComponentUUID[]
    roomIdsForTopology: ComponentUUID[]
}

const isRoomId = (universalKey: ComponentUUID): boolean => universalKey.startsWith('ROOM#')

export const targetsNeedingInverseReconcile = (
    dbAsset: StandardForm,
    fileAsset: StandardForm
): ComponentUUID[] => {
    const targets = new Set<ComponentUUID>([
        ...collectReferencedTargetsInAsset(dbAsset),
        ...collectReferencedTargetsInAsset(fileAsset),
    ])
    return [...targets]
}

export const applyReferencedByPatchesForAsset = async ({
    assetUUID,
    assetId,
    fileAsset,
    targetUniversalKeys,
}: {
    assetUUID: AssetUUID
    assetId: string
    fileAsset: StandardForm
    targetUniversalKeys: ComponentUUID[]
}): Promise<ReferencedByPatchResult> => {
    const patches = buildReferencedByPatchesForAsset(fileAsset)
    const patchedTargetIds: ComponentUUID[] = []

    await Promise.all(
        targetUniversalKeys.map(async (targetUniversalKey) => {
            const referencedBy = patches.get(targetUniversalKey) ?? []
            const existing = await assetDB.getItem<Record<string, unknown>>({
                Key: {
                    AssetId: targetUniversalKey,
                    DataCategory: assetUUID,
                },
            })

            const fileComponent = fileAsset._lookup(targetUniversalKey)
            if (existing && (existing as { AssetId?: string }).AssetId) {
                const { referencedBy: _prior, ...body } = existing
                await assetDB.putItem({
                    ...body,
                    referencedBy,
                    AssetId: targetUniversalKey,
                    DataCategory: assetUUID,
                })
                patchedTargetIds.push(targetUniversalKey)
                return
            }

            if (referencedBy.length === 0) {
                return
            }

            if (fileComponent) {
                await assetDB.putItem({
                    ...(fileComponent.toJSON()),
                    referencedBy,
                    AssetId: targetUniversalKey,
                    DataCategory: assetUUID,
                })
                patchedTargetIds.push(targetUniversalKey)
                return
            }

            const tag = tagFromEphemeraId(targetUniversalKey)
            await Promise.all([
                assetDB.putItem({
                    tag,
                    universalKey: targetUniversalKey,
                    referencedBy,
                    AssetId: targetUniversalKey,
                    DataCategory: assetUUID,
                }),
                assetDB.optimisticUpdate({
                    Key: {
                        AssetId: targetUniversalKey,
                        DataCategory: `Meta::${tag}`,
                    },
                    updateKeys: ['cached'],
                    updateReducer: (draft) => {
                        if (!('cached' in draft)) {
                            draft.cached = []
                        }
                        if (!draft.cached.includes(assetId)) {
                            draft.cached = [...draft.cached, assetId]
                        }
                    },
                }),
            ])
            patchedTargetIds.push(targetUniversalKey)
        })
    )

    return {
        patchedTargetIds,
        roomIdsForTopology: patchedTargetIds.filter(isRoomId),
    }
}

export const clearReferencedByForDecache = async ({
    assetUUID,
    assetId,
    dbAsset,
}: {
    assetUUID: AssetUUID
    assetId: string
    dbAsset: StandardForm
}): Promise<ReferencedByPatchResult> => {
    const localId = assetUUID.replace(/^ASSET#/, '')
    const emptyAsset = new StandardForm(`<Asset uuid=(${localId}) />`)
    const targets = targetsNeedingInverseReconcile(dbAsset, emptyAsset)
    return applyReferencedByPatchesForAsset({
        assetUUID,
        assetId,
        fileAsset: emptyAsset,
        targetUniversalKeys: targets,
    })
}
