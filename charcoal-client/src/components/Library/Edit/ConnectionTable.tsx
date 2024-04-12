import { FunctionComponent } from "react"
import SidebarTitle from "./SidebarTitle"
import { DataGrid, GridColDef } from '@mui/x-data-grid'

type ConnectionTablePossibleConnection = {
    id: string;
    key: string;
    name: string;
}

type ConnectionTableProps = {
    label: string;
    minHeight: string;
    possibleConnections: ConnectionTablePossibleConnection[];
    select: (id: string) => void;
    unselect: (id: string) => void;
}

export const ConnectionTable: FunctionComponent<ConnectionTableProps> = ({ label, minHeight, possibleConnections }) => {
    const columns: GridColDef[] = [
        { field: 'key', headerName: 'Key', width: 130 },
        { field: 'name', headerName: 'Name', width: 130 }
    ];

    return <SidebarTitle title={label} minHeight={minHeight}>
        <DataGrid
            rows={[
                { id: 1, key: 'test', name: 'Test' }
            ]}
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