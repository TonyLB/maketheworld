import React from 'react'
import PropTypes from "prop-types"
import { useSelector } from 'react-redux'

import {
    ListItem,
    ListItemText,
    ListItemAvatar
} from '@material-ui/core'

import useStyles from '../styles'

import {
    playerMessage,
    directMessage,
    roomDescription,
    announcementMessage,
    neighborhoodDescription
} from '../../store/messages'
import PlayerMessage from './PlayerMessage'
import DirectMessage from './DirectMessage'
import WorldMessage from './WorldMessage'
import RoomDescriptionMessage from './RoomDescriptionMessage'
import NeighborhoodDescriptionMessage from './NeighborhoodDescriptionMessage'
import AnnouncementMessage from './AnnouncementMessage'

import { getCharactersInPlay } from '../../selectors/charactersInPlay'

import CharacterAvatar from '../CharacterAvatar'
import MessageContent from './MessageContent'
import MessageThread from './MessageThread'
import MessageTime from './MessageTime'

export const Message = React.forwardRef(({ message, ...rest }, ref) => {
    if (message instanceof playerMessage) {
        return <PlayerMessage ref={ref} message={message} {...rest} />
    }
    else if (message instanceof roomDescription) {
        return <RoomDescriptionMessage inline ref={ref} message={message} {...rest} />
    }
    else if (message instanceof neighborhoodDescription) {
        return <NeighborhoodDescriptionMessage ref={ref} message={message} {...rest} />
    }
    else if (message instanceof announcementMessage) {
        return <AnnouncementMessage ref={ref} Message={message.Message} Title={message.Title} {...rest} />
    }
    else if (message instanceof directMessage) {
        return <DirectMessage ref={ref} message={message} {...rest} />
    }
    return <WorldMessage ref={ref} message={message} {...rest} />
})

//
// PolymorphicMessage is a polymorphic component that interrogates its
// children to derive its presentation.  This is not *really* React best
// practices, but it gives the benefit of semantic structures where there
// otherwise was just a tangle of passed properties, and it allows Virtuoso
// to use the component as a direct top-level element configured by the
// information passed from the itemContents render function
//
// PolymorphicMessage pays attention to the following children types:
//   * <PlayerAvatar>, from which it extracts CharacterId to style in the
//     correct color for the character authoring the message
//   * <MessageThread>, to tell whether it is an in-play or threaded
//     message
//
// ... and then arranges the following components specially:
//   * <PlayerAvatar> is placed within a ListItemAvatar wrapper
//   * <MessageContent> is placed with ListItemText
//   * <MessageTime> is placed in ListItemText secondary text
//
export const PolymorphicMessage = ({ viewAsCharacterId=null, children=[], ...rest }) => {
    //
    // Pull out necessary arguments from children
    //
    const childrenArray = React.Children.toArray(children)
    const playerAvatar = childrenArray.find((element) => (element.type === CharacterAvatar))
    const messageThread = childrenArray.find((element) => (element.type === MessageThread))

    //
    // Pull out Character information if any
    //
    const CharacterId = (playerAvatar && playerAvatar.props.CharacterId)
    const viewAsSelf = CharacterId === viewAsCharacterId
    const charactersInPlay = useSelector(getCharactersInPlay)
    const color = (CharacterId === viewAsCharacterId) ? 'blue' : (charactersInPlay[CharacterId]?.color?.primary ?? 'grey')
    const viewColor = `${color.charAt(0).toUpperCase()}${color.slice(1)}`
    const { Name = '??????' } = charactersInPlay[CharacterId]

    const classes = useStyles()
    return <div className={classes[`player${viewColor}`]}>
        <ListItem
            className={messageThread ? `${classes.threadViewMessage} threadViewMessageColor` : `messageColor`}
            classes={{
                ...(messageThread ? { root: viewAsSelf ? classes.threadViewSelf : classes.threadViewOther } : {})
            }}
            alignItems="flex-start"
        >
            { CharacterId && <ListItemAvatar>
                { React.Children.map(children, (element) => ((element.type === CharacterAvatar)
                    ? React.cloneElement(element, { alreadyNested: true, viewAsSelf })
                    : null
                ))}
            </ListItemAvatar>}
            <ListItemText
                primary={<React.Fragment>
                    { React.Children.map(children, (element) => ((element.type === MessageContent) ? element : null))}
                </React.Fragment>}
                secondary={<React.Fragment>
                    { React.Children.map(children, (element) => {
                        if (element.type === MessageTime) {
                            const timeString = new Date(element.props.time ?? 0).toLocaleString()
                            return `${Name} at ${timeString}`
                        }
                        return null
                    })}
                </React.Fragment>}
            />
        </ListItem>
    </div>
}

PolymorphicMessage.propTypes = {
    viewAsCharacterId: PropTypes.string
}

export default Message