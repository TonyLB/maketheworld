import React, { ReactChild, ReactChildren, useMemo, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import {
    Box,
    Typography,
    Divider
} from '@mui/material'
import { blue } from '@mui/material/colors'
import HouseIcon from '@mui/icons-material/House'

import MessageComponent from './MessageComponent'
import {
    RoomDescription as RoomDescriptionType,
    RoomHeader as RoomHeaderType,
} from '@tonylb/mtw-interfaces/ts/messages'

import RoomExit from './RoomExit'
import RoomCharacter from './RoomCharacter'
import RenderTreeContent from './RenderTreeContent'
import { getPlayer } from '../../slices/player'
import { getStatus } from '../../slices/personalAssets'
import { EphemeraActionId, EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import MiniChip from '../MiniChip'
import { useActiveCharacter } from '../ActiveCharacter'
import { socketDispatchPromise } from '../../slices/lifeLine'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'

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
    const standardName = useMemo(() => {
        return Name ? new StandardRender(Name) : undefined
    }, [Name])

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
        >
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateAreas: `
                        "content content"
                        "exits characters"
                    `,
                    gridTemplateColumns: '1fr 1fr',
                    gridTemplateRows: 'auto auto'
                }}
            >
                <Box
                    sx={{
                        gridArea: 'content',
                        paddingBottom: '5px',
                        ...(header && {
                            maxHeight: '20vh',
                            overflow: 'hidden'
                        })
                    }}
                >
                    <Typography variant='h5' align='left'>
                        { standardName?.plainString ?? 'Untitled' }
                        { currentHeader && <MiniChip text="Live" /> }
                    </Typography>
                    <Box sx={{ overflow: 'hidden' }}>
                        {
                            Description.length
                                ? <RenderTreeContent list={Description} onClickLink={onClickLink} />
                                : <em>No description</em>
                        }
                    </Box>
                    <Divider />
                </Box>
                <Box sx={{ gridArea: 'exits' }}>
                    { Exits.map((exit, index) => (<RoomExit exit={exit} key={ `${exit.RoomId}-${index}` } />))}
                </Box>
                <Box sx={{ gridArea: 'characters' }}>
                    { Characters.map((character) => (<RoomCharacter character={character} key={character.CharacterId} />)) }
                </Box>
            </Box>
        </MessageComponent>
}

export default RoomDescription
