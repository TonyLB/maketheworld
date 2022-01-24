import React from 'react'
import { useSelector } from 'react-redux'

import {
    Typography,
    Avatar,
    Tooltip,
    ListItem,
    ListItemText,
    ListItemAvatar,
    ListItemSecondaryAction,
    IconButton
} from '@mui/material'
import ReplyIcon from '@mui/icons-material/Reply'

import { getCharactersInPlay } from '../../slices/ephemera'
import { useActiveCharacter } from '../ActiveCharacter'
// import { activateDirectMessageDialog } from '../../actions/UI/directMessageDialog'
import CharacterStyleWrapper from '../CharacterStyleWrapper'

export const DirectMessage = React.forwardRef(({ message, ...rest }, ref) => {
    const { Recipients, CharacterId: FromCharacterId } = message
    const ToCharacterId = Recipients && Recipients[0]
    const { CharacterId: myCharacterId } = useActiveCharacter()
    const charactersInPlay = useSelector(getCharactersInPlay)
    const targetCharacterId = (FromCharacterId === myCharacterId) ? ToCharacterId : FromCharacterId
    const targetCharacter = charactersInPlay && charactersInPlay[targetCharacterId]
    const Name = charactersInPlay && charactersInPlay[FromCharacterId] && charactersInPlay[FromCharacterId].Name
    const replyCharacterId = (FromCharacterId === myCharacterId) ? (ToCharacterId === myCharacterId) ? null : ToCharacterId : FromCharacterId
    return (
        <CharacterStyleWrapper CharacterId={FromCharacterId} Name={Name}>
            <ListItem ref={ref} sx={{ bgcolor: 'extras.pale' }} alignItems="flex-start" {...rest} >
                <ListItemAvatar>
                    <Tooltip title={Name || '?'}>
                        <Avatar sx={{ bgcolor: 'palette.primary' }}>
                            { (Name && Name[0].toUpperCase()) || '?' }
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
                    { replyCharacterId && charactersInPlay[replyCharacterId].Connected &&
                        <IconButton
                            onClick={() => {
                                console.log(`Replying to ${replyCharacterId}`)
                                // dispatch(activateDirectMessageDialog(replyCharacterId))
                            } }
                            size="large">
                            <ReplyIcon />
                        </IconButton>
                    }
                </ListItemSecondaryAction>
            </ListItem>
        </CharacterStyleWrapper>
    );
})

export default DirectMessage