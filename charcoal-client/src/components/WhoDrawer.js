import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

import {
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Avatar
} from '@material-ui/core'

import { getActiveCharacterList } from '../slices/ephemera'
import { getPlayer } from '../slices/player'

import { activateDirectMessageDialog } from '../actions/UI/directMessageDialog'
import { useStyles } from './styles'

export const WhoDrawer = () => {

    const whoIsActive = useSelector(getActiveCharacterList)
    const { Characters } = useSelector(getPlayer)
    const myCharacterIds = Characters.map(({ CharacterId }) => (CharacterId))
    const classes = useStyles()
    const dispatch = useDispatch()

    return (
        <Table className={classes.whoTable} aria-label="who is online">
            <TableHead>
                <TableRow>
                    <TableCell />
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
                                    <Avatar className={(myCharacterIds.includes(CharacterId)) ? classes.blue : (color && classes[color.primary])}>
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
    )
}

export default WhoDrawer