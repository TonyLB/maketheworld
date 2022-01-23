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
import makeStyles from '@mui/styles/makeStyles';

import useStyles from '../../styles'

const useMapListStyles = makeStyles((theme) => ({
    table: {
        
    }
}))

type MapListRowProps = {
    key?: string;
    mapId: string;
}

const MapListRow: FunctionComponent<MapListRowProps>= ({
    mapId
}) => {
    // const classes = useStyles()
    // const localClasses = useMapListStyles()
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
    const classes = useStyles()
    const localClasses = useMapListStyles()

    return <Box className={classes.homeContents}>
        <div style={{ textAlign: "center" }}>
            <h2>My Drafts</h2>
            <Divider />
            <TableContainer component={Paper}>
                <Table className={localClasses.table}>
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
        </div>
    </Box>
}

export default MapList
