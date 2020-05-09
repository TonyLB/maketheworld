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
import useStyles from './styles'
import { getPermanentHeaders } from '../selectors/permanentHeaders.js'

export const ExitList = ({ role='Room', paths=[], nameHandler=()=>{}, deleteHandler=()=>{} }) => {
    const classes = useStyles()
    const permanentHeaders = useSelector(getPermanentHeaders)
    return <TableContainer>
        <Table className={classes.table}>
            <TableHead>
                <TableRow>
                    <TableCell>Name</TableCell>
                    {
                        (role === 'Neighborhood') && <TableCell>
                            Local Room
                        </TableCell>
                    }
                    <TableCell>To/From</TableCell>
                    <TableCell>Neighborhood</TableCell>
                    <TableCell align="right">Room</TableCell>
                    {
                        (role === 'Room') && <TableCell align="right" />
                    }
                </TableRow>
            </TableHead>
            <TableBody>
                { paths.map(({
                        Name,
                        type,
                        RoomId,
                        OriginId = ''
                    }) => {
                        const roomData = (permanentHeaders && permanentHeaders[RoomId]) || {}
                        const { Name: roomName = '', ParentId = '' } = roomData
                        const { Name: roomParentName = '' } = (permanentHeaders && permanentHeaders[ParentId]) || {}
                        const { Name: localName = '' } = (permanentHeaders && OriginId && permanentHeaders[OriginId]) || {}
                        return <TableRow key={`${type}:${RoomId}`}>
                            <TableCell>
                                {
                                    (role === 'Room' && <TextField
                                        required
                                        value={Name}
                                        onChange={nameHandler({ type, RoomId })}
                                        className={classes.pathTextField}
                                    />) || Name
                                }
                            </TableCell>
                            {
                                (role === 'Neighborhood') && <TableCell>
                                    {localName}
                                </TableCell>
                            }
                            <TableCell>
                                { type === 'EXIT' && <ArrowForwardIcon /> }
                                { type === 'ENTRY' && <ArrowBackIcon /> }
                                <HouseIcon />
                            </TableCell>
                            <TableCell>{roomParentName}</TableCell>
                            <TableCell align="right">{roomName}</TableCell>
                            {
                                (role === 'Room') && <TableCell align="right">
                                    <DeleteForeverIcon onClick={deleteHandler(type, RoomId)} />
                                </TableCell>
                            }
                        </TableRow>
                    })
                }
            </TableBody>
        </Table>
    </TableContainer>
}

export default ExitList