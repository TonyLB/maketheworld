/** @jsxImportSource @emotion/react */
import React, { FunctionComponent, ReactChild, ReactChildren, useMemo, useCallback, useRef, useState } from 'react'
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
import { addOnboardingComplete } from '../../slices/player/index.api'
import { useNextOnboarding, useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import MiniChip from '../MiniChip'

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
    const importOptions = useMemo(() => {
        if (Object.entries(assets).length > 1) {
            return Object.entries(assets)
                .filter(([asset]) => (asset !== 'ASSET#primitives'))
                .map(([asset, key]) => ({ asset: asset as EphemeraAssetId, key }))
        }
        else {
            return Object.entries(assets)
                .map(([asset, key]) => ({ asset: asset as EphemeraAssetId, key }))
        }
    }, [assets])
    const onImportListItemClick = useCallback(({ asset, key }: { asset: EphemeraAssetId, key: string }) => {
        dispatch(addOnboardingComplete(['importRoom']))
        dispatch(addImport({ assetId: `ASSET#${currentDraft}`, fromAsset: asset.split('#')[1], type: 'Room', key }))
        navigate(`/Library/Edit/Asset/${currentDraft}/Room/${key}`)
    }, [navigate])
    const onClick = useCallback(() => {
        if (importOptions.length > 1) {
            setOpen(true)
        }
        else {
            if (importOptions.length) {
                onImportListItemClick(importOptions[0])
            }
        }
    }, [importOptions, setOpen, onImportListItemClick])
    return <React.Fragment>
        <Chip
            label="Edit"
            onClick={onClick}
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
                    importOptions.map(({ asset, key }) => (
                        <ListItem key={`Import-${asset}`} >
                            <ListItemButton
                                onClick={() => { onImportListItemClick({ asset, key }) }}
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

export const RoomDescription = ({ message, header, currentHeader }: RoomDescriptionProps) => {
    const { Description, Name, Characters = [], Exits = [] } = message
    const { currentDraft, Assets } = useSelector(getPlayer)
    const status = useSelector(getStatus(`ASSET#${currentDraft || ''}`))
    const currentAssets = useMemo(() => (message.assets || {}), [message])
    const inPersonalRoom = useMemo(() => (currentHeader && Boolean(Object.keys(currentAssets).map((assetId) => (assetId.split('#')[1])).find((key) => (Assets.map(({ AssetId }) => (AssetId)).includes(key))))), [currentHeader, Assets, currentAssets])
    const showEdit = useMemo(() => (currentAssets && ['FRESH', 'WMLDIRTY', 'NORMALDIRTY'].includes(status || '')), [currentAssets, status])
    useOnboardingCheckpoint('navigatePersonalRoom', { requireSequence: true, condition: inPersonalRoom })

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
                    ${ header
                        ? `
                            max-height: 20vh;
                            overflow: hidden;
                        `
                        : ''
                    }
                `}>
                    <Typography variant='h5' align='left'>
                        { Name.filter(isTaggedText).length ? Name.filter(isTaggedText).map(({ value }) => (value)).join('') : 'Untitled' }
                        { currentHeader && <MiniChip text="Live" /> }
                    </Typography>
                    <Box sx={{ overflow: 'hidden' }}>
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
