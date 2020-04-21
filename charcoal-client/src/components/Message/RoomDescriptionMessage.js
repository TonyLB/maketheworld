import React, { useState, useEffect } from 'react'

import { useDispatch, useSelector } from 'react-redux'

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

import { getNeighborhoodsByAncestry } from '../../selectors/permanentHeaders'
import { moveCharacter } from '../../actions/behaviors/moveCharacter'
import { fetchAndOpenRoomDialog } from '../../actions/permanentAdmin'
import RecapMessage from './RecapMessage'
import AnnouncementMessage from './AnnouncementMessage'

export const RoomDescriptionMessage = ({ message, inline=false, mostRecent=false, ...rest }) => {
    const [{ detailsOpen, timeoutId, manuallyOpened }, setDetailStatus] = useState({ detailsOpen: true, timeoutId: null, manuallyOpened: false })

    useEffect(() => {
        if (inline && detailsOpen && !manuallyOpened) {
            if (!timeoutId) {
                setDetailStatus({
                    detailsOpen: true,
                    timeoutId: setTimeout(() => {
                        setDetailStatus({ detailOpen: false, timeoutId: null })}, 10000)
                })
            }
        }
        if (!detailsOpen && timeoutId) {
            clearTimeout(timeoutId)
            setDetailStatus({ detailOpen: false, timeoutId: null})
        }
    }, [detailsOpen, inline, timeoutId, manuallyOpened])

    const classes = useStyles()
    const { RoomId='', Name='', Exits=[], Players=[], Recap=[], Description='', Ancestry='' } = message

    const dispatch = useDispatch()
    const neighborhoods = useSelector(getNeighborhoodsByAncestry(Ancestry)).reverse()
    const clickHandler = mostRecent ? ({ RoomId, ExitName }) => () => { dispatch(moveCharacter({ RoomId, ExitName })) } : () => () => {}
    return <React.Fragment>
        <ListItem className={ classes.roomMessage } alignItems="flex-start" {...rest} >
            <ListItemIcon>
                <HouseIcon />
            </ListItemIcon>
            <ListItemText>
                <Typography variant='h5' align='left'>
                    { Name }
                    {
                        !inline &&
                            neighborhoods.map(({ name, description }) => (
                                <React.Fragment key={`Neighborhood-${name}`}>
                                    &nbsp;&nbsp;:&nbsp;&nbsp;
                                    <Tooltip
                                        key={`Neighborhood-${name}`}
                                        interactive
                                        arrow
                                        title={
                                            <React.Fragment>
                                                <Typography variant='subtitle1' align='center'>
                                                    {name}
                                                </Typography>
                                                {description}
                                            </React.Fragment>
                                        }
                                    >
                                        <span>{name}</span>
                                    </Tooltip>
                                </React.Fragment>
                            ))
                    }
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
                                    onClick={clickHandler({ RoomId: exit.RoomId, ExitName: exit.Name })}
                                />
                            ))}
                        </Grid>
                        <Grid item md>
                            <Typography variant='subtitle1' align='center'>
                                Characters:
                            </Typography>
                            { Players
                                .map(({
                                    CharacterId,
                                    Name,
                                    Pronouns,
                                    FirstImpression,
                                    OneCoolThing,
                                    Outfit,
                                    color
                                }) => {
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
                            : <ExpandMoreIcon onClick={() => { setDetailStatus({ timeoutId, detailsOpen: !detailsOpen, manuallyOpened: true })}} />
                        : <CreateIcon onClick={() => { dispatch(fetchAndOpenRoomDialog(RoomId)) }} />
                }
            </ListItemSecondaryAction>
        </ListItem>
        {
            detailsOpen && [...Recap]
                .sort(({ CreatedTime: CreatedTimeA }, { CreatedTime: CreatedTimeB}) => (CreatedTimeA - CreatedTimeB))
                .map(({ MessageId, Type, ...rest }) => (Type === "ANNOUNCEMENT"
                    ? <AnnouncementMessage key={MessageId} Message={rest.Message} Title={rest.Title} Recap />
                    : <RecapMessage key={MessageId} message={{ MessageId, ...rest }} />
                ))
        }
    </React.Fragment>
}

export default RoomDescriptionMessage