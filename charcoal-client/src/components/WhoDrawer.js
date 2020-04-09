import React from 'react'
import { useSelector } from 'react-redux'

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
import { getColorMap } from '../selectors/colorMap'
import { getPermanentHeaders } from '../selectors/permanentHeaders'
import { useStyles } from './styles'

export const WhoDrawer = ({
    open = false,
    toggleOpen = () => {}
}) => {

    const whoIsActive = useSelector(getActiveCharacterList)
    const colorMap = useSelector(getColorMap)
    const classes = useStyles()
    const permanentHeaders = useSelector(getPermanentHeaders)

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
                        whoIsActive.map(({ CharacterId, Name, RoomId }) => {
                            const color = Name && colorMap && colorMap[Name]
                            const neighborhoodName = (permanentHeaders &&
                                RoomId &&
                                permanentHeaders[RoomId] &&
                                (
                                    (
                                        permanentHeaders[RoomId].parentId &&
                                        permanentHeaders[permanentHeaders[RoomId].parentId] &&
                                        permanentHeaders[permanentHeaders[RoomId].parentId].name
                                    ) ||
                                    permanentHeaders[RoomId].name
                                )) || '??????'
                            return (
                                <TableRow key={CharacterId}>
                                    <TableCell>
                                        <Avatar className={color && classes[color.primary]}>
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