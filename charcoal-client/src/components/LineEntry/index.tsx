import React, { useState, FunctionComponent, ReactElement } from 'react'
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
import MessageComponent from '../Message/MessageComponent'

interface EntryFieldProps {
    value: string;
    defaultValue: string;
    callback: (entry: string) => boolean;
    onChange: (newValue: string) => void;
}

const EntryField: FunctionComponent<EntryFieldProps> = ({ value, defaultValue, callback, onChange }) => {
    const { ChatPrompt } = useSelector(getServerSettings)
    const { TextEntryLines } = useSelector(getClientSettings)
    return <TextField
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
        }}
        onChange={(event) => {
            onChange(event.target.value)
        }}
        fullWidth
    />
}

const SayEntryField: FunctionComponent<EntryFieldProps> = (props) => (
    <SpeechBubble variant="right" tailOffset="30px">
        <EntryField {...props} />
    </SpeechBubble>
)

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

interface LineEntryProps {
    callback: (entry: string) => boolean;
}


export const LineEntry: FunctionComponent<LineEntryProps> = ({ callback = () => (true) }) => {
    const [mode, setMode] = useState<LineEntryMode>('SayMessage')
    const [value, setValue] = useState<string>('')

    return (
        <CharacterColorWrapper color="blue">
            <MessageComponent
                rightIcon={
                    <EntryModeSpeedDial mode={mode} setMode={setMode} />
                }
            >
                <Box sx={{ marginRight: "10px" }}>
                    <SayEntryField
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