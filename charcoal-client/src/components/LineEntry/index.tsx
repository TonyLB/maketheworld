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
import CommandIcon from '@mui/icons-material/Code'

import { getServerSettings, getClientSettings } from '../../slices/settings'
import { CharacterColorWrapper } from '../CharacterStyleWrapper'
import { SpeechBubble } from '../Message/SayMessage'
import { NarrateBubble } from '../Message/NarrateMessage'
import MessageComponent from '../Message/MessageComponent'

interface EntryFieldProps {
    value: string;
    defaultValue: string;
    callback: (entry: string) => boolean;
    onChange: (newValue: string) => void;
    setMode: (newMode: LineEntryMode) => void;
}

const EntryField = React.forwardRef<any, EntryFieldProps>(({ value, defaultValue, callback, onChange, setMode }, ref) => {
    const { ChatPrompt } = useSelector(getServerSettings)
    const { TextEntryLines } = useSelector(getClientSettings)
    const empty = value === '' || value === defaultValue
    return <TextField
        inputRef={ref}
        sx={{ bgcolor: 'background.default' }}
        placeholder={ChatPrompt}
        multiline={!(TextEntryLines === 1)}
        rows={TextEntryLines || 2}
        value={value}
        onKeyPress={(event) => {
            if (event.key === 'Enter') {
                event.preventDefault()
                const callbackResult = callback(value || '')
                if (callbackResult) {
                    onChange(defaultValue)
                }
            }
            if (empty) {
                if (event.key === '"' || event.key === "'") {
                    event.preventDefault()
                    setMode('SayMessage')
                }
                if (event.key === ':' || event.key === ";") {
                    event.preventDefault()
                    setMode('NarrateMessage')
                }
                if (event.key === '/' || event.key === '?') {
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

type LineEntryMode = 'SayMessage' | 'NarrateMessage' | 'Command'

interface EntryModeSpeedDialProps {
    mode: LineEntryMode;
    setMode: (newMode: LineEntryMode) => void;
}

const EntryModeSpeedDial: FunctionComponent<EntryModeSpeedDialProps> = ({ mode, setMode }) => {
    const icons: Record<LineEntryMode, ReactElement> = {
        SayMessage: <SayMessageIcon sx={{ width: "30px", height: "30px" }} />,
        NarrateMessage: <NarrateMessageIcon sx={{ width: "30px", height: "30px" }} />,
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
                    <EntryField ref={ref} {...props} />
                </SpeechBubble>
        case 'NarrateMessage':
            return <NarrateBubble variant="right" tailOffset="30px">
                    <EntryField ref={ref} {...props} />
                </NarrateBubble>
        case 'Command':
            return <Box sx={{
                    padding: '10px 15px 15px 15px',
                    marginRight: '10px',
                    marginLeft: '10px'
                }}
            >
                <EntryField ref={ref} {...props} />
            </Box>
    }
})

interface LineEntryProps {
    callback: (entry: string) => boolean;
}


export const LineEntry: FunctionComponent<LineEntryProps> = ({ callback = () => (true) }) => {
    const ref = useRef<HTMLInputElement>(null)
    const [mode, setMode] = useState<LineEntryMode>('SayMessage')
    const [value, setValue] = useState<string>('')

    useEffect(() => {
        ref.current?.focus()
    }, [ref.current])
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