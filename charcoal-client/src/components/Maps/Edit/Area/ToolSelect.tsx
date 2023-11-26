import React, { FunctionComponent, ReactElement } from 'react'
import IconButton from '@mui/material/IconButton'
import ButtonGroup from '@mui/material/ButtonGroup'
import makeStyles from '@mui/styles/makeStyles'
import { Theme } from '@mui/material/styles'

import SelectionIcon from '@mui/icons-material/NearMe'
import OneWayExitIcon from '@mui/icons-material/TrendingFlat'
import TwoWayExitIcon from '@mui/icons-material/SyncAlt'
import RoomIcon from '@mui/icons-material/Home'
import MoveIcon from '@mui/icons-material/OpenWith'
import { ToolSelected } from './area'
import { useMapEditContext } from '../../Controller'

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

interface ToolSelectGroups {
    key: ToolSelected,
    icon: ReactElement<any, any>
}

export const ToolSelect: FunctionComponent<{}> = () => {
    const { toolSelected, setToolSelected } = useMapEditContext()
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
    return (
        <ButtonGroup orientation="vertical" aria-label="vertical outlined primary button group">
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
                            setToolSelected(key)
                        }}
                        size="large">
                        {icon}
                    </IconButton>
                ))
            }
        </ButtonGroup>
    );
}

export default ToolSelect
