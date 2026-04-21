import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { DiagnosticsEphemeraRenderCacheFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { isEphemeraId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import internalCache from '../internalCache'
import { AssetsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'

type StreamEventFn = (params: { update: AssetsEventUpdate; streamKey: string; header: { type: string } }) => Promise<void>

const roomHasSituations = (room: StandardRoom): boolean => Boolean(room.situations?.items?.length)

const dedupe = <T extends string>(items: T[]): T[] => Array.from(new Set(items))

const resolveRoomIdsFromPerspective = async (perspective: AssetUUID[]): Promise<ComponentUUID[]> => {
    const assetData = await internalCache.AssetData.get(perspective)
    const rooms = assetData.flatMap(({ standardForm }) => (
        standardForm._components
            .filter((component): component is StandardRoom => component instanceof StandardRoom)
            .filter(roomHasSituations)
            .map(({ universalKey }) => universalKey as ComponentUUID)
    ))
    return dedupe(rooms)
}

const resolveRoomByAsset = (
    roomByAssets: { AssetId: AssetUUID; component: unknown }[],
    perspective: AssetUUID[]
): { room?: StandardRoom; streamAssetId?: AssetUUID } => {
    for (let index = perspective.length - 1; index >= 0; index--) {
        const assetId = perspective[index]
        const match = roomByAssets.find(({ AssetId, component }) => (
            AssetId === assetId && component instanceof StandardRoom
        ))
        if (match) {
            return { room: match.component as StandardRoom, streamAssetId: assetId }
        }
    }
    const fallback = roomByAssets.find(({ component }) => component instanceof StandardRoom)
    if (!fallback) {
        return {}
    }
    return { room: fallback.component as StandardRoom, streamAssetId: fallback.AssetId }
}

export const reseedComponentExamplesFromDiagnostics = async (
    finding: DiagnosticsEphemeraRenderCacheFindingEvent,
    streamEvent: StreamEventFn
): Promise<void> => {
    const perspective = dedupe(finding.perspective)
    if (!perspective.length) {
        return
    }
    const scopedRoomIds = dedupe((finding.roomIds ?? []).filter(isEphemeraRoomId))
    const targetRoomIds = scopedRoomIds.length ? scopedRoomIds : await resolveRoomIdsFromPerspective(perspective)
    for (const roomId of targetRoomIds) {
        if (!isEphemeraId(roomId)) {
            continue
        }
        const [roomData] = await internalCache.ComponentData.get([roomId])
        const roomByAssets = (roomData?.byAssets ?? []) as { AssetId: AssetUUID; component: unknown }[]
        const { room, streamAssetId } = resolveRoomByAsset(roomByAssets, perspective)
        if (!room || !streamAssetId || !roomHasSituations(room)) {
            continue
        }
        await streamEvent({
            update: {
                type: 'Component Updated',
                component: room
            } as AssetsEventUpdate,
            streamKey: streamAssetId,
            header: { type: 'Component Updated' }
        })
    }
}
