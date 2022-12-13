import React, { useState, FunctionComponent, ReactElement, useRef, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
    Avatar,
    Box,
    SpeedDial,
    SpeedDialAction,
    TextField
} from '@mui/material'
import { blue } from '@mui/material/colors'
import OptionsIcon from '@mui/icons-material/MoreHoriz'
import SayMessageIcon from '@mui/icons-material/Chat'
import NarrateMessageIcon from '@mui/icons-material/Receipt'
import OOCMessageIcon from '@mui/icons-material/CropFree'
import CommandIcon from '@mui/icons-material/Code'
import MapIcon from '@mui/icons-material/Explore'

import {
    // getServerSettings,
    getClientSettings
} from '../../slices/settings'
import { CharacterColorWrapper } from '../CharacterStyleWrapper'
import { useActiveCharacter } from '../ActiveCharacter'
import { SpeechBubble } from '../Message/SayMessage'
import { NarrateBubble } from '../Message/NarrateMessage'
import { OOCBubble } from '../Message/OOCMessage'
import MessageComponent from '../Message/MessageComponent'
import { ParseCommandModes, ParseCommandProps } from '../../slices/lifeLine/baseClasses'
import { getLineEntryMode, setCurrentMode, setEntry } from '../../slices/UI/lineEntry'

type LineEntryMode = ParseCommandModes | 'Options'

interface EntryFieldProps {
    defaultValue: string;
    placeholder?: string;
    callback: (props: Omit<ParseCommandProps, 'raiseError'>) => boolean;
}

const EntryField = React.forwardRef<any, EntryFieldProps>(({ defaultValue, placeholder, callback }, ref) => {
    const activeCharacter = useActiveCharacter()
    const value = activeCharacter.lineEntry
    const mode = activeCharacter.entryMode
    const setCurrentMode = activeCharacter.setEntryMode
    const dispatch = useDispatch()
    const onChange = activeCharacter.setLineEntry
    const { TextEntryLines } = useSelector(getClientSettings)
    const empty = value === '' || value === defaultValue
    return <TextField
        inputRef={ref}
        sx={{ bgcolor: 'background.default' }}
        placeholder={placeholder}
        multiline={!(TextEntryLines === 1)}
        rows={TextEntryLines || 2}
        value={value}
        onKeyPress={(event) => {
            if (event.key === 'Enter') {
                if (mode !== 'Options') {
                    event.preventDefault()
                    const callbackResult = callback({ entry: (value || ''), mode })
                    if (callbackResult) {
                        onChange(defaultValue)
                        setCurrentMode('Command')
                    }
                }
            }
            if (empty) {
                if (mode !== 'SayMessage' && (event.key === '"' || event.key === "'")) {
                    event.preventDefault()
                    setCurrentMode('SayMessage')
                }
                if (mode !== 'NarrateMessage' && (event.key === ':' || event.key === ";")) {
                    event.preventDefault()
                    setCurrentMode('NarrateMessage')
                }
                if (mode !== 'OOCMessage' && (event.key === '\\' || event.key === "|")) {
                    event.preventDefault()
                    setCurrentMode('OOCMessage')
                }
                if (mode !== 'Command' && (event.key === '/' || event.key === '?')) {
                    event.preventDefault()
                    setCurrentMode('Command')
                }
            }
        }}
        onChange={(event) => {
            onChange(event.target.value)
        }}
        fullWidth
    />
})

interface EntryModeSpeedDialProps {}

