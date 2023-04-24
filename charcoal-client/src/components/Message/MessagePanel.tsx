import React, { useCallback, useEffect, FunctionComponent } from 'react'
import { useDispatch } from 'react-redux'
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

export const MessagePanel: FunctionComponent<{}> = () => {
    const dispatch = useDispatch()
    const { CharacterId, info: { Name = '???' } = {} } = useActiveCharacter()
    useAutoPin({
        href: `/Character/${CharacterId.split('#')[1]}/Play`,
        label: `Play: ${Name}`,
        type: 'MessagePanel',
        characterId: CharacterId
    })
    useOnboardingCheckpoint('navigatePlay')
    useEffect(() => {
        dispatch(addItem({ key: CharacterId }))
        dispatch(setIntent({ key: CharacterId, intent: ['CONNECTED', 'MAPSUBSCRIBED']}))
        dispatch(heartbeat)
    }, [dispatch, CharacterId])
    const handleInput = useCallback(({ entry, mode }: { entry: string; mode: ParseCommandProps["mode"]}) => {
        switch(mode) {
            case 'Command':
                dispatch(addOnboardingComplete(['commandMode']))
                break
        }
        dispatch(parseCommand(CharacterId)({ entry, mode, raiseError: () => {} }))
        return true
    }, [dispatch, CharacterId])
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
