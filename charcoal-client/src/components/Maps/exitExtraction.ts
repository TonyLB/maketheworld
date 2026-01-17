import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardExitPlain, StandardExit } from "@tonylb/mtw-wml/ts/standardize/components/exit"
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
                .map(exitFacet => {
                    // Convert ExitFacet to StandardExitPlain for MapExit constructor
                    // MapExit expects StandardExitPlain, so we create one from the facet data
                    const exitData = {
                        to: exitFacet.reference.standardKey.toJSON(),
                        description: exitFacet.payload.toJSON()
                    }
                    const exitPlain = StandardExit.create(exitData)
                    if (!(exitPlain instanceof StandardExitPlain)) {
                        // If it's not plain (e.g., Remove/Replace), extract the plain payload
                        return exitPlain.plain ? new StandardExitPlain(exitPlain.plain.toJSON()) : null
                    }
                    return exitPlain
                })
                .filter((exit): exit is StandardExitPlain => exit !== null)
                .map(exit => new MapExit(exit, room.universalKey as `ROOM#${string}`))
        )
}
