import React, { FunctionComponent, ReactElement, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
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

type LineEntryMode = ParseCommandModes | 'Options'

interface EntryFieldProps {
    placeholder?: string;
    callback: (props: Omit<ParseCommandProps, 'raiseError'>) => boolean;
}

const EntryField = React.forwardRef<any, EntryFieldProps>(({ placeholder, callback }, ref) => {
    const activeCharacter = useActiveCharacter()
    const value = activeCharacter.lineEntry
    const mode = activeCharacter.entryMode
    const setCurrentMode = activeCharacter.setEntryMode
    const setEntry = activeCharacter.setLineEntry
    const onChange = activeCharacter.setLineEntry
    const { TextEntryLines } = useSelector(getClientSettings)
    const empty = value === '' || (mode === 'NarrateMessage' && value.trim() === (activeCharacter.info?.Name || ''))
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
                        onChange((mode === 'NarrateMessage' && activeCharacter.info?.Name) ? `${activeCharacter.info?.Name} ` : '')
                        setEntry((mode === 'NarrateMessage' && activeCharacter.info?.Name) ? `${activeCharacter.info?.Name} ` : '')
                        setCurrentMode('Command')
                    }
                }
            }
            if (empty) {
                if (mode !== 'SayMessage' && (event.key === '"' || event.key === "'")) {
                    event.preventDefault()
                    setEntry('')
                    setCurrentMode('SayMessage')
                }
                if (mode !== 'NarrateMessage' && (event.key === ':' || event.key === ";")) {
                    event.preventDefault()
                    setEntry(activeCharacter.info?.Name ? `${activeCharacter.info?.Name} ` : '')
                    setCurrentMode('NarrateMessage')
                }
                if (mode !== 'OOCMessage' && (event.key === '\\' || event.key === "|")) {
                    event.preventDefault()
                    setEntry('')
                    setCurrentMode('OOCMessage')
                }
                if (mode !== 'Command' && (event.key === '/' || event.key === '?')) {
                    event.preventDefault()
                    setEntry('')
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
    const entry = activeCharacter.lineEntry
    const setMode = activeCharacter.setEntryMode
    const setEntry = activeCharacter.setLineEntry
    const name = activeCharacter.info?.Name || ''
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
            onClick={() => {
                if (mode === 'NarrateMessage' && entry.trim() === name) {
                    setEntry('')
                }
                setMode('SayMessage')
            }}
        />
        <SpeedDialAction
            key="NarrateMessage"
            icon={<NarrateMessageIcon />}
            tooltipTitle="Narrate (:)"
            onClick={() => {
                if (entry.trim() === '' && name) {
                    setEntry(`${name} `)
                }
                setMode('NarrateMessage')
            }}
        />
        <SpeedDialAction
            key="OOCMessage"
            icon={<OOCMessageIcon />}
            tooltipTitle="Out of Character (\)"
            onClick={() => {
                if (mode === 'NarrateMessage' && entry.trim() === name) {
                    setEntry('')
                }
                setMode('OOCMessage')
            }}
        />
        <SpeedDialAction
            key="Command"
            icon={<CommandIcon />}
            tooltipTitle="Command (/)"
            onClick={() => {
                if (mode === 'NarrateMessage' && entry.trim() === name) {
                    setEntry('')
                }
                setMode('Command')
            }}
        />
        <SpeedDialAction
            key="Options"
            icon={<OptionsIcon />}
            tooltipTitle="More"
            onClick={() => {
                if (mode === 'NarrateMessage' && entry.trim() === name) {
                    setEntry('')
                }
                setMode('Options')
            }}
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
                    marginRight: '10px',
                    display: 'flex',
                    flexDirection: 'row',
                    columnGap: '1em'
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
                        callback={callback}
                    />
                </Box>
            </MessageComponent>
        </CharacterColorWrapper>
    )
}

export default LineEntry