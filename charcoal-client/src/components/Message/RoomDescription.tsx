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
    PerceptionRoomMetaData,
} from '@tonylb/mtw-interfaces/ts/messages'

import RoomExit from './RoomExit'
import RoomCharacter from './RoomCharacter'
import RenderTreeContent from './RenderTreeContent'
import { getPlayer } from '../../slices/player'
import { EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
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
    parsedWML?: StandardForm;
    metaData: PerceptionRoomMetaData;
    children?: ReactChild | ReactChildren;
    header?: boolean;
    currentHeader?: boolean;
}



export const RoomDescription = ({ parsedWML, metaData, header, currentHeader }: RoomDescriptionProps) => {
    const componentUUID = metaData.componentUUID

    // Initialize with proper types
    let name: StandardRender = new StandardRender(['Untitled'])
    let description: StandardRender = new StandardRender([])
    let summary: StandardRender = new StandardRender([])
    let exits: StandardExit[] = []
    let characters: StandardCharacter[] = []

    if (parsedWML) {
        // Extract from StandardForm
        const component = parsedWML.byUniversalId[componentUUID]
        
        if (component instanceof StandardRoom) {
            // Extract room data from Standard format structure - handle missing examples gracefully
            const firstExampleRef = component.examples.payload[0]
            if (firstExampleRef) {
                const firstExample = parsedWML._lookup(firstExampleRef.plain().standardKey.toJSON())
                
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
                    const resolvedCharacter = parsedWML._lookup(characterRef.plain().standardKey.toJSON())
                    return resolvedCharacter
                })
                .filter((character): character is StandardCharacter => character instanceof StandardCharacter)
            
            // Pass Standard format objects directly to sub-components
            exits = component.exits  // Pass StandardExit instances directly
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
