import React, { FunctionComponent, ReactElement } from 'react'
import { useActiveCharacter } from '../ActiveCharacter'

import Stack from '@mui/material/Stack'
import { blue } from '@mui/material/colors'
import OptionsIcon from '@mui/icons-material/MoreHoriz'
import SayMessageIcon from '@mui/icons-material/Chat'
import NarrateMessageIcon from '@mui/icons-material/Receipt'
import OOCMessageIcon from '@mui/icons-material/CropFree'
import CommandIcon from '@mui/icons-material/Code'
import MapIcon from '@mui/icons-material/Explore'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { Button, IconButton } from '@mui/material'
import ButtonGroup from '@mui/material/ButtonGroup'
import { ParseCommandModes } from '../../slices/lifeLine/baseClasses'

type LineEntryMode = ParseCommandModes | 'Options'

interface EntryModeSpeedDialProps {}

export const EntryModeRoller: FunctionComponent<EntryModeSpeedDialProps> = () => {
    const activeCharacter = useActiveCharacter()
    const mode = activeCharacter.entryMode
    const entry = activeCharacter.lineEntry
    const setMode = activeCharacter.setEntryMode
    const setEntry = activeCharacter.setLineEntry
    const name = activeCharacter.info?.Name || ''
    const icons: Record<LineEntryMode, ReactElement> = {
        Options: <OptionsIcon fontSize='large' />,
        SayMessage: <SayMessageIcon fontSize='large' />,
        NarrateMessage: <NarrateMessageIcon fontSize='large' />,
        OOCMessage: <OOCMessageIcon fontSize='large' />,
        Command: <CommandIcon fontSize='large' />,
    }
    return <Stack direction="row" spacing={0}>
        <IconButton color="primary" sx={{ width: "2.5em" }}>
            { icons[mode] }
        </IconButton>
        <ButtonGroup orientation="vertical">
            <Button size="small">
                <KeyboardArrowUpIcon />
            </Button>
            <Button size="small">
                <KeyboardArrowDownIcon />
            </Button>
        </ButtonGroup>
    </Stack>
    
    // <SpeedDial
    //     ariaLabel="Text entry mode"
    //     sx={{ position: 'absolute', bottom: '10px', right: '10px' }}
    //     FabProps={{ sx: { width: "60px", height: "60px" } }}        
    //     icon={icons[mode]}
    // >
    //     <SpeedDialAction
    //         key="SayMessage"
    //         icon={<SayMessageIcon />}
    //         tooltipTitle={`Say (")`}
    //         onClick={() => {
    //             if (mode === 'NarrateMessage' && entry.trim() === name) {
    //                 setEntry('')
    //             }
    //             setMode('SayMessage')
    //         }}
    //     />
    //     <SpeedDialAction
    //         key="NarrateMessage"
    //         icon={<NarrateMessageIcon />}
    //         tooltipTitle="Narrate (:)"
    //         onClick={() => {
    //             if (entry.trim() === '' && name) {
    //                 setEntry(`${name} `)
    //             }
    //             setMode('NarrateMessage')
    //         }}
    //     />
    //     <SpeedDialAction
    //         key="OOCMessage"
    //         icon={<OOCMessageIcon />}
    //         tooltipTitle="Out of Character (\)"
    //         onClick={() => {
    //             if (mode === 'NarrateMessage' && entry.trim() === name) {
    //                 setEntry('')
    //             }
    //             setMode('OOCMessage')
    //         }}
    //     />
    //     <SpeedDialAction
    //         key="Command"
    //         icon={<CommandIcon />}
    //         tooltipTitle="Command (/)"
    //         onClick={() => {
    //             if (mode === 'NarrateMessage' && entry.trim() === name) {
    //                 setEntry('')
    //             }
    //             setMode('Command')
    //         }}
    //     />
    //     <SpeedDialAction
    //         key="Options"
    //         icon={<OptionsIcon />}
    //         tooltipTitle="More"
    //         onClick={() => {
    //             if (mode === 'NarrateMessage' && entry.trim() === name) {
    //                 setEntry('')
    //             }
    //             setMode('Options')
    //         }}
    //     />
    // </SpeedDial>
}

export default EntryModeRoller
