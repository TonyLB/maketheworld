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
    ListItemSecondaryAction,
    Tooltip
} from '@material-ui/core'
import HouseIcon from '@material-ui/icons/House'
import ExpandLessIcon from '@material-ui/icons/ExpandLess'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import CreateIcon from '@material-ui/icons/Create'

import useStyles from '../styles'

import { getColorMap } from '../../selectors/colorMap.js'
import { moveCharacter } from '../../actions/behaviors/moveCharacter'
import { fetchAndOpenRoomDialog } from '../../actions/permanentAdmin'
import { getCharactersInPlay } from '../../selectors/charactersInPlay'

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
    const charactersInPlay = useSelector(getCharactersInPlay)
    const classes = useStyles()
    const { RoomId='', Name='', Exits=[], Players=[], Description='' } = message

    const dispatch = useDispatch()
    const clickHandler = mostRecent ? (RoomId) => () => { dispatch(moveCharacter(RoomId)) } : () => () => {}
    return <ListItem className={ classes.roomMessage } alignItems="flex-start" {...rest} >
        <ListItemIcon>
            <HouseIcon />
        </ListItemIcon>
        <ListItemText>
            <Typography variant='h5' align='left'>
                { Name }
            </Typography>
            <Typography variant='body1' align='left'>
                { Description }
            </Typography>
            { detailsOpen && <React.Fragment>
                <Divider />
                <Grid container>
                    <Grid item md>
                        <Typography variant='subtitle1' align='center'>
                            Exits:
                        </Typography>
                        { Exits.map((exit) => (
                            <Chip
                                key={exit.Name}
                                label={exit.Name}
                                onClick={clickHandler(exit.RoomId)}
                            />
                        ))}
                    </Grid>
                    <Grid item md>
                        <Typography variant='subtitle1' align='center'>
                            Characters:
                        </Typography>
                        { Players
                            .map(({ CharacterId }) => {
                                const {
                                    Name = 'DEFAULT',
                                    Pronouns = '',
                                    FirstImpression = '',
                                    OneCoolThing = '',
                                    Outfit = ''
                                } = (charactersInPlay && charactersInPlay[CharacterId]) || {}
                                const color = colorMap[Name] || 'blue'
                                return (
                                    <Tooltip key={Name} interactive arrow title={<React.Fragment>
                                        <Typography variant='subtitle1' align='center'>
                                            {Name}
                                        </Typography>
                                        { Pronouns && <div>Pronouns: {Pronouns}</div> }
                                        { FirstImpression && <div>First Impression: {FirstImpression}</div> }
                                        { OneCoolThing && <div>One Cool Thing: {OneCoolThing}</div> }
                                        { Outfit && <div>Outfit: {Outfit}</div> }
                                    </React.Fragment>}>
                                        <Chip
                                            label={Name}
                                            classes={{
                                                root: classes[`chip-${color.primary}`]
                                            }}
                                        />
                                    </Tooltip>
                                )

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
                    : <CreateIcon onClick={() => { dispatch(fetchAndOpenRoomDialog(RoomId)) }} />
            }
        </ListItemSecondaryAction>
    </ListItem>
}

export default RoomDescriptionMessage