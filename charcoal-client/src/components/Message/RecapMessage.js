import React from 'react'
import { useSelector } from 'react-redux'

import {
    Typography,
    Avatar,
    Tooltip,
    ListItem,
    ListItemText,
    ListItemAvatar
} from '@material-ui/core'

import { getCharactersInPlay } from '../../selectors/charactersInPlay'
import { useActiveCharacter } from '../ActiveCharacter'
import useStyles from '../styles'

export const RecapMessage = React.forwardRef(({ message, ...rest }, ref) => {
    const CharacterId = message.FromCharacterId
    const { CharacterId: myCharacterId } = useActiveCharacter()
    const charactersInPlay = useSelector(getCharactersInPlay)
    const Name = CharacterId && charactersInPlay && charactersInPlay[CharacterId] && charactersInPlay[CharacterId].Name
    const color = CharacterId && (CharacterId === myCharacterId)
        ? { primary: 'blue', light: 'lightblue', recap: 'recapblue', recapLight: 'recapLightblue' }
        : (charactersInPlay && charactersInPlay[CharacterId] && charactersInPlay[CharacterId].color) || {}
    const classes = useStyles()
    return <ListItem ref={ref} className={ (color && classes[color.recapLight]) || classes['recap'] } alignItems="flex-start" {...rest} >
        { Name && <ListItemAvatar>
                <Tooltip title={Name}>
                    <Avatar className={color && classes[color.recap]}>
                        { Name[0].toUpperCase() }
                    </Avatar>
                </Tooltip>
            </ListItemAvatar>
        }
        <ListItemText inset={!Name}>
            <Typography variant='body1' align='left'>
                { message.Message }
            </Typography>
        </ListItemText>
    </ListItem>
})

export default RecapMessage