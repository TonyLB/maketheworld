import React, { ReactElement } from 'react'
import IconButton from '@material-ui/core/IconButton'
import ButtonGroup from '@material-ui/core/ButtonGroup'
import { makeStyles } from '@material-ui/core/styles'

import SelectionIcon from '@material-ui/icons/NearMe'
import OneWayExitIcon from '@material-ui/icons/TrendingFlat'
import TwoWayExitIcon from '@material-ui/icons/SyncAlt'
import RoomIcon from '@material-ui/icons/Home'
import MoveIcon from '@material-ui/icons/OpenWith'
import { ToolSelected } from './area'

export const localStyles = makeStyles((theme) => ({
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

export interface ToolSelectProps {
    toolSelected: ToolSelected,
    onChange?: (toolSelected: ToolSelected) => void
}

interface ToolSelectGroups {
    key: ToolSelected,
    icon: ReactElement<any, any>
}

export const ToolSelect = (props: ToolSelectProps) => {
    const {
        toolSelected,
        onChange = () => {}
    } = props
    const classes = localStyles()
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
    return <ButtonGroup orientation="vertical" aria-label="vertical outlined primary button group">
        {
            tools.map(({ key, icon }) => (
                <IconButton
                    key={key}
                    color={ toolSelected === key ? 'primary' : 'default' }
                    classes={{
                        root: classes.normal,
                        colorPrimary: classes['normal.selected']
                    }}
                    onClick={() => {
                        onChange(key)
                    }}

                >
                    {icon}
                </IconButton>
            ))
        }
    </ButtonGroup>
}

export default ToolSelect
