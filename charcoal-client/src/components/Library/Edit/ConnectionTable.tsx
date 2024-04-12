import { FunctionComponent } from "react"
import SidebarTitle from "./SidebarTitle";
import { Checkbox, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material"

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
    return <SidebarTitle title={label} minHeight={minHeight}>
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell />
                    <TableCell>Key</TableCell>
                    <TableCell>Name</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {
                    possibleConnections.map(({ id, key, name }) => (
                        <TableRow key={id} hover>
                            <TableCell padding="checkbox">
                                <Checkbox
                                    color="primary"
                                    checked={false}
                                    inputProps={{
                                        'aria-label': 'select',
                                    }}
                                />
                            </TableCell>
                            <TableCell>{key}</TableCell>
                            <TableCell>{name}</TableCell>
                        </TableRow>
                    ))
                }
            </TableBody>
        </Table>
    </SidebarTitle>
}

export default ConnectionTable