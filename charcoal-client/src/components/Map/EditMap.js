// Foundational imports (React, Redux, etc.)
import React, { useReducer } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useGesture } from 'react-use-gesture'

// MaterialUI imports
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button
} from '@material-ui/core'

import { getEditMapDialogUI } from '../../selectors/UI/mapDialog'
import { closeEditMapDialog } from '../../actions/UI/mapDialog'
import MapDisplay from './MapDisplay'
import MapRoom from './MapRoom'
import useStyles from '../styles'

const START_DRAG = 'START_DRAG'
const END_DRAG = 'END_DRAG'
const DRAG = 'DRAG'

const EditableRoom = (props) => {
    const { localDispatch, PermanentId, ...rest } = props
    const bind = useGesture({
        onDrag: ({ movement }) => { localDispatch({ type: DRAG, PermanentId, movement })},
        onMouseDown: () => { localDispatch({ type: START_DRAG, PermanentId }) },
        onMouseUp: () => { localDispatch({ type: END_DRAG, PermanentId }) }
    })
    return <MapRoom PermanentId={PermanentId} {...rest} {...bind()} />
}

const mapDisplayReducer = (state, action) => {
    const { type, PermanentId } = action
    switch(type) {
        case START_DRAG:
            return {
                ...state,
                Rooms: {
                    ...state.Rooms,
                    [PermanentId]: {
                        ...(state.Rooms[PermanentId] || { PermanentId }),
                        dragOriginX: state.Rooms[PermanentId].X || 0,
                        dragOriginY: state.Rooms[PermanentId].Y || 0,
                        dragInitialized: true
                    }
                }
            }
        case END_DRAG:
            return {
                ...state,
                Rooms: {
                    ...state.Rooms,
                    [PermanentId]: {
                        ...(state.Rooms[PermanentId] || { PermanentId }),
                        dragOriginX: state.Rooms[PermanentId].X || 0,
                        dragOriginY: state.Rooms[PermanentId].Y || 0,
                        dragInitialized: false
                    }
                }
            }
        case DRAG:
            const { movement: [X, Y] } = action
            if (!state.Rooms[PermanentId].dragInitialized) {
                return state
            }
            return {
                ...state,
                Rooms: {
                    ...state.Rooms,
                    [PermanentId]: {
                        ...state.Rooms[PermanentId],
                        X: (state.Rooms[PermanentId].dragOriginX || 0) + X,
                        Y: (state.Rooms[PermanentId].dragOriginY || 0) + Y
                    }
                }
            }
        default:
            return state
    }
}

export const EditMapDisplay = ({ map }) => {
    const [state, localDispatch] = useReducer(mapDisplayReducer, {
        ...map,
        Rooms: Object.values(map.Rooms)
            .map(({ X, Y, ...rest }) => ({ X, dragOriginX: X, Y, dragOriginY: Y, ...rest }))
            .reduce((previous, { PermanentId, ...rest }) => ({ ...previous, [PermanentId]: { PermanentId, ...rest }}), {})
    })
    return <MapDisplay
        map={state}
        roomComponent={(props) => (<EditableRoom localDispatch={localDispatch} {...props} />)}
    />
}

export const EditMapDialog = () => {
    const { open, map } = useSelector(getEditMapDialogUI)
    const dispatch = useDispatch()
    const classes = useStyles()

    const closeHandler = () => { dispatch(closeEditMapDialog()) }
    return(
        <Dialog
            maxWidth="lg"
            open={open}
            onClose={closeHandler}
        >
            <DialogTitle id="help-dialog-title" className={classes.lightblue}>Edit Map</DialogTitle>
            <DialogContent>
                <EditMapDisplay map={map} />
            </DialogContent>
            <DialogActions>
                <Button onClick={closeHandler}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default EditMapDialog