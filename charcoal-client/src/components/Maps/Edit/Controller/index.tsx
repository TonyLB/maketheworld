import React, { FunctionComponent, useContext, useMemo, useState } from "react"
import { useLibraryAsset } from "../../../Library/Edit/LibraryAsset";
import { NormalForm, isNormalMap } from "@tonylb/mtw-wml/dist/normalize/baseClasses";
import { MapTreeRoom, ToolSelected } from "./baseClasses";
import Normalizer from "@tonylb/mtw-wml/dist/normalize";
import { SchemaRoomTag, isSchemaExit, isSchemaRoom } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses";

//
// extractMapTree takes a standardized normalizer, and a mapId, and generates a list of MapTreeItems
// representing the information needed to render the map in edit mode.
//
const extractMapTree = ({ normalizer, mapId }: { normalizer: Normalizer, mapId: string }): MapTreeRoom[] => {
    const mapItem = normalizer.normal[mapId]
    if (!mapItem || !isNormalMap(mapItem)) {
        return []
    }
    return mapItem.appearances.map<MapTreeRoom[][]>(
        ({ rooms }) => (
            rooms
                .filter(({ conditions }) => (conditions.length === 0))
                .map(({ key }) => {
                    const roomTag = normalizer.referenceToSchema({ key, tag: 'Room', index: 0 })
                    if (roomTag && isSchemaRoom(roomTag)) {
                        return [{
                            ...roomTag,
                            contents: roomTag.contents.filter((childItem) => (isSchemaExit(childItem)))
                        } as MapTreeRoom]
                    }
                    else {
                        return []
                    }
                })
        )
    ).flat(2)
}

type MapEditContextType = {
    mapId: string;
    topLevelRooms: SchemaRoomTag[];
    toolSelected: ToolSelected;
    setToolSelected: (value: ToolSelected) => void;
}

const MapEditContext = React.createContext<MapEditContextType>({ mapId: '', topLevelRooms: [], toolSelected: 'Select', setToolSelected: () => {} })
export const useMapEditContext = () => (useContext(MapEditContext))

export const MapEditController: FunctionComponent<{ mapId: string }> = ({ children, mapId }) => {
    const { normalForm } = useLibraryAsset()
    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    //
    // Generate a memo-fied standardizedNormalForm
    //
    const standardizedNormalizer = useMemo<Normalizer>(() => {
        const normalizer = new Normalizer()
        normalizer.loadNormal(normalForm)
        normalizer.standardize()
        return normalizer
    }, [normalForm])
    const topLevelRooms = useMemo<MapTreeRoom[]>(() => {
        return extractMapTree({ normalizer: standardizedNormalizer, mapId })
    }, [standardizedNormalizer, mapId])

    return <MapEditContext.Provider
            value={{
                mapId,
                topLevelRooms,
                toolSelected,
                setToolSelected
            }}
        >{ children }
    </MapEditContext.Provider>
}

export default MapEditController
