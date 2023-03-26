import React, { FunctionComponent, ReactElement, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
    Avatar,
    Box,
    SpeedDial,
    SpeedDialAction,
    Stack,
    TextField
} from '@mui/material'
import { blue } from '@mui/material/colors'
import MapIcon from '@mui/icons-material/Explore'
import MoreVertIcon from '@mui/icons-material/MoreVert'

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
import EntryModeRoller from './EntryModeRoller'

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
    const empty = value.trim() === '' || (mode === 'NarrateMessage' && value.trim() === (activeCharacter.info?.Name || ''))
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
                    // setEntry('')
                    setCurrentMode('SayMessage')
                }
                if (mode !== 'NarrateMessage' && (event.key === ':' || event.key === ";")) {
                    event.preventDefault()
                    // setEntry(activeCharacter.info?.Name ? `${activeCharacter.info?.Name} ` : '')
                    setCurrentMode('NarrateMessage')
                }
                if (mode !== 'OOCMessage' && (event.key === '\\' || event.key === "|")) {
                    event.preventDefault()
                    // setEntry('')
                    setCurrentMode('OOCMessage')
                }
                if (mode !== 'Command' && (event.key === '/' || event.key === '?')) {
                    event.preventDefault()
                    // setEntry('')
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

type EntryModeSpeedDialOptions = 'Map'

const EntryModeSpeedDial: FunctionComponent<EntryModeSpeedDialProps> = () => {
    const { CharacterId } = useActiveCharacter()
    const navigate = useNavigate()
    return <Box sx={{ position: "relative", width: "60px", height: "60px" }}>
        <SpeedDial
            ariaLabel="Extra Options"
            sx={{ position: 'absolute', bottom: '10px', right: '0px' }}
            FabProps={{ sx: { width: "40px", height: "40px" } }}        
            icon={<MoreVertIcon fontSize='small' sx={{ width: "20px", height: "20px" }} />}
        >
            <SpeedDialAction
                key="Map"
                icon={<MapIcon />}
                tooltipTitle={`Map`}
                onClick={() => {
                    navigate(`/Character/${CharacterId.split('#')[1]}/Map/`)
                }}
            />
        </SpeedDial>
    </Box>
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
                    <Stack direction="row">
                        <EntryModeRoller />
                        <EntryModeSpeedDial />
                    </Stack>
                }
                rightGutter={160}
            >
                <EntryModeDispatcher
                    ref={ref}
                    callback={callback}
                />
            </MessageComponent>
        </CharacterColorWrapper>
    )
}

export default LineEntry