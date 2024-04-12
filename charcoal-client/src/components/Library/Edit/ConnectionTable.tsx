import { FunctionComponent, useMemo } from "react"
import SidebarTitle from "./SidebarTitle"
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { useLibraryAsset } from "./LibraryAsset";
import { StandardMap, StandardRoom, StandardTheme, isStandardMap, isStandardRoom, isStandardTheme } from "@tonylb/mtw-wml/dist/standardize/baseClasses";
import { schemaOutputToString } from "@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString";

type ConnectionTablePossibleConnection = {
    id: string;
    key: string;
    name: string;
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
export const ConnectionTable: FunctionComponent<ConnectionTableProps> = ({ label, minHeight, tag }) => {
    const columns: GridColDef[] = [
        { field: 'key', headerName: 'Key', width: 130 },
        { field: 'name', headerName: 'Name', width: 130 }
    ]
    const { updateSchema, standardForm } = useLibraryAsset()
    const possibleConnections = useMemo((): ConnectionTablePossibleConnection[] => {
        const rawConnections = Object.values(standardForm.byId).filter(({ tag: compareTag }) => (compareTag === tag))
        return rawConnections
            .filter((component): component is StandardRoom | StandardMap | StandardTheme => (isStandardRoom(component) || isStandardMap(component) || isStandardTheme(component)))
            .map((component) => {
                if (isStandardRoom(component)) {
                    return { id: component.id, name: schemaOutputToString(component.shortName.children) || 'Untitled', key: component.key }
                }
                else {
                    return { id: component.id, name: schemaOutputToString(component.name.children) || 'Untitled', key: component.key }
                }
            })
    }, [standardForm, tag])

    return <SidebarTitle title={label} minHeight={minHeight}>
        <DataGrid
            rows={possibleConnections}
            columns={columns}
            initialState={{
                pagination: {
                  paginationModel: { page: 0, pageSize: 5 },
                },
            }}
            pageSizeOptions={[5, 10, 25]}
            checkboxSelection
        />
    </SidebarTitle>
}

export default ConnectionTable