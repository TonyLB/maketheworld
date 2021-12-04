import React from 'react'

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
import ExitIcon from '@material-ui/icons/ExitToApp'
import HiddenIcon from '@material-ui/icons/VisibilityOff'

import useStyles from '../styles'

import { getCharactersInPlay } from '../../selectors/charactersInPlay'
import { getMyCurrentCharacter } from '../../selectors/myCharacters'
import { moveCharacter } from '../../actions/behaviors/moveCharacter'
import { setMessageOpen } from '../../actions/messages'
import RecapMessage from './RecapMessage'
import AnnouncementMessage from './AnnouncementMessage'

export const RoomDescriptionMessage = React.forwardRef(({ message, inline=false, mostRecent=false, ...rest }, ref) => {

    const classes = useStyles()
    const { MessageId, RoomId='', Name='', Exits=[], Players=[], Recap=[], Description='', Ancestry='', open=false } = message
    const ParentId = Ancestry.split('#').reverse()[0]

    const dispatch = useDispatch()
    const { CharacterId: myCharacterId, Grants } = useSelector(getMyCurrentCharacter)
    const charactersInPlay = useSelector(getCharactersInPlay)
    const clickHandler = mostRecent ? ({ RoomId, ExitName }) => () => { dispatch(moveCharacter({ RoomId, ExitName })) } : () => () => {}
    return <React.Fragment>
        <ListItem ref={ref} className={ classes.roomMessage } alignItems="flex-start" {...rest} >
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
                                icon={exit.Visibility === 'Public' ? <ExitIcon /> : <HiddenIcon /> }
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
                                Outfit
                            }) => {
                                const { color = { primary: 'blue' } } = (CharacterId !== myCharacterId) && charactersInPlay[CharacterId]
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
            </ListItemText>
            <ListItemSecondaryAction>
                {
                    inline
                        ? open
                            ? <ExpandLessIcon onClick={() => { dispatch(setMessageOpen({ MessageId, open: false })) }} />
                            : <ExpandMoreIcon onClick={() => { dispatch(setMessageOpen({ MessageId, open: true })) }} />
                        : null
                }
            </ListItemSecondaryAction>
        </ListItem>
        {
            open && [...Recap]
                .sort(({ CreatedTime: CreatedTimeA }, { CreatedTime: CreatedTimeB}) => (CreatedTimeA - CreatedTimeB))
                .map(({ MessageId, Type, ...rest }) => (Type === "ANNOUNCEMENT"
                    ? <AnnouncementMessage key={MessageId} Message={rest.Message} Title={rest.Title} Recap />
                    : <RecapMessage key={MessageId} message={{ MessageId, ...rest }} />
                ))
        }
    </React.Fragment>
})

export default RoomDescriptionMessage