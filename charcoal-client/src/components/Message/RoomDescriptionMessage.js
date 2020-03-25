import React, { useState, useEffect } from 'react'

import { useSelector, useDispatch } from 'react-redux'

import {
    Typography,
    Grid,
    Chip,
    Divider,
    ListItem,
    ListItemText,
    ListItemIcon,
    ListItemSecondaryAction
} from '@material-ui/core'
import HouseIcon from '@material-ui/icons/House'
import ExpandLessIcon from '@material-ui/icons/ExpandLess'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import CreateIcon from '@material-ui/icons/Create'

import useStyles from '../styles'

import { getColorMap } from '../../selectors/colorMap.js'
import { sendMessage } from '../../actions/messages.js'
import { activateRoomDialog } from '../../actions/UI/roomDialog'

export const RoomDescriptionMessage = ({ message, inline=false, mostRecent=false, ...rest }) => {
    const [{ detailsOpen, timeoutId }, setDetailStatus] = useState({ detailsOpen: true, timeoutId: null })

    useEffect(() => {
        if (inline && detailsOpen) {
            if (!timeoutId) {
                setDetailStatus({
                    detailsOpen: true,
                    timeoutId: setTimeout(() => {
                        setDetailStatus({ detailOpen: false, timeoutId: null })}, 5000)
                })
            }
        }
        if (!detailsOpen && timeoutId) {
            clearTimeout(timeoutId)
            setDetailStatus({ detailOpen: false, timeoutId: null})
        }
    }, [detailsOpen, inline, timeoutId])

    const colorMap = useSelector(getColorMap)
    const classes = useStyles()
    const { name='', exits=[], players=[], description='' } = message

    const dispatch = useDispatch()
    const clickHandler = mostRecent ? (exitName) => () => { dispatch(sendMessage(exitName)) } : () => () => {}
    return <ListItem className={ classes.roomMessage } alignItems="flex-start" {...rest} >
        <ListItemIcon>
            <HouseIcon />
        </ListItemIcon>
        <ListItemText>
            <Typography variant='h5' align='left'>
                { name }
            </Typography>
            <Typography variant='body1' align='left'>
                { description }
            </Typography>
            { detailsOpen && <React.Fragment>
                <Divider />
                <Grid container>
                    <Grid item md>
                        <Typography variant='subtitle1' align='center'>
                            Exits:
                        </Typography>
                        { exits.map((exit) => (
                            <Chip
                                key={exit.exitName}
                                label={exit.exitName}
                                onClick={clickHandler(exit.exitName)}
                            />
                        ))}
                    </Grid>
                    <Grid item md>
                        <Typography variant='subtitle1' align='center'>
                            Players:
                        </Typography>
                        { players
                            .map(({ name }) => name)
                            .map((player) => {
                                const color = colorMap[player]
                                return <Chip
                                    key={player}
                                    label={player}
                                    classes={{
                                        root: classes[`chip-${color.primary}`]
                                    }}
                                />
                            })
                        }
                    </Grid>
                </Grid>
            </React.Fragment>}
        </ListItemText>
        <ListItemSecondaryAction>
            {
                inline
                    ? detailsOpen
                        ? <ExpandLessIcon onClick={() => { setDetailStatus({ timeoutId, detailsOpen: !detailsOpen })}} />
                        : <ExpandMoreIcon onClick={() => { setDetailStatus({ timeoutId, detailsOpen: !detailsOpen })}} />
                    : <CreateIcon onClick={() => { dispatch(activateRoomDialog(message)) }} />
            }
        </ListItemSecondaryAction>
    </ListItem>
}

export default RoomDescriptionMessage