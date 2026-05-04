import React, { FunctionComponent, ReactElement, useRef } from 'react'
import IconButton from '@mui/material/IconButton'
import ButtonGroup from '@mui/material/ButtonGroup'
import { useTheme } from '@mui/material'

import SelectionIcon from '@mui/icons-material/NearMe'
import OneWayExitIcon from '@mui/icons-material/TrendingFlat'
import TwoWayExitIcon from '@mui/icons-material/SyncAlt'
import RoomIcon from '@mui/icons-material/Home'
import MoveIcon from '@mui/icons-material/OpenWith'
import { useMapContext } from '../../Controller'
import { ToolSelected } from '../../Controller/baseClasses'
import useOnboarding, { useNextOnboarding } from '../../../Onboarding/useOnboarding'
import TutorialPopover from '../../../Onboarding/TutorialPopover'

type ToolSelectIconProps = {
    toolKey: ToolSelected;
    icon: ReactElement<any, any>;
    checkPoints?: string[];
}

const ToolSelectIcon: FunctionComponent<ToolSelectIconProps> = ({ toolKey, icon, checkPoints = [] }) => {
    const { UI: { toolSelected }, mapDispatch } = useMapContext()
    const theme = useTheme()
    const nextOnboarding = useNextOnboarding()
    const [_, addOnboarding] = useOnboarding('selectExitToolbar')
    const ref = useRef<HTMLButtonElement>(null)
    const isSelected = toolSelected === toolKey

    return <React.Fragment>
        <IconButton
            key={toolKey}
            ref={ref}
            color={ isSelected ? 'primary' : 'default' }
            sx={{
                borderColor: theme.palette.primary.light,
                borderWidth: "1px",
                borderStyle: "solid",
                backgroundColor: isSelected ? theme.palette.primary.light : "white",
                '&:hover': {
                    backgroundColor: isSelected ? theme.palette.primary.light : theme.palette.primary.light
                }
            }}
            onClick={() => {
                if (nextOnboarding === 'selectExitToolbar' && toolKey === 'TwoWayExit') {
                    addOnboarding()
                }
                mapDispatch({ type: 'SetToolSelected', value: toolKey })
            }}
            size="large">
            {icon}
        </IconButton>
        <TutorialPopover
            anchorEl={ref as any}
            placement='right'
            checkPoints={checkPoints}
        />
    </React.Fragment>
}


interface ToolSelectGroups {
    key: ToolSelected,
    icon: ReactElement<any, any>
}

export const ToolSelect: FunctionComponent<{}> = () => {
    const tools: ToolSelectGroups[] = [
        {
            key: 'Select',
            icon: <SelectionIcon />
        },
        {
            key: 'Move',
            icon: <MoveIcon />
        },
        {
            key: 'AddRoom',
            icon: <RoomIcon />
        },
        {
            key: 'OneWayExit',
            icon: <OneWayExitIcon />
        },
        {
            key: 'TwoWayExit',
            icon: <TwoWayExitIcon />
        }
    ]
    return (
        <ButtonGroup orientation="vertical" aria-label="vertical outlined primary button group">
            {
                tools.map(({ key, icon }) => (
                    <ToolSelectIcon
                        key={key}
                        toolKey={key}
                        icon={icon}
                        checkPoints={key === 'TwoWayExit' ? ['selectExitToolbar'] : []}
                    />
                ))
            }
        </ButtonGroup>
    );
}

export default ToolSelect
