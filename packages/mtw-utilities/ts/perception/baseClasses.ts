export type ConditionExpression = {
    if: string;
}

export type RoomExit = {
    name: string;
    to: string;             // The asset-local key of the room target
    toEphemeraId: string;   // The globalized key of the room target (e.g. 'VORTEX', not 'ROOM#VORTEX')
}

export type RoomCacheItem = {
    EphemeraId: string;
    name: string[];
    exits: RoomExit[];
}

export type RoomCache = Record<string, RoomCacheItem>
