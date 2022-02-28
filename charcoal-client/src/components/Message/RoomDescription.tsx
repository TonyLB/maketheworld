/** @jsxImportSource @emotion/react */
import React, { ReactChild, ReactChildren } from 'react'
import { useDispatch } from 'react-redux'
import { css } from '@emotion/react'

import {
    Box,
    Chip,
    Typography,
    Divider
} from '@mui/material'
import { blue } from '@mui/material/colors'
import HouseIcon from '@mui/icons-material/House'

import MessageComponent from './MessageComponent'
import {
    RoomDescription as RoomDescriptionType,
    RoomDescribeLink,
    RoomHeader as RoomHeaderType,
    RoomDescribePortion
} from '../../slices/messages/baseClasses'

import RoomExit from './RoomExit'
import RoomCharacter from './RoomCharacter'
import { socketDispatchPromise } from '../../slices/lifeLine'
import { useActiveCharacter } from '../ActiveCharacter'

interface LinkDescriptionProps {
    link: RoomDescribeLink
}

const LinkDescription = ({ link }: LinkDescriptionProps) => {
    const { CharacterId } = useActiveCharacter()
    const dispatch = useDispatch()
    return <Chip
            sx={{
                background: `linear-gradient(${blue[400]}, ${blue[600]})`,
                color: 'white'
            }}
            size="small"
            onClick={() => {
                dispatch(socketDispatchPromise('link')({
                    Action: link.toAction,
                    AssetId: link.toAssetId,
                    RoomId: link.RoomId,
                    CharacterId
                }))
            }}
            label={link.text}
        />
}

interface RoomDescriptionProps {
    message: RoomDescriptionType | RoomHeaderType;
    children?: ReactChild | ReactChildren;
}

const renderRoomDescriptionItem = (item: RoomDescribePortion, index: number) => {
    if (typeof item === 'string') {
        return item
    }
    switch(item.tag) {
        case 'Link':
            return <LinkDescription link={item} key={index} />
    }
}

export const RoomDescription = ({ message }: RoomDescriptionProps) => {
    const { Description, Name, Characters = [], Exits = [] } = message
    return <MessageComponent
            sx={{
                paddingTop: "10px",
                paddingBottom: "10px",
                background: `linear-gradient(${blue[700]} 30%, ${blue[900]})`,
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
                    { Description.map(renderRoomDescriptionItem) }
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
