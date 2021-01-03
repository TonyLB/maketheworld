import React from 'react'
import PropTypes from "prop-types"
import { useSelector } from 'react-redux'

import {
    ListItem,
    ListItemText,
    ListItemAvatar,
    Divider
} from '@material-ui/core'
import HouseIcon from '@material-ui/icons/House'

import { makeStyles } from "@material-ui/core/styles"

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
import RoomDescription from './RoomDescription'
import RoomName from './RoomName'
import RoomExit from './RoomExit'
import RoomCharacter from './RoomCharacter'
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


const useMessageStyles = makeStyles((theme) => ({
    roomDescriptionGrid: {
        display: 'grid',
        gridTemplateAreas: `
            "content content"
            "exits characters"
        `,
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "auto auto"
    },
    roomDescriptionContent: {
        gridArea: "content"
    },
    roomDescriptionExits: {
        gridArea: "exits"
    },
    roomDescriptionCharacters: {
        gridArea: "characters"
    }
}))

const filterChildren = (children, elementTypes) => (React.Children.map(children, (element) => ((element && elementTypes.includes(element.type)) ? element : null)))

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
    const roomDescription = childrenArray.find((element) => (element.type === RoomDescription))

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
    const localClasses = useMessageStyles()
    if (roomDescription) {
        return <div style={{ padding: '5px' }}>
            <ListItem
                className={classes.roomMessage}
                alignItems="flex-start"
                style={{ marginBottom: 0, marginTop: 0 }}
            >
                <ListItemAvatar><HouseIcon /></ListItemAvatar>
                <ListItemText
                    primary={<div className={localClasses.roomDescriptionGrid}>
                        <div className={localClasses.roomDescriptionContent}>
                            { filterChildren(children, [RoomDescription, RoomName]) }
                            <Divider />
                        </div>
                        <div className={localClasses.roomDescriptionExits}>
                            { filterChildren(children, [RoomExit]) }
                        </div>
                        <div className={localClasses.roomDescriptionCharacters}>
                            { filterChildren(children, [RoomCharacter]) }
                        </div>
                    </div>}
                />
            </ListItem>
        </div>
    }
    else {
        return <div className={classes[`player${viewColor}`]} style={{ padding: '5px' }}>
            <ListItem
                className={
                    roomDescription
                        ? classes.roomMessage
                        : messageThread ? `${classes.threadViewMessage} threadViewMessageColor` : `messageColor`
                }
                classes={{
                    ...(messageThread ? { root: viewAsSelf ? classes.threadViewSelf : classes.threadViewOther } : {})
                }}
                alignItems="flex-start"
                style={{ marginBottom: 0, marginTop: 0 }}
            >
                { roomDescription && <ListItemAvatar><HouseIcon /></ListItemAvatar>}
                { playerAvatar && <ListItemAvatar>{React.cloneElement(playerAvatar, { viewAsSelf, alreadyNested: true })}</ListItemAvatar>}
                <ListItemText
                    primary={<React.Fragment>
                        { React.Children.map(children, (element) => ((element && [MessageContent].includes(element.type)) ? element : null))}
                    </React.Fragment>}
                    secondary={<React.Fragment>
                        { React.Children.map(children, (element) => {
                            if (element && (element.type === MessageTime)) {
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
}

PolymorphicMessage.propTypes = {
    viewAsCharacterId: PropTypes.string
}

export default Message