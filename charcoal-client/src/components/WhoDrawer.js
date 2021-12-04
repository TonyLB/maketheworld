import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

import {
    Paper,
    IconButton,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Avatar
} from '@material-ui/core'
import OpenArrowIcon from '@material-ui/icons/ChevronLeft'
import CloseArrowIcon from '@material-ui/icons/ChevronRight'

import { getActiveCharacterList } from '../selectors/charactersInPlay'
import { getCharacterId } from '../selectors/connection'
import { activateDirectMessageDialog } from '../actions/UI/directMessageDialog'
import { useStyles } from './styles'

export const WhoDrawer = ({
    open = false,
    toggleOpen = () => {}
}) => {

    const whoIsActive = useSelector(getActiveCharacterList)
    const myCharacterId = useSelector(getCharacterId)
    const classes = useStyles()
    const dispatch = useDispatch()

    return (
        <Paper
            className={ open ? classes.drawerOpen : classes.drawerClose }
        >
            <Table className={classes.whoTable} aria-label="who is online">
                <TableHead>
                    <TableRow>
                        <TableCell>
                            <IconButton
                                edge="end"
                                color="inherit"
                                aria-label="open drawer"
                                onClick={toggleOpen}
                            >
                                { open ? <CloseArrowIcon /> : <OpenArrowIcon /> }
                            </IconButton>
                        </TableCell>
                        <TableCell>Character</TableCell>
                        <TableCell>Neighborhood</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {
                        whoIsActive.map(({ CharacterId, Name, RoomId, color }) => {
                            //
                            // TODO: Figure out how to present a workable room/area name using the new WML Asset
                            // system.
                            //
                            const neighborhoodName = '??????'
                            return (
                                <TableRow key={CharacterId} hover onClick={() => { dispatch(activateDirectMessageDialog(CharacterId)) }}>
                                    <TableCell>
                                        <Avatar className={(myCharacterId === CharacterId) ? classes.blue : (color && classes[color.primary])}>
                                            { Name[0].toUpperCase() }
                                        </Avatar>
                                    </TableCell>
                                    <TableCell>{ Name.length > 20 ? `${Name.slice(0,17)}...` : Name }</TableCell>
                                    <TableCell>{ neighborhoodName }</TableCell>
                                </TableRow>
                            )
                        })
                    }
                </TableBody>
            </Table>
        </Paper>
    )
}

export default WhoDrawer