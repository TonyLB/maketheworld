import React, { useState, FunctionComponent, ReactElement, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
    Avatar,
    Box,
    SpeedDial,
    SpeedDialAction,
    TextField
} from '@mui/material'
import SayMessageIcon from '@mui/icons-material/Chat'
import NarrateMessageIcon from '@mui/icons-material/Receipt'
import OOCMessageIcon from '@mui/icons-material/CropFree'
import CommandIcon from '@mui/icons-material/Code'

import {
    // getServerSettings,
    getClientSettings
} from '../../slices/settings'
import { CharacterColorWrapper } from '../CharacterStyleWrapper'
import { SpeechBubble } from '../Message/SayMessage'
import { NarrateBubble } from '../Message/NarrateMessage'
import { OOCBubble } from '../Message/OOCMessage'
import MessageComponent from '../Message/MessageComponent'
import { ParseCommandModes, ParseCommandProps } from '../../slices/lifeLine/baseClasses'

type LineEntryMode = ParseCommandModes

interface EntryFieldProps {
    value: string;
    defaultValue: string;
    placeholder?: string;
    callback: (props: Omit<ParseCommandProps, 'raiseError'>) => boolean;
    onChange: (newValue: string) => void;
    mode: LineEntryMode;
    setMode: (newMode: LineEntryMode) => void;
}

const EntryField = React.forwardRef<any, EntryFieldProps>(({ value, defaultValue, placeholder, callback, onChange, mode, setMode }, ref) => {
    // const { ChatPrompt } = useSelector(getServerSettings)
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
                event.preventDefault()
                const callbackResult = callback({ entry: (value || ''), mode })
                if (callbackResult) {
                    onChange(defaultValue)
                }
            }
            if (empty) {
                if (mode !== 'SayMessage' && (event.key === '"' || event.key === "'")) {
                    event.preventDefault()
                    setMode('SayMessage')
                }
                if (mode !== 'NarrateMessage' && (event.key === ':' || event.key === ";")) {
                    event.preventDefault()
                    setMode('NarrateMessage')
                }
                if (mode !== 'OOCMessage' && (event.key === '\\' || event.key === "|")) {
                    event.preventDefault()
                    setMode('OOCMessage')
                }
                if (mode !== 'Command' && (event.key === '/' || event.key === '?')) {
                    event.preventDefault()
                    setMode('Command')
                }
            }
        }}
        onChange={(event) => {
            onChange(event.target.value)
        }}
        fullWidth
    />
})

interface EntryModeSpeedDialProps {
    mode: LineEntryMode;
    setMode: (newMode: LineEntryMode) => void;
}

const EntryModeSpeedDial: FunctionComponent<EntryModeSpeedDialProps> = ({ mode, setMode }) => {
    const icons: Record<LineEntryMode, ReactElement> = {
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
            tooltipTitle="Say"
            onClick={() => { setMode('SayMessage') }}
        />
        <SpeedDialAction
            key="NarrateMessage"
            icon={<NarrateMessageIcon />}
            tooltipTitle="Narrate"
            onClick={() => { setMode('NarrateMessage') }}
        />
        <SpeedDialAction
            key="OOCMessage"
            icon={<OOCMessageIcon />}
            tooltipTitle="Out of Character"
            onClick={() => { setMode('OOCMessage') }}
        />
        <SpeedDialAction
            key="Command"
            icon={<CommandIcon />}
            tooltipTitle="Command"
            onClick={() => { setMode('Command') }}
        />
    </SpeedDial>
}

type EntryDispatcherProps = EntryFieldProps & EntryModeSpeedDialProps

const EntryModeDispatcher = React.forwardRef<any, EntryDispatcherProps>(({
    mode,
    ...props
}, ref) => {
    switch(mode) {
        case 'SayMessage':
            return <SpeechBubble variant="right" tailOffset="30px">
                    <EntryField ref={ref} mode={mode} placeholder='What do you say?' {...props} />
                </SpeechBubble>
        case 'NarrateMessage':
            return <NarrateBubble variant="right" tailOffset="30px">
                    <EntryField ref={ref} mode={mode} placeholder='What happens next?' {...props} />
                </NarrateBubble>
        case 'OOCMessage':
            return <OOCBubble variant="right" tailOffset="30px">
                    <EntryField ref={ref} mode={mode} placeholder='What do you say, as a player?' {...props} />
                </OOCBubble>
        case 'Command':
            return <Box sx={{
                    padding: '10px 15px 15px 15px',
                    marginRight: '10px',
                    marginLeft: '10px'
                }}
            >
                <EntryField ref={ref} mode={mode} placeholder='What do you do?' {...props} />
            </Box>
    }
})

interface LineEntryProps {
    callback: (props: Omit<ParseCommandProps, 'raiseError'>) => boolean;
}


export const LineEntry: FunctionComponent<LineEntryProps> = ({ callback = () => (true) }) => {
    const ref = useRef<HTMLInputElement>(null)
    const [mode, setMode] = useState<LineEntryMode>('SayMessage')
    const [value, setValue] = useState<string>('')

    useEffect(() => {
        ref.current?.focus()
    }, [mode])
    return (
        <CharacterColorWrapper color="blue">
            <MessageComponent
                rightIcon={
                    <EntryModeSpeedDial mode={mode} setMode={setMode} />
                }
            >
                <Box sx={{ marginRight: "10px" }}>
                    <EntryModeDispatcher
                        ref={ref}
                        mode={mode}
                        setMode={setMode}
                        value={value}
                        defaultValue=''
                        onChange={setValue}
                        callback={callback}
                    />
                </Box>
            </MessageComponent>
        </CharacterColorWrapper>
    )
}

export default LineEntry