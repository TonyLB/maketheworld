import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { MapExit } from "./Controller/baseClasses"
import { StandardMap } from "@tonylb/mtw-wml/ts/standardize/components/map"
import { StandardRoom } from "@tonylb/mtw-wml/ts/standardize/components/room"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"

/**
 * Extracts exit information from a StandardForm for a specific map
 * @param standardForm - The StandardForm containing map data
 * @param mapId - The universal key of the map to extract exits from
 * @returns Array of MapExit objects representing all relevant exits in the map
 */
export const extractExitsFromStandardForm = (
    standardForm: StandardForm, 
    mapId: `MAP#${string}`
): MapExit[] => {
    // Get the map component
    const mapComponent = standardForm.byUniversalId[mapId]
    if (!mapComponent || !(mapComponent instanceof StandardMap)) {
        return []
    }

    // Create a set of room IDs that have positions in the map for fast lookup
    const positionedRoomIds = new Set(
        mapComponent.positions.items
            .map(facet => facet.reference.universalKey)
            .filter((roomId): roomId is ComponentUUID => roomId !== undefined)
    )

    // Extract all exits from all rooms in the map
    return mapComponent.positions.items
        .map(facet => facet.reference.universalKey)
        .filter((roomId): roomId is ComponentUUID => roomId !== undefined)
        .map(roomId => standardForm.byUniversalId[roomId])
        .filter((roomComponent): roomComponent is StandardRoom => 
            roomComponent instanceof StandardRoom
        )
        .flatMap(room => 
            room.exits.items
                .filter(exitFacet => {
                    // Only include exits whose target rooms have positions in the map
                    const targetRoomId = exitFacet.reference.universalKey
                    return targetRoomId && positionedRoomIds.has(targetRoomId)
                })
                .map(exitFacet => new MapExit(exitFacet, room.universalKey as `ROOM#${string}`))
        )
}
