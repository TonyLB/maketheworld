import React, { FunctionComponent } from 'react'

import {
    useNavigate
} from "react-router-dom"

import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'

type MapListRowProps = {
    key?: string;
    mapId: string;
}

const MapListRow: FunctionComponent<MapListRowProps>= ({
    mapId
}) => {
    const navigate = useNavigate()

    return <TableRow
        key={mapId}
        onClick={() => { navigate(`Edit/${mapId}/`) }}
    >
        <TableCell>{mapId}</TableCell>
    </TableRow>
}

// eslint-disable-next-line no-empty-pattern
type MapListProps = {}

// eslint-disable-next-line no-empty-pattern
export const MapList: FunctionComponent<MapListProps> = ({}) => {

    return <Box sx={{ flexGrow: 1, padding: 2 }}>
        <Box sx={{ textAlign: "center" }}>
            <h2>My Drafts</h2>
            <Divider />
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell align="left">Name</TableCell>
                            <TableCell align="right">References</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        { ['TestOne', 'TestTwo'].map((key) => (<MapListRow key={key} mapId={key} />)) }
                    </TableBody>
                </Table>

            </TableContainer>
        </Box>
    </Box>
}

export default MapList