const EntryModeSpeedDial: FunctionComponent<EntryModeSpeedDialProps> = () => {
    const activeCharacter = useActiveCharacter()
    const mode = activeCharacter.entryMode
    const setMode = activeCharacter.setEntryMode
    const icons: Record<LineEntryMode, ReactElement> = {
        Options: <OptionsIcon sx={{ width: "30px", height: "30px" }} />,
        SayMessage: <SayMessageIcon sx={{ width: "30px", height: "30px" }} />,
        NarrateMessage: <NarrateMessageIcon sx={{ width: "30px", height: "30px" }} />,
        OOCMessage: <OOCMessageIcon sx={{ width: "30px", height: "30px" }} />,
        Command: <CommandIcon sx={{ width: "30px", height: "30px" }} />,
    }
    return <SpeedDial
        ariaLabel="Text entry mode"
        sx={{ position: 'absolute', bottom: '10px', right: '10px' }}
        FabProps={{ sx: { width: "60px", height: "60px" } }}        
        icon={icons[mode]}
    >
        <SpeedDialAction
            key="SayMessage"
            icon={<SayMessageIcon />}
            tooltipTitle={`Say (")`}
            onClick={() => { setMode('SayMessage') }}
        />
        <SpeedDialAction
            key="NarrateMessage"
            icon={<NarrateMessageIcon />}
            tooltipTitle="Narrate (:)"
            onClick={() => { setMode('NarrateMessage') }}
        />
        <SpeedDialAction
            key="OOCMessage"
            icon={<OOCMessageIcon />}
            tooltipTitle="Out of Character (\)"
            onClick={() => { setMode('OOCMessage') }}
        />
        <SpeedDialAction
            key="Command"
            icon={<CommandIcon />}
            tooltipTitle="Command (/)"
            onClick={() => { setMode('Command') }}
        />
        <SpeedDialAction
            key="Options"
            icon={<OptionsIcon />}
            tooltipTitle="More"
            onClick={() => { setMode('Options') }}
        />
    </SpeedDial>
}

type EntryDispatcherProps = EntryFieldProps & EntryModeSpeedDialProps

const EntryModeDispatcher = React.forwardRef<any, EntryDispatcherProps>((props, ref) => {
    const { CharacterId, entryMode } = useActiveCharacter()
    const navigate = useNavigate()
    switch(entryMode) {
        case 'Options':
            return <Box sx={{
                    background: (theme: any) => (theme.palette.extras.paleGradient),
                    padding: '10px 15px 15px 15px',
                    borderRadius: '15px',
                    position: 'relative',
                    marginRight: '10px'
                }}
            >
                <Avatar sx={{ width: 50, height: 50, bgcolor: blue[500] }}>
                    <MapIcon
                        sx={{ width:40, height: 50 }}
                        onClick={() => {
                            navigate(`/Character/${CharacterId.split('#')[1]}/Map/`)
                        }}
                    />
                </Avatar>
            </Box>
        case 'SayMessage':
            return <SpeechBubble variant="right" tailOffset="30px">
                    <EntryField ref={ref} placeholder='What do you say?' {...props} />
                </SpeechBubble>
        case 'NarrateMessage':
            return <NarrateBubble variant="right" tailOffset="30px">
                    <EntryField ref={ref} placeholder='What happens next?' {...props} />
                </NarrateBubble>
        case 'OOCMessage':
            return <OOCBubble variant="right" tailOffset="30px">
                    <EntryField ref={ref} placeholder='What do you say, as a player?' {...props} />
                </OOCBubble>
        case 'Command':
            return <Box sx={{
                    padding: '10px 15px 15px 15px',
                    marginRight: '10px',
                    marginLeft: '10px'
                }}
            >
                <EntryField ref={ref} placeholder='What do you do?' {...props} />
            </Box>
    }
})

interface LineEntryProps {
    callback: (props: Omit<ParseCommandProps, 'raiseError'>) => boolean;
}


export const LineEntry: FunctionComponent<LineEntryProps> = ({ callback = () => (true) }) => {
    const ref = useRef<HTMLInputElement>(null)
    const { entryMode: mode } = useActiveCharacter()

    useEffect(() => {
        ref.current?.focus()
    }, [mode])
    return (
        <CharacterColorWrapper color="blue">
            <MessageComponent
                rightIcon={
                    <EntryModeSpeedDial />
                }
            >
                <Box sx={{ marginRight: "10px" }}>
                    <EntryModeDispatcher
                        ref={ref}
                        defaultValue=''
                        callback={callback}
                    />
                </Box>
            </MessageComponent>
        </CharacterColorWrapper>
    )
}

export default LineEntry