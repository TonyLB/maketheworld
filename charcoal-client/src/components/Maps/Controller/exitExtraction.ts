import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardExit } from "@tonylb/mtw-wml/ts/standardize/components/exit"

/**
 * Extracts exit information from a StandardForm for a specific map
 * @param standardForm - The StandardForm containing map data
 * @param mapId - The universal key of the map to extract exits from
 * @returns Array of StandardExit objects representing all exits in the map
 */
export const extractExitsFromStandardForm = (
    standardForm: StandardForm, 
    mapId: `MAP#${string}`
): StandardExit[] => {
    // TODO: Implement exit extraction logic
    return []
}
