import React, { FunctionComponent } from 'react'

import {
    Switch,
    Route,
    Link,
    useRouteMatch,
    useHistory
} from "react-router-dom"

import Box from '@material-ui/core/Box'
import Divider from '@material-ui/core/Divider'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from "@material-ui/core/styles"

import useStyles from '../../styles'
import useAutoPin from '../../../slices/navigationTabs/useAutoPin'

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
    const classes = useStyles()
    const localClasses = useMapListStyles()
    const { url } = useRouteMatch()
    const history = useHistory()

    return <TableRow
        key={mapId}
        onClick={() => { history.push(`${url}Edit/${mapId}/`) }}
    >
        <TableCell>{mapId}</TableCell>
    </TableRow>
}

type MapListProps = {}

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
