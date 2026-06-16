import type { EphemeraCharacterId, EphemeraMapId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export type EmptyMapSnapshot = {
    characterId: EphemeraCharacterId
    maps: []
}

/**
 * Server map runtime is intentionally unimplemented pending a full redesign.
 *
 * Steady-state contract:
 * - SubscribeToMaps ack returns empty snapshots via {@link emptyMapSnapshotForCharacter}.
 * - Move-time MapUpdate is not emitted from navigate orchestration.
 * - Map render and graph-based map discovery throw {@link MAP_SERVER_RENDER_RETIRED}.
 *
 * See [`AGENT.md`](./AGENT.md).
 */
export const MAP_SERVER_RENDER_RETIRED = 'MAP_SERVER_RENDER_RETIRED' as const

export const mapServerRenderRetiredMessage = (mapId?: string): string => (
    mapId
        ? `${MAP_SERVER_RENDER_RETIRED}: server map render is retired (${mapId}); see lambda/ephemera/dataSource/maps/AGENT.md`
        : `${MAP_SERVER_RENDER_RETIRED}: server map render is retired; see lambda/ephemera/dataSource/maps/AGENT.md`
)

/** Hard stub: callers must not assemble legacy map render output. */
export function assertMapServerRenderRetired(mapId?: EphemeraMapId | string): never {
    throw new Error(mapServerRenderRetiredMessage(mapId))
}

/**
 * Subscribe succeeds and returns an empty map snapshot payload.
 */
export const emptyMapSnapshotForCharacter = (characterId: EphemeraCharacterId): EmptyMapSnapshot => ({
    characterId,
    maps: []
})
