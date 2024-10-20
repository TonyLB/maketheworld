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
import { getStatus } from '../../slices/personalAssets'
import { EphemeraActionId, EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import MiniChip from '../MiniChip'
import { useActiveCharacter } from '../ActiveCharacter'
import { socketDispatchPromise } from '../../slices/lifeLine'
import EditButton from './EditButton'

interface RoomDescriptionProps {
    message: RoomDescriptionType | RoomHeaderType;
    children?: ReactChild | ReactChildren;
    header?: boolean;
    currentHeader?: boolean;
}

export const RoomDescription = ({ message, header, currentHeader }: RoomDescriptionProps) => {
    const { Description, Name, Characters = [], Exits = [] } = message
    const { Assets } = useSelector(getPlayer)
    const status = useSelector(getStatus(`ASSET#draft`))
    const { CharacterId } = useActiveCharacter()
    const dispatch = useDispatch()
    const onClickLink: (to: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraActionId | EphemeraCharacterId) => void = useCallback((to) => {
        dispatch(socketDispatchPromise({
            message: 'link',
            to,
            CharacterId
        }))
    }, [dispatch, CharacterId])
    const currentAssets = useMemo(() => (message.assets || {}), [message])
    const inPersonalRoom = useMemo(() => (currentHeader && Boolean(Object.keys(currentAssets).map((assetId) => (assetId.split('#')[1])).find((key) => (Assets.map(({ AssetId }) => (AssetId)).includes(key))))), [currentHeader, Assets, currentAssets])
    const showEdit = useMemo(() => (currentAssets && ['FRESH', 'WMLDIRTY', 'SCHEMADIRTY'].includes(status || '')), [currentAssets, status])
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
                ? <EditButton tag="Room" assets={currentAssets} />
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
                                ? <TaggedMessageContent list={Description} onClickLink={onClickLink} />
                                : <em>No description</em>
                        }
                    </Box>
                    <Divider />
                </Box>
                <Box css={css`
                    grid-area: exits;
                `}>
                    { Exits.map((exit, index) => (<RoomExit exit={exit} key={ `${exit.RoomId}-${index}` } />))}
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
