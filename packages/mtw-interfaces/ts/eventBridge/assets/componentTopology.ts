import { AssetUUID, ComponentUUID, isSchemaAssetUUID, isSchemaComponentUUID } from '@tonylb/mtw-base/ts/schema'

//
// Shared event contracts for the mtw.assets.componentTopology data source.
//

export type RoomScopedTopologyInvalidatedEvent = {
    type: 'TopologyInvalidated';
    roomIds: ComponentUUID[];
    editAssetId: AssetUUID;
    areaId?: ComponentUUID;
    edgeUuids?: ComponentUUID[];
}

export type AreaScopedTopologyInvalidatedEvent = {
    type: 'TopologyInvalidated';
    areaId: ComponentUUID;
    editAssetId: AssetUUID;
    edgeUuids?: ComponentUUID[];
}

export type ComponentTopologyInvalidatedEvent =
    | RoomScopedTopologyInvalidatedEvent
    | AreaScopedTopologyInvalidatedEvent

const isValidRoomIdList = (value: unknown): value is ComponentUUID[] => (
    Array.isArray(value)
    && value.length > 0
    && value.every((entry) => typeof entry === 'string' && isSchemaComponentUUID(entry))
)

const isValidOptionalUuidList = (value: unknown): value is ComponentUUID[] | undefined => (
    value === undefined
    || (
        Array.isArray(value)
        && value.every((entry) => typeof entry === 'string' && isSchemaComponentUUID(entry))
    )
)

export const isRoomScopedTopologyInvalidated = (
    event: unknown
): event is RoomScopedTopologyInvalidatedEvent => {
    if (!event || typeof event !== 'object') {
        return false
    }
    const record = event as Record<string, unknown>
    if (record.type !== 'TopologyInvalidated') {
        return false
    }
    if (!isValidRoomIdList(record.roomIds)) {
        return false
    }
    if (typeof record.editAssetId !== 'string' || !isSchemaAssetUUID(record.editAssetId)) {
        return false
    }
    if ('areaId' in record && record.areaId !== undefined) {
        if (typeof record.areaId !== 'string' || !isSchemaComponentUUID(record.areaId)) {
            return false
        }
    }
    if (!isValidOptionalUuidList(record.edgeUuids)) {
        return false
    }
    return true
}

export const isAreaScopedTopologyInvalidated = (
    event: unknown
): event is AreaScopedTopologyInvalidatedEvent => {
    if (!event || typeof event !== 'object') {
        return false
    }
    const record = event as Record<string, unknown>
    if (record.type !== 'TopologyInvalidated') {
        return false
    }
    if ('roomIds' in record) {
        return false
    }
    if (typeof record.areaId !== 'string' || !isSchemaComponentUUID(record.areaId)) {
        return false
    }
    if (typeof record.editAssetId !== 'string' || !isSchemaAssetUUID(record.editAssetId)) {
        return false
    }
    if (!isValidOptionalUuidList(record.edgeUuids)) {
        return false
    }
    return true
}

export const isTopologyInvalidatedEvent = (event: unknown): event is ComponentTopologyInvalidatedEvent => (
    isRoomScopedTopologyInvalidated(event) || isAreaScopedTopologyInvalidated(event)
)

export const isComponentTopologyEvent = (event: unknown): event is ComponentTopologyInvalidatedEvent => (
    isTopologyInvalidatedEvent(event)
)
