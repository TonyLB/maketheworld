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
    PerceptionMessage,
} from '@tonylb/mtw-interfaces/ts/messages'

import RoomExit from './RoomExit'
import RoomCharacter from './RoomCharacter'
import RenderTreeContent from './RenderTreeContent'
import { getPlayer } from '../../slices/player'
import { getStatus } from '../../slices/personalAssets'
import { EphemeraActionId, EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import MiniChip from '../MiniChip'
import { useActiveCharacter } from '../ActiveCharacter'
import { socketDispatchPromise } from '../../slices/lifeLine'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardExample } from '@tonylb/mtw-wml/ts/standardize/components/example'
import { StandardExit } from '@tonylb/mtw-wml/ts/standardize/components/exit'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardCharacterData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/character'

interface RoomDescriptionProps {
    message: RoomDescriptionType | RoomHeaderType | (PerceptionMessage & { parsedWML?: StandardForm });
    children?: ReactChild | ReactChildren;
    header?: boolean;
    currentHeader?: boolean;
    // New Standard format properties
    parsedWML?: StandardForm;
    componentUUID?: ComponentUUID;
}

// Legacy data conversion functions
const createStandardExitFromLegacy = (legacyExit: any): StandardExit => {
    // Create StandardExit instance from legacy data
    const exitData = {
        to: legacyExit.RoomId,  // Convert EphemeraRoomId to reference
        description: legacyExit.Name  // Convert string name to StandardLiteral
    }
    
    return new StandardExit(exitData)
}

const createStandardCharacterFromLegacy = (legacyCharacter: any): StandardCharacter => {
    // Create StandardCharacter instance from legacy data
    const characterData: StandardCharacterData = {
        tag: 'Character',
        universalKey: legacyCharacter.CharacterId,  // Set the universalKey from CharacterId
        name: legacyCharacter.Name ? [legacyCharacter.Name] : undefined,  // Convert string to RenderTree array
        shortName: legacyCharacter.Name,  // Use name as shortName
        pronouns: undefined,  // Legacy doesn't have pronouns
        image: legacyCharacter.fileURL ? { data: { tag: 'Image', key: '', fileURL: legacyCharacter.fileURL }, children: [] } : undefined
    }
    
    return new StandardCharacter(characterData)
}

export const RoomDescription = ({ message, header, currentHeader, parsedWML, componentUUID }: RoomDescriptionProps) => {
    // Initialize with proper types
    let name: StandardRender = new StandardRender(['Untitled'])
    let description: StandardRender = new StandardRender([])
    let summary: StandardRender = new StandardRender([])
    let exits: StandardExit[] = []
    let characters: StandardCharacter[] = []
    let legacyMessage: RoomDescriptionType | RoomHeaderType | null = null

    if (parsedWML && componentUUID) {
        // Standard format: extract from StandardForm
        const component = parsedWML.byUniversalId[componentUUID]
        
        if (component instanceof StandardRoom) {
            // Extract room data from Standard format structure - handle missing examples gracefully
            const firstExampleRef = component.examples.payload[0]
            if (firstExampleRef) {
                const firstExample = parsedWML._lookup(firstExampleRef.plain().toJSON())
                
                if (firstExample && firstExample.universalKey) {
                    const exampleComponent = parsedWML.byUniversalId[firstExample.universalKey as any]
                    
                    if (exampleComponent instanceof StandardExample) {
                        // StandardExample properties now return StandardRender objects directly
                        name = exampleComponent.name || new StandardRender(['Untitled'])
                        description = exampleComponent.description || new StandardRender([])
                        summary = exampleComponent.summary || new StandardRender([])
                    }
                }
            }
            
            // Extract character references from StandardRoom and resolve them to StandardCharacter instances
            characters = component.characters.payload
                .map(characterRef => {
                    const resolvedCharacter = parsedWML._lookup(characterRef.plain().toJSON())
                    return resolvedCharacter
                })
                .filter((character): character is StandardCharacter => character instanceof StandardCharacter)
            
            // Pass Standard format objects directly to sub-components
            exits = component.exits  // Pass StandardExit instances directly
        }
    } else {
        // Legacy format: extract from message
        legacyMessage = message as RoomDescriptionType | RoomHeaderType
        name = new StandardRender(legacyMessage.Name || ['Untitled'])
        description = new StandardRender(legacyMessage.Description || [])
        summary = new StandardRender(legacyMessage.Summary || [])
        // Convert legacy data to Standard format for sub-components
        exits = legacyMessage.Exits?.map(legacyExit => createStandardExitFromLegacy(legacyExit)) || []
        characters = legacyMessage.Characters?.map(legacyCharacter => createStandardCharacterFromLegacy(legacyCharacter)) || []
    }

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
    
    // Use legacy message for asset data if available
    const currentAssets = useMemo(() => (legacyMessage?.assets || {}), [legacyMessage])
    const inPersonalRoom = useMemo(() => (currentHeader && Boolean(Object.keys(currentAssets).map((assetId) => (assetId.split('#')[1])).find((key) => (Assets?.map(({ AssetId }) => (AssetId))?.includes(key) || false)))), [currentHeader, Assets, currentAssets])
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
                        { name.plainString ?? 'Untitled' }
                        { currentHeader && <MiniChip text="Live" /> }
                    </Typography>
                    <Box sx={{ overflow: 'hidden' }}>
                        {
                            description.toJSON().length
                                ? <RenderTreeContent list={description.toJSON()} onClickLink={onClickLink} />
                                : <em>No description</em>
                        }
                    </Box>
                    <Divider />
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
}

export default RoomDescription
