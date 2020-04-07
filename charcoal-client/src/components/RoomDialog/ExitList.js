// Foundational imports (React, Redux, etc.)
import React from 'react'
import { useSelector } from 'react-redux'

// MaterialUI imports
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField
} from '@material-ui/core'
import DeleteForeverIcon from '@material-ui/icons/DeleteForever'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import HouseIcon from '@material-ui/icons/House'

// Local code imports
import useStyles from '../styles'
import { getPermanentHeaders } from '../../selectors/permanentHeaders.js'


export const ExitList = ({ paths=[], nameHandler=()=>{}, deleteHandler=()=>{} }) => {
    const classes = useStyles()
    const permanentHeaders = useSelector(getPermanentHeaders)
    return <TableContainer>
        <Table className={classes.table}>
            <TableHead>
                <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>To/From</TableCell>
                    <TableCell>Neighborhood</TableCell>
                    <TableCell align="right">Room</TableCell>
                    <TableCell align="right" />
                </TableRow>
            </TableHead>
            <TableBody>
                { paths.map(({
                        name,
                        id,
                        type,
                        roomId
                    }) => {
                        const roomData = (permanentHeaders && permanentHeaders[roomId]) || {}
                        const { name: roomName = '', parentId = '' } = roomData
                        const { name: roomParentName = '' } = (permanentHeaders && permanentHeaders[parentId]) || {}
                        return <TableRow key={`${type}:${roomId}`}>
                            <TableCell>
                                <TextField
                                    required
                                    value={name}
                                    onChange={nameHandler({ type, roomId })}
                                    className={classes.pathTextField}
                                />
                            </TableCell>
                            <TableCell>
                                { type === 'EXIT' && <ArrowForwardIcon /> }
                                { type === 'ENTRY' && <ArrowBackIcon /> }
                                <HouseIcon />
                            </TableCell>
                            <TableCell>{roomParentName}</TableCell>
                            <TableCell align="right">{roomName}</TableCell>
                            <TableCell align="right">
                                <DeleteForeverIcon onClick={deleteHandler(type, roomId)} />
                            </TableCell>
                        </TableRow>
                    })
                }
            </TableBody>
        </Table>
    </TableContainer>
}

export default ExitList