import React, { ReactChild, ReactChildren, useMemo, useCallback, ReactNode } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import {
    alpha,
    Box,
    Typography,
    Divider,
    Theme
} from '@mui/material'
import { blue, grey } from '@mui/material/colors'
import HouseIcon from '@mui/icons-material/House'

import MessageComponent from './MessageComponent'
import {
    PerceptionRoomMetaData,
} from '@tonylb/mtw-interfaces/ts/messages'

import RoomExit from './RoomExit'
import RoomCharacter from './RoomCharacter'
import RenderTreeContent from './RenderTreeContent'
import { getPlayer } from '../../slices/player'
import { EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import { useActiveCharacter } from '../ActiveCharacter'
import { socketDispatchPromise } from '../../slices/lifeLine'
import { StandardRender, PlainClass } from '@tonylb/mtw-wml/ts/standardize/render'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardExitFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/exit'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { SituationRoomFacetPayload } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { formatRoomContentsLine } from '../../slices/messages/roomHeaderPhaseC'

const roomShellSx = (live: boolean, header: boolean | undefined) => {
    const tint = live ? blue[200] : grey[200]
    return {
        paddingTop: '10px',
        paddingBottom: '10px',
        background: `linear-gradient(75deg, ${tint}, #ffffff)`,
        color: (theme: Theme) => theme.palette.getContrastText(tint),
        ...(header
            ? {
                marginLeft: 0,
                marginRight: 0
            }
            : {
                marginLeft: '70px',
                marginRight: '70px'
            }
        )
    }
}

interface RoomDescriptionProps {
    parsedWML?: StandardForm;
    metaData: PerceptionRoomMetaData;
    children?: ReactNode;
    header?: boolean;
    currentHeader?: boolean;
    isGenerating?: boolean;
}



export const RoomDescription = ({ parsedWML, metaData, header, currentHeader, isGenerating }: RoomDescriptionProps) => {
    const useLivePalette = Boolean(isGenerating || (header && currentHeader))
    const componentUUID = metaData.componentUUID

    // Initialize with proper types
    let name: StandardLiteral = new StandardLiteral('Untitled', { tag: 'DisplayName' })
    let description: StandardRender = new StandardRender([])
    let summary: StandardRender = new StandardRender([])
    let exits: StandardExitFacet[] = []
    let characters: StandardCharacter[] = []

    if (parsedWML) {
        // Extract from StandardForm
        const component = parsedWML.byUniversalId[componentUUID]
        
        if (component instanceof StandardRoom) {
            // Prefer ephemera `<Render>` (StandardRoom.render), then Situation facets, then defaults
            let prosePayload: SituationRoomFacetPayload | undefined
            if (component.render) {
                const fromRender = new SituationRoomFacetPayload(component.render)
                if (!SituationRoomFacetPayload.isEmpty(fromRender)) {
                    prosePayload = fromRender
                }
            }
            if (!prosePayload) {
                const firstSituationFacet = component.situations.items[0]
                if (firstSituationFacet) {
                    prosePayload = firstSituationFacet.payload as SituationRoomFacetPayload
                }
            }
            if (prosePayload) {
                name = prosePayload._displayName || new StandardLiteral('Untitled', { tag: 'DisplayName' })
                description = prosePayload._description || new StandardRender([])
                summary = prosePayload._summary || new StandardRender([])
            }
            
            // Extract character references from StandardRoom and resolve them to StandardCharacter instances
            characters = component.characters.payload
                .map(characterRef => {
                    const resolvedCharacter = parsedWML._lookup(characterRef.standardKey.toJSON())
                    return resolvedCharacter
                })
                .filter((character): character is StandardCharacter => character instanceof StandardCharacter)
            
            // Pass Standard format objects directly to sub-components
            exits = component.exits.items
        }
    }
    // Note: No legacy format handling - this component now only accepts PerceptionMessage

    const { Assets } = useSelector(getPlayer)
    const { CharacterId } = useActiveCharacter()
    const dispatch = useDispatch()
    const onClickLink: (to: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraCharacterId) => void = useCallback((to) => {
        dispatch(socketDispatchPromise({
            message: 'link',
            to,
            CharacterId
        }))
    }, [dispatch, CharacterId])
    
    // Extract asset data from parsed WML if available
    const currentAssets = useMemo(() => {
        if (parsedWML) {
            const component = parsedWML.byUniversalId[componentUUID]
            if (component instanceof StandardRoom) {
                return (component as any).assets || {}
            }
        }
        return {}
    }, [parsedWML, componentUUID])
    
    const inPersonalRoom = useMemo(() => (currentHeader && Boolean(Object.keys(currentAssets).map((assetId) => (assetId.split('#')[1])).find((key) => (Assets?.map(({ AssetId }) => (AssetId))?.includes(key) || false)))), [currentHeader, Assets, currentAssets])
    useOnboardingCheckpoint('navigatePersonalRoom', { requireSequence: true, condition: inPersonalRoom })

    const nameText = (name?._payload?.plain?.toJSON?.() as string) ?? 'Untitled'
    const contentsLine = header ? formatRoomContentsLine(parsedWML, componentUUID) : null

    if (isGenerating) {
        return (
            <Box data-live-palette='live' sx={{ width: '100%' }}>
                <MessageComponent
                    flush={header}
                    sx={roomShellSx(true, header)}
                    leftIcon={<HouseIcon />}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '6rem'
                        }}
                    >
                        <Typography variant='h5' align='center'>
                            Generating...
                        </Typography>
                    </Box>
                </MessageComponent>
            </Box>
        )
    }

    return (
        <Box
            data-live-palette={useLivePalette ? 'live' : 'historical'}
            sx={{ width: '100%' }}
        >
            <MessageComponent
                flush={header}
                sx={roomShellSx(useLivePalette, header)}
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
                            { nameText }
                        </Typography>
                        <Box sx={{ overflow: 'hidden' }}>
                            {
                                (() => {
                                    const plain = description.plain ?? []
                                    if (description && description._payload && !(description._payload instanceof PlainClass)) {
                                        console.error('Expected PlainClass but got', description._payload.constructor.name, description)
                                    }
                                    return plain.length > 0
                                        ? <RenderTreeContent list={plain} onClickLink={onClickLink} />
                                        : <em>No description</em>
                                })()
                            }
                        </Box>
                        {contentsLine && (
                            <Typography variant='body2' component='p' sx={{ marginTop: '8px' }}>
                                {contentsLine}
                            </Typography>
                        )}
                        <Divider
                            sx={{
                                borderColor: (theme) =>
                                    alpha(useLivePalette ? blue[400] : grey[500], theme.palette.mode === 'dark' ? 0.35 : 0.28)
                            }}
                        />
                    </Box>
                    <Box sx={{ gridArea: 'exits' }}>
                        { exits.map((exit, index) => (
                            <RoomExit 
                                exit={exit} 
                                key={`exit-${index}`} 
                            />
                        ))}
                    </Box>
                    <Box sx={{ gridArea: 'characters' }}>
                        { characters.map((character, index) => (
                            <RoomCharacter 
                                character={character} 
                                key={`character-${index}`} 
                            />
                        ))}
                    </Box>
                </Box>
            </MessageComponent>
        </Box>
    )
}

export default RoomDescription
