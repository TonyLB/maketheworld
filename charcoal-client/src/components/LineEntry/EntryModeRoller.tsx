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
import { useDispatch } from 'react-redux'

type LineEntryMode = ParseCommandModes | 'Options'

interface EntryModeSpeedDialProps {}

export const EntryModeRoller: FunctionComponent<EntryModeSpeedDialProps> = () => {
    const activeCharacter = useActiveCharacter()
    const mode = activeCharacter.entryMode
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
            <Button size="small" onClick={() => { activeCharacter.moveEntryMode(true) }}>
                <KeyboardArrowUpIcon />
            </Button>
            <Button size="small" onClick={() => { activeCharacter.moveEntryMode(false) }}>
                <KeyboardArrowDownIcon />
            </Button>
        </ButtonGroup>
    </Stack>
    
}

export default EntryModeRoller
