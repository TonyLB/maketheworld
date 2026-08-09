import React, { useCallback, useEffect, FunctionComponent, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Box, IconButton } from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'

import VirtualMessageList from './VirtualMessageList'
import { parseCommand } from '../../slices/lifeLine'
import LineEntry from '../LineEntry'
import { useActiveCharacter } from '../ActiveCharacter'
import { addItem, setIntent } from '../../slices/activeCharacters'
import { heartbeat } from '../../slices/stateSeekingMachine/ssmHeartbeat'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import { ParseCommandProps } from '../../slices/lifeLine/baseClasses'
import { addOnboardingComplete } from '../../slices/player/index.api'
import { OnboardingKey } from '../Onboarding/checkpoints'
import { getPlayer } from '../../slices/player'
import { openWorkbench } from '../../slices/UI/workbench'
import { openThinkingDashboard } from '../../slices/UI/thinkingDashboard'
import { putClientSettings } from '../../slices/settings'
import { setForceCharacterSelection } from '../../slices/UI/playSpine'

export const MessagePanel: FunctionComponent<{}> = () => {
    const dispatch = useDispatch()
    const { CharacterId } = useActiveCharacter()
    // Removed useAutoPin - tab navigation removed
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
        // Development-only: Magic word "edit" to open workbench for testing
        // TODO: Remove when Phase 3 entry ritual is implemented
        if (mode === 'Command' && entry.toLowerCase().trim() === 'edit') {
            dispatch(openWorkbench())
        }
        else if (mode === 'Command' && entry.toLowerCase().trim() === '/dashboard') {
            dispatch(openThinkingDashboard())
        }
        else {
            dispatch(parseCommand(CharacterId)({ entry, mode, raiseError: () => {} }))
        }
        return true
    }, [dispatch, CharacterId])
    return (
        <>
            <Box sx={{
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
                    <IconButton
                        onClick={() => {
                            // Set flag to indicate user-initiated character selection
                            // This ensures modal is shown even if only one option exists
                            dispatch(putClientSettings({ currentCharacterId: null }))
                            dispatch(setForceCharacterSelection(true))
                        }}
                        sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 1000,
                            backgroundColor: 'background.paper',
                            '&:hover': {
                                backgroundColor: 'action.hover'
                            }
                        }}
                        title="Switch Character"
                    >
                        <PersonIcon />
                    </IconButton>
                    <VirtualMessageList />
                </Box>
                <Box sx={{
                    gridArea: 'input',
                    width: '100%'
                }}>
                    <LineEntry callback={handleInput} />
                </Box>
            </Box>
        </>
    )
}

export default MessagePanel
