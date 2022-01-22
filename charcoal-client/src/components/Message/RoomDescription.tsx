import React, { ReactChild, ReactChildren } from 'react'

import {
    Typography,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Divider
} from '@material-ui/core'
import { makeStyles } from "@material-ui/core/styles"
import HouseIcon from '@material-ui/icons/House'

import { RoomDescription as RoomDescriptionType, RoomHeader as RoomHeaderType } from '../../slices/messages/baseClasses'

import RoomExit from './RoomExit'
import RoomCharacter from './RoomCharacter'

interface RoomDescriptionProps {
    message: RoomDescriptionType | RoomHeaderType;
    children?: ReactChild | ReactChildren;
}

const useRoomStyles = makeStyles((theme) => ({
    roomMessage: {
        color: theme.palette.getContrastText(theme.palette.primary.main),
        backgroundColor: theme.palette.primary.main,
    },
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

export const RoomDescription = ({ message, ...rest }: RoomDescriptionProps) => {
    const localClasses = useRoomStyles()
    const { Description, Name, RoomCharacters: Characters = [], Exits = [] } = message
    return <div style={{ padding: '5px' }}>
        <ListItem
            className={localClasses.roomMessage}
            alignItems="flex-start"
            style={{ marginBottom: 0, marginTop: 0 }}
        >
            <ListItemAvatar><HouseIcon /></ListItemAvatar>
            <ListItemText
                primary={<div className={localClasses.roomDescriptionGrid}>
                    <div className={localClasses.roomDescriptionContent}>
                        <Typography variant='h5' align='left'>
                            { Name }
                        </Typography>
                        { Description }
                        <Divider />
                    </div>
                    <div className={localClasses.roomDescriptionExits}>
                        { Exits.map((exit) => (<RoomExit exit={exit} key={ exit.RoomId } />))}
                    </div>
                    <div className={localClasses.roomDescriptionCharacters}>
                        { Characters.map((character) => (<RoomCharacter character={character} key={character.CharacterId} />)) }
                    </div>
                </div>}
            />
        </ListItem>
    </div>
}

export default RoomDescription
