import { FunctionComponent, useCallback, useMemo } from "react"
import SidebarTitle from "./SidebarTitle"
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid'
import { treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { isSchemaMap, isSchemaRoom } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { useLibraryAsset } from "./LibraryAsset";
import { StandardMap, StandardRoom, StandardTheme, isStandardMap, isStandardRoom, isStandardTheme } from "@tonylb/mtw-wml/dist/standardize/baseClasses";
import { schemaOutputToString } from "@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString";

type ConnectionTablePossibleConnection = {
    id: string;
    deleteId?: string;
    key: string;
    name: string;
    selected: boolean;
}

type ConnectionTableProps = {
    target: string;
    label: string;
    minHeight: string;
    tag: 'Room' | 'Map' | 'Theme';
    orientation: 'children' | 'parents';
}

//
// ConnectionTable accepts:
//  * A target key in the current library schema
//  * A tag type to filter the type of data-connections being shown
//  * An orientation (either showing children or showing parents)
//
// Depending upon direction, it will either display all possible parents for a given child, or all possible
// children for a given parent. It will display a checkmark for those records which already *are* associated
// with the target, and will respond to check and uncheck operations by updating the schema
//
export const ConnectionTable: FunctionComponent<ConnectionTableProps> = ({ label, minHeight, tag, target, orientation }) => {
    const columns: GridColDef[] = [
        { field: 'key', headerName: 'Key', width: 130 },
        { field: 'name', headerName: 'Name', width: 130 }
    ]
    const { updateSchema, standardForm } = useLibraryAsset()

    const targetTag = useMemo(() => (standardForm.byId[target]?.tag ?? 'None'), [standardForm, target])
    const currentConnections = useMemo((): ConnectionTablePossibleConnection[] => {
        if (orientation === 'children') {
            const component = standardForm.byId[target]
            if (component && isStandardTheme(component)) {
                if (tag === 'Room') {
                    return component.rooms
                        .filter(treeNodeTypeguard(isSchemaRoom))
                        .map(({ data, id }) => ({ originalId: id, key: data.key }))
                        .map(({ originalId, key }) => ({ originalId, component: standardForm.byId[key] }))
                        .filter(({ component }) => (component))
                        .filter((data): data is { originalId: string, component: StandardRoom } => (isStandardRoom(data.component)))
                        .map(({ originalId, component }) => ({ id: originalId, deleteId: originalId, name: schemaOutputToString(component.shortName.children) || 'Untitled', key: component.key, selected: true }))
                }
                if (tag === 'Map') {
                    return component.maps
                        .filter(treeNodeTypeguard(isSchemaMap))
                        .map(({ data, id }) => ({ originalId: id, key: data.key }))
                        .map(({ originalId, key }) => ({ originalId, component: standardForm.byId[key] }))
                        .filter(({ component }) => (component))
                        .filter((data): data is { originalId: string, component: StandardMap } => (isStandardMap(data.component)))
                        .map(({ originalId, component }) => ({ id: originalId, deleteId: originalId, name: schemaOutputToString(component.name.children) || 'Untitled', key: component.key, selected: true }))
                }
            }
            return []
        }
        //
        // TODO: Add calculation of currentConnections for parents orientation
        //
        return []
    }, [standardForm, tag, target, orientation])
    const possibleConnections = useMemo((): ConnectionTablePossibleConnection[] => {
        const rawConnections = Object.values(standardForm.byId).filter(({ tag: compareTag }) => (compareTag === tag))
        return rawConnections
            .filter((component): component is StandardRoom | StandardMap | StandardTheme => (isStandardRoom(component) || isStandardMap(component) || isStandardTheme(component)))
            .filter((component) => (!currentConnections.find(({ key }) => (component.key === key))))
            .map((component) => {
                if (isStandardRoom(component)) {
                    return { id: component.id, name: schemaOutputToString(component.shortName.children) || 'Untitled', key: component.key, selected: false }
                }
                else {
                    return { id: component.id, name: schemaOutputToString(component.name.children) || 'Untitled', key: component.key, selected: false }
                }
            })
    }, [standardForm, tag, currentConnections])
    const allConnections = useMemo(() => ([...currentConnections, ...possibleConnections]), [currentConnections, possibleConnections])
    const rowSelectionModel: GridRowSelectionModel = useMemo(() => {
        return allConnections.filter(({ selected }) => (selected)).map(({ id }) => (id))
    }, [allConnections])
    const setRowSelectionModel = useCallback((values: GridRowSelectionModel): void => {
        const addItems = allConnections.filter(({ id, selected }) => (!selected && values.includes(id)))
        const deleteItems = allConnections.filter(({ id, selected }) => (selected && !values.includes(id)))
        if (addItems.length + deleteItems.length === 0) {
            return
        }
        deleteItems.forEach(({ deleteId }) => {
            if (deleteId) {
                updateSchema({ type: 'delete', id: deleteId })
            }
        })
        const component = standardForm.byId[target]
        if (component && (isStandardRoom(component) || isStandardTheme(component) || isStandardMap(component))) {
            if (orientation === 'children') {
                addItems.forEach(({ key }) => {
                    updateSchema({ type: 'addChild', id: component.id, item: { data: { tag, key }, children: [] }})
                })
            }
            else {
                addItems.forEach(({ key }) => {
                    const parent = standardForm.byId[key]
                    if (parent) {
                        updateSchema({ type: 'addChild', id: parent.id, item: { data: { tag: component.tag, key: target }, children: [] }})
                    }
                })
            }
        }
    }, [allConnections, updateSchema, standardForm, tag, target, orientation])
    //
    // TODO: Create setRowSelectionModel callback that (a) deletes records as needed when unselected, (b) adds records as needed when selected
    //

    return <SidebarTitle title={label} minHeight={minHeight}>
        <DataGrid
            rows={allConnections}
            columns={columns}
            initialState={{
                pagination: {
                  paginationModel: { page: 0, pageSize: 5 },
                },
            }}
            rowSelectionModel={rowSelectionModel}
            onRowSelectionModelChange={setRowSelectionModel}
            pageSizeOptions={[5, 10, 25]}
            checkboxSelection
        />
    </SidebarTitle>
}

export default ConnectionTable