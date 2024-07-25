import React, { FunctionComponent, ReactElement, useRef } from 'react'
import IconButton from '@mui/material/IconButton'
import ButtonGroup from '@mui/material/ButtonGroup'
import makeStyles from '@mui/styles/makeStyles'
import { Theme } from '@mui/material/styles'

import SelectionIcon from '@mui/icons-material/NearMe'
import OneWayExitIcon from '@mui/icons-material/TrendingFlat'
import TwoWayExitIcon from '@mui/icons-material/SyncAlt'
import RoomIcon from '@mui/icons-material/Home'
import MoveIcon from '@mui/icons-material/OpenWith'
import { useMapContext } from '../../Controller'
import { ToolSelected } from '../../Controller/baseClasses'
import useOnboarding, { useNextOnboarding } from '../../../Onboarding/useOnboarding'
import TutorialPopover from '../../../Onboarding/TutorialPopover'

export const localStyles = makeStyles((theme: Theme) => ({
    normal: {
        borderColor: theme.palette.primary.light,
        borderWidth: "1px",
        borderStyle: "solid",
        backgroundColor: "white"
    },
    'normal.selected': {
        '&:hover': {
            backgroundColor: theme.palette.primary.light
        },
        backgroundColor: theme.palette.primary.light
    },
    buttonGroup: {
    }
}))

type ToolSelectIconProps = {
    toolKey: ToolSelected;
    icon: ReactElement<any, any>;
    checkPoints?: string[];
}

const ToolSelectIcon: FunctionComponent<ToolSelectIconProps> = ({ toolKey, icon, checkPoints = [] }) => {
    const { UI: { toolSelected }, mapDispatch } = useMapContext()
    const classes = localStyles()
    const nextOnboarding = useNextOnboarding()
    const [_, addOnboarding] = useOnboarding('selectExitToolbar')
    const ref = useRef<HTMLButtonElement>(null)

    return <React.Fragment>
        <IconButton
            key={toolKey}
            ref={ref}
            color={ toolSelected === toolKey ? 'primary' : 'default' }
            classes={{
                root: classes.normal,
                colorPrimary: classes['normal.selected']
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
            anchorEl={ref}
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
