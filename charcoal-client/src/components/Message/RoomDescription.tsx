/** @jsxImportSource @emotion/react */
import React, { FunctionComponent, ReactChild, ReactChildren, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { css } from '@emotion/react'

import {
    Box,
    Chip,
    Typography,
    Divider,
    Popover
} from '@mui/material'
import { blue } from '@mui/material/colors'
import HouseIcon from '@mui/icons-material/House'

import MessageComponent from './MessageComponent'
import {
    isTaggedText,
    RoomDescription as RoomDescriptionType,
    RoomHeader as RoomHeaderType,
} from '@tonylb/mtw-interfaces/dist/messages'

import RoomExit from './RoomExit'
import RoomCharacter from './RoomCharacter'
import TaggedMessageContent from './TaggedMessageContent'
import { getPlayer } from '../../slices/player'
import { addImport, getStatus } from '../../slices/personalAssets'
import { EphemeraAssetId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import ListItemButton from '@mui/material/ListItemButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import { useNavigate } from 'react-router-dom'

interface RoomDescriptionProps {
    message: RoomDescriptionType | RoomHeaderType;
    children?: ReactChild | ReactChildren;
    header?: boolean;
    currentHeader?: boolean;
}

const RoomEditButton: FunctionComponent<{ assets: Record<EphemeraAssetId, string> }> = ({ assets }) => {
    const navigate = useNavigate()
    const [open, setOpen] = useState<boolean>(false)
    const ref = useRef(null)
    const dispatch = useDispatch()
    const { currentDraft } = useSelector(getPlayer)
    return <React.Fragment>
        <Chip
            label="Edit"
            onClick={() => { setOpen(true) }}
            ref={ref}
        />
        <Popover
            open={open}
            onClose={() => { setOpen(false) }}
            anchorEl={ref.current}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
        >
            <Typography variant="body2">Branch from?</Typography>
            <Divider />
            <List>
                {
                    Object.entries(assets).map(([asset, key]) => (
                        <ListItem key={`Import-${asset}`} >
                            <ListItemButton
                                onClick={() => {
                                    dispatch(addImport({ assetId: `ASSET#${currentDraft}`, fromAsset: asset.split('#')[1], type: 'Room', key }))
                                    navigate(`/Library/Edit/Asset/${currentDraft}/Room/${key}`)
                                }}
                            >
                                { asset.split('#')[1] }
                            </ListItemButton>
                        </ListItem>
                    ))
                }
            </List>
        </Popover>
    </React.Fragment>
}

export const LiveRoomChip: FunctionComponent<{}> = () => {
    const linearGradient = (color: Record<string | number, string>, low: number, high: number) => `linear-gradient(${color[low]}, ${color[high]})`
    return <Box
        component="span"
        sx={{
            display: "inline-block",
            background: linearGradient(blue, 500, 700),
            color: "white",
            borderRadius: '200px',
            paddingTop: '0.125em',
            paddingBottom: '0.125em',
            paddingLeft: '0.35em',
            paddingRight: '0.35em',
            position: "relative",
            top: "-0.125em",
            marginLeft: "0.5em"
        }}
    >
        <Typography variant="body2">Live</Typography>
    </Box>
}

export const RoomDescription = ({ message, header, currentHeader }: RoomDescriptionProps) => {
    const { Description, Name, Characters = [], Exits = [] } = message
    const { currentDraft } = useSelector(getPlayer)
    const status = useSelector(getStatus(`ASSET#${currentDraft || ''}`))
    const currentAssets = useMemo(() => (message.assets || {}), [message])
    const showEdit = useMemo(() => (currentAssets && ['FRESH', 'WMLDIRTY', 'NORMALDIRTY'].includes(status || '')), [currentAssets, status])

    //
    // TODO: Make "Live" indicator to show the user which description is the current header (and gets updates)
    //
    // TODO: Change margins of non-header descriptions to visually distinguish them
    //
    return <MessageComponent
            sx={{
                paddingTop: "10px",
                paddingBottom: "10px",
                background: `linear-gradient(75deg, ${blue[200]}, #ffffff)`,
                color: (theme) => (theme.palette.getContrastText(blue[200])),
                ...(header
                    ? {}
                    : {
                        marginLeft: "70px",
                        marginRight: "70px"
                    }
                )
            }}
            leftIcon={<HouseIcon />}
            toolActions={showEdit
                ? <RoomEditButton assets={currentAssets} />
                : undefined
            }
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
                        { Name.filter(isTaggedText).length ? Name.filter(isTaggedText).map(({ value }) => (value)).join('') : 'Untitled' }
                        { currentHeader && <LiveRoomChip /> }
                    </Typography>
                    <Box sx={header ? {
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 4,
                        display: '-webkit-box',
                        overflow: 'hidden'
                    }: {}}>
                        {
                            Description.length
                                ? <TaggedMessageContent list={Description} />
                                : <em>No description</em>
                        }
                    </Box>
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
