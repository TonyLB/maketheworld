import React, { useState } from 'react'
import IconButton from '@material-ui/core/IconButton'
import ButtonGroup from '@material-ui/core/ButtonGroup'
import { makeStyles } from '@material-ui/core/styles'

import SelectionIcon from '@material-ui/icons/NearMe'
import MarqueeIcon from '@material-ui/icons/PhotoSizeSelectSmall'
import OneWayExitIcon from '@material-ui/icons/TrendingFlat'
import TwoWayExitIcon from '@material-ui/icons/SyncAlt'
import RoomIcon from '@material-ui/icons/Home'
import FolderIcon from '@material-ui/icons/PermMedia'

export const localStyles = makeStyles((theme) => ({
    normal: {
        borderColor: theme.palette.primary.light,
        borderWidth: "1px",
        borderStyle: "solid"
    },
    ['normal.selected']: {
        '&:hover': {
            backgroundColor: theme.palette.primary.light
        },
        backgroundColor: theme.palette.primary.light
    },
    buttonGroup: {
    }
}))

export const ToolSelect = (props) => {
    const classes = localStyles()
    const tools = [
        {
            key: 'Select',
            icon: <SelectionIcon />
        },
        {
            key: 'Marquee',
            icon: <MarqueeIcon />
        },
        {
            key: 'AddRoom',
            icon: <RoomIcon />
        },
        {
            key: 'ImportRoom',
            icon: <FolderIcon />
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
    const [currentTool, setCurrentTool] = useState('Select')
    return <ButtonGroup orientation="vertical" aria-label="vertical outlined primary button group">
        {
            tools.map(({ key, icon }) => (
                <IconButton
                    key={key}
                    color={ currentTool === key ? 'primary' : 'default' }
                    classes={{
                        root: classes.normal,
                        ['colorPrimary']: classes['normal.selected']
                    }}
                    onClick={() => { setCurrentTool(key) }}

                >
                    {icon}
                </IconButton>
            ))
        }
    </ButtonGroup>
}

ToolSelect.propTypes = {
}

export default ToolSelect
