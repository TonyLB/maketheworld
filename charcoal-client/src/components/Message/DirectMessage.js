import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

import {
    Typography,
    Avatar,
    Tooltip,
    ListItem,
    ListItemText,
    ListItemAvatar,
    ListItemSecondaryAction,
    IconButton
} from '@material-ui/core'
import ReplyIcon from '@material-ui/icons/Reply'

import { getCharactersInPlay } from '../../selectors/charactersInPlay'
import { getCharacterId } from '../../selectors/connection'
import { activateDirectMessageDialog } from '../../actions/UI/directMessageDialog'
import useStyles from '../styles'

export const DirectMessage = ({ message, ...rest }) => {
    const { FromCharacterId, ToCharacterId } = message
    const myCharacterId = useSelector(getCharacterId)
    const charactersInPlay = useSelector(getCharactersInPlay)
    const targetCharacterId = (FromCharacterId === myCharacterId) ? ToCharacterId : FromCharacterId
    const targetCharacter = charactersInPlay && charactersInPlay[targetCharacterId]
    const Name = charactersInPlay && charactersInPlay[FromCharacterId] && charactersInPlay[FromCharacterId].Name
    const color = (FromCharacterId === myCharacterId) ? { primary: 'blue', light: 'lightblue', direct: 'directblue' } : (charactersInPlay && charactersInPlay[FromCharacterId] && charactersInPlay[FromCharacterId].color) || ''
    const replyCharacterId = (FromCharacterId === myCharacterId) ? (ToCharacterId === myCharacterId) ? null : ToCharacterId : FromCharacterId
    const classes = useStyles()
    const dispatch = useDispatch()
    return <ListItem className={ color && classes[color.direct] } alignItems="flex-start" {...rest} >
        <ListItemAvatar>
            <Tooltip title={Name}>
                <Avatar className={color && classes[color.primary]}>
                    { Name[0].toUpperCase() }
                </Avatar>
            </Tooltip>
        </ListItemAvatar>
        <ListItemText>
            <Typography variant='overline' align='left'>
                Direct message { FromCharacterId === myCharacterId ? 'to' : 'from'}: { (FromCharacterId === ToCharacterId) ? 'Yourself' : ((targetCharacter && targetCharacter.Name) || 'Someone') }
            </Typography>
            <Typography variant='body1' align='left'>
                { message.Message }
            </Typography>
        </ListItemText>
        <ListItemSecondaryAction>
            { replyCharacterId && charactersInPlay[replyCharacterId].ConnectionId &&
                <IconButton onClick={() => { dispatch(activateDirectMessageDialog(replyCharacterId)) } } >
                    <ReplyIcon />
                </IconButton>
            }
        </ListItemSecondaryAction>
    </ListItem>
}

export default DirectMessage