import React from 'react'

import {
    Paper,
    IconButton
} from '@material-ui/core'
import OpenArrowIcon from '@material-ui/icons/ChevronRight'
import CloseArrowIcon from '@material-ui/icons/ChevronLeft'
import MapIcon from '@material-ui/icons/Explore'

import MapCanvas from './Map/MapCanvas'
import { useStyles } from './styles'

export const MapDrawer = ({
    open = false,
    toggleOpen = () => {}
}) => {

    const classes = useStyles()

    return (
        <Paper
            className={ open ? classes.mapDrawerOpen : classes.mapDrawerClose }
        >
            <div style={{ position: 'absolute', bottom: 0, right: 0, paddingRight: "7px", paddingBottom: '7px', verticalAlign: 'center' }}>
                { !open && <IconButton disabled><MapIcon /></IconButton> }
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    onClick={toggleOpen}
                >
                    { open ? <CloseArrowIcon /> : <OpenArrowIcon /> }
                </IconButton>
            </div>
            <MapCanvas />
        </Paper>
    )
}

export default MapDrawer