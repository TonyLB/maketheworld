import React, { FunctionComponent, useContext, useMemo } from "react"
import { useLibraryAsset } from "../../../Library/Edit/LibraryAsset";
import { isNormalMap } from "@tonylb/mtw-wml/dist/normalize/baseClasses";

type MapEditContextType = {
    mapId: string;
    topLevelRooms: { key: string; name: string }[]
}

const MapEditContext = React.createContext<MapEditContextType>({ mapId: '', topLevelRooms: [] })
export const useMapEditContext = () => (useContext(MapEditContext))

export const MapEditController: FunctionComponent<{ mapId: string }> = ({ children, mapId }) => {
    const { normalForm } = useLibraryAsset()
    const topLevelRooms = useMemo<{ key: string; name: string }[]>(() => {
        const mapItem = normalForm[mapId]
        if (mapItem && isNormalMap(mapItem)) {
            return mapItem.appearances.map<{ key: string; name: string }[]>(
                ({ rooms }) => (
                    rooms
                        .filter(({ conditions }) => (conditions.length === 0))
                        .map(({ key }) => ({
                            key,
                            name: ''
                        }))
                )
            ).flat(1)
        }
        else {
            return []
        }
    }, [normalForm])

    return <MapEditContext.Provider value={{ mapId, topLevelRooms }}>{ children }</MapEditContext.Provider>
}

export default MapEditController
