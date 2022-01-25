/** @jsxImportSource @emotion/react */
import React, { ReactChild, ReactChildren } from 'react'
import { css } from '@emotion/react'

import {
    Box,
    Typography,
    Divider
} from '@mui/material'
import { blue } from '@mui/material/colors'
import HouseIcon from '@mui/icons-material/House'

import MessageComponent from './MessageComponent'
import { RoomDescription as RoomDescriptionType, RoomHeader as RoomHeaderType } from '../../slices/messages/baseClasses'

import RoomExit from './RoomExit'
import RoomCharacter from './RoomCharacter'

interface RoomDescriptionProps {
    message: RoomDescriptionType | RoomHeaderType;
    children?: ReactChild | ReactChildren;
}

export const RoomDescription = ({ message }: RoomDescriptionProps) => {
    const { Description, Name, Characters = [], Exits = [] } = message
    return <MessageComponent
            sx={{
                paddingTop: "10px",
                paddingBottom: "10px",
                bgcolor: blue[800],
                color: (theme) => (theme.palette.getContrastText(blue[800]))
            }}
            leftIcon={<HouseIcon />}
        >
            <Box css={css`
                display: grid;
                grid-template-areas:
                    "content content"
                    "exits characters"
                ;
                grid-template-columns: 1fr 1fr;
                grid-template-rows: auto auto;
            `}>
                <Box css={css`
                    grid-area: content;
                    padding-bottom: 5px;
                `}>
                    <Typography variant='h5' align='left'>
                        { Name }
                    </Typography>
                    { Description }
                    <Divider />
                </Box>
                <Box css={css`
                    grid-area: exits;
                `}>
                    { Exits.map((exit) => (<RoomExit exit={exit} key={ exit.RoomId } />))}
                </Box>
                <Box css={css`
                    grid-area: characters;
                `}>
                    { Characters.map((character) => (<RoomCharacter character={character} key={character.CharacterId} />)) }
                </Box>
            </Box>
        </MessageComponent>
}

export default RoomDescription
