import React, { FunctionComponent, useContext, useMemo, useState } from "react"
import { useLibraryAsset } from "../../../Library/Edit/LibraryAsset"
import { isNormalMap } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { GenericTree  } from '@tonylb/mtw-sequence/dist/tree/baseClasses'
import { mergeTrees } from '@tonylb/mtw-sequence/dist/tree/merge'
import { MapTreeItem, ToolSelected } from "./baseClasses"
import Normalizer from "@tonylb/mtw-wml/dist/normalize"
import { isSchemaExit, isSchemaRoom } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses"
import { deepEqual } from "../../../../lib/objects"

//
// extractMapTree takes a standardized normalizer, and a mapId, and generates a generic tree of MapTreeItems
// representing the information needed to render the map in edit mode.
//
const extractMapTree = ({ normalizer, mapId }: { normalizer: Normalizer, mapId: string }): GenericTree<MapTreeItem> => {
    const mapItem = normalizer.normal[mapId]
    if (!mapItem || !isNormalMap(mapItem)) {
        return []
    }
    return mapItem.appearances.map<GenericTree<MapTreeItem>[]>(
        ({ rooms }) => (
            rooms
                .filter(({ conditions }) => (conditions.length === 0))
                .map(({ key }) => {
                    const roomTag = normalizer.referenceToSchema({ key, tag: 'Room', index: 0 })
                    if (roomTag && isSchemaRoom(roomTag)) {
                        return [{
                            data: roomTag,
                            children: roomTag.contents
                                .filter((childItem) => (isSchemaExit(childItem)))
                                .map((childItem) => ({ data: childItem, children: [] }))
                        }] as GenericTree<MapTreeItem>
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
    tree: GenericTree<MapTreeItem>;
    toolSelected: ToolSelected;
    setToolSelected: (value: ToolSelected) => void;
}

const MapEditContext = React.createContext<MapEditContextType>({ mapId: '', tree:[], toolSelected: 'Select', setToolSelected: () => {} })
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
    const tree = useMemo<GenericTree<MapTreeItem>>(() => {
        const mergeTreeOptions = {
            compare: (a: MapTreeItem, b: MapTreeItem) => (deepEqual(a, b)),
            extractProperties: (item: MapTreeItem): MapTreeItem | undefined => {
                return undefined
            },
            rehydrateProperties: (baseItem: MapTreeItem, properties: MapTreeItem[]) => (baseItem)
        }
        return mergeTrees(mergeTreeOptions)(
            extractMapTree({ normalizer: standardizedNormalizer, mapId })
        )
        }, [standardizedNormalizer, mapId])

    return <MapEditContext.Provider
            value={{
                mapId,
                toolSelected,
                setToolSelected,
                tree
            }}
        >{ children }
    </MapEditContext.Provider>
}

export default MapEditController
