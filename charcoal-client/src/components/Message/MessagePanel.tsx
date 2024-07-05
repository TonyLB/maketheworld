import React, { useCallback, useEffect, FunctionComponent } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Box } from '@mui/material'

import VirtualMessageList from './VirtualMessageList'
import { parseCommand } from '../../slices/lifeLine'
import LineEntry from '../LineEntry'
import { useActiveCharacter } from '../ActiveCharacter'
import useAutoPin from '../../slices/UI/navigationTabs/useAutoPin'
import { addItem, setIntent } from '../../slices/activeCharacters'
import { heartbeat } from '../../slices/stateSeekingMachine/ssmHeartbeat'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import { ParseCommandProps } from '../../slices/lifeLine/baseClasses'
import { addOnboardingComplete } from '../../slices/player/index.api'
import { OnboardingKey } from '../Onboarding/checkpoints'
import { getPlayer } from '../../slices/player'
import { useNavigate } from 'react-router-dom'

export const MessagePanel: FunctionComponent<{}> = () => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { CharacterId, info: { Name = '???' } = {}, scopedId } = useActiveCharacter()
    useAutoPin({
        href: `/Character/${scopedId}/Play`,
        label: `Play: ${Name}`,
        type: 'MessagePanel',
        scopedId,
        characterId: CharacterId
    })
    useOnboardingCheckpoint('navigatePlay')
    useOnboardingCheckpoint('navigateInPlayEdit', { requireSequence: true })
    useOnboardingCheckpoint('navigatePlayWithAsset', { requireSequence: true })
    useOnboardingCheckpoint('navigatePlayWithPersonalRoom', { requireSequence: true })
    useEffect(() => {
        dispatch(addItem({ key: CharacterId }))
        dispatch(setIntent({ key: CharacterId, intent: ['CONNECTED', 'MAPSUBSCRIBED']}))
        dispatch(heartbeat)
    }, [dispatch, CharacterId])
    const handleInput = useCallback(({ entry, mode }: { entry: string; mode: ParseCommandProps["mode"]}) => {
        const modeMapping: Record<ParseCommandProps["mode"], OnboardingKey> = {
            Command: 'commandMode',
            SayMessage: 'sayMode',
            NarrateMessage: 'narrateMode',
            OOCMessage: 'OOCMode'
        }
        if (mode in modeMapping) {
            dispatch(addOnboardingComplete([modeMapping[mode]]))
        }
        if (mode === 'Command' && entry.toLowerCase().trim() === 'map') {
            navigate(`/Character/${scopedId}/Map/`)
        }
        else {
            dispatch(parseCommand(CharacterId)({ entry, mode, raiseError: () => {} }))
        }
        return true
    }, [dispatch, CharacterId, scopedId, navigate])
    return <Box sx={{
            display: 'grid',
            height: '100%',
            position: 'relative',
            gridTemplateColumns: "1fr",
            gridTemplateRows: "1fr auto",
            gridTemplateAreas: `
                "messages"
                "input"
            `
        }}>
            <Box sx={{
                gridArea: 'messages',
                position: 'relative'
            }}>
                <VirtualMessageList />
            </Box>
            <Box sx={{
                gridArea: 'input',
                width: '100%'
            }}>
                <LineEntry callback={handleInput} />
            </Box>
        </Box>
}

export default MessagePanel
