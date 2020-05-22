// Foundational imports (React, Redux, etc.)
import React, { useReducer, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useGesture } from 'react-use-gesture'
import { forceSimulation, forceCollide } from 'd3-force'

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
import { getPermanentHeaders } from '../../selectors/permanentHeaders'
import forceFlexLink from './forceFlexLink'

const END_DRAG = 'END_DRAG'
const DRAG = 'DRAG'
const REGISTER_D_THREE = 'REGISTER_D_THREE'
const UNREGISTER_D_THREE = 'UNREGISTER_D_THREE'
const TICK = 'TICK'

const EditableRoom = (props) => {
    const { localDispatch, PermanentId, ...rest } = props
    const bind = useGesture({
        onDrag: ({ down, movement }) => {
            if (down) {
                localDispatch({ type: DRAG, PermanentId, movement })
            }
            else {
                localDispatch({ type: END_DRAG, PermanentId })
            }
        }
    })
    return <MapRoom PermanentId={PermanentId} {...rest} {...bind()} />
}

const mapDisplayReducer = (state, action) => {
    const { type, PermanentId } = action
    const { DThree, nodes, ...restOfState } = state
    const currentNode = ((nodes || []).find((node) => (node.PermanentId === PermanentId))) || {}
    switch(type) {
        case END_DRAG:
            currentNode.fx = null
            currentNode.fy = null
            if (DThree) {
                DThree.alphaTarget(0)
            }
            return {
                ...state,
                Rooms: {
                    ...state.Rooms,
                    [PermanentId]: {
                        ...(state.Rooms[PermanentId] || { PermanentId }),
                        dragOriginX: undefined,
                        dragOriginY: undefined
                    }
                }
            }
        case DRAG:
            const { movement: [X, Y] } = action
            const dragRoom = state.Rooms[PermanentId]
            const dragOriginX = dragRoom.dragOriginX || dragRoom.X
            const dragOriginY = dragRoom.dragOriginY || dragRoom.Y
            const fixedX = dragOriginX + X
            const fixedY = dragOriginY + Y
            currentNode.fx = fixedX - 300
            currentNode.fy = fixedY - 200
            if (DThree && DThree.alpha() < 0.1) {
                DThree.alpha(1)
                DThree.alphaTarget(0.5)
                DThree.restart()
            }
            return {
                ...state,
                Rooms: {
                    ...state.Rooms,
                    [PermanentId]: {
                        ...state.Rooms[PermanentId],
                        X: fixedX,
                        Y: fixedY,
                        dragOriginX,
                        dragOriginY
                    }
                }
            }
        case REGISTER_D_THREE:
            let newNodes = Object.values(state.Rooms)
                .map(({ PermanentId, X, Y }, index) => ({
                    index,
                    PermanentId,
                    x: X - 300,
                    y: Y - 200
                }))
            const idToNodeIndex = newNodes
                .reduce((previous, { PermanentId, index }) => ({ ...previous, [PermanentId]: index }), {})
            let links = Object.values(state.Rooms)
                .reduce((previous, { PermanentId, Exits }) => ([ ...previous, ...(Exits || []).map(({ RoomId }) => ({ from: PermanentId, to: RoomId })) ]), [])
                .filter(({ to }) => (idToNodeIndex[to]))
                .map(({ from, to }, index) => ({
                    source: idToNodeIndex[from],
                    target: idToNodeIndex[to],
                    index
                }))
            const force = forceSimulation(newNodes)
                .alphaDecay(0.15)
                .force("boundingBox", boundingForceFactory(newNodes))
                .force("gridDrift", gridInfluenceForceFactory(newNodes, 100.0))
                .force("link", forceFlexLink(links).minDistance(70).maxDistance(150))
                .force("collision", forceCollide(40).iterations(3))
            force.on('tick', () => {
                action.localDispatch({ type: TICK })
            })
            return {
                ...state,
                DThree: force,
                nodes: newNodes
            }
        case UNREGISTER_D_THREE:
            DThree.stop()
            return restOfState
        case TICK:
            return {
                ...state,
                Rooms: nodes.reduce((previous, { PermanentId, x, y }) => ({
                    ...previous,
                    [PermanentId]: {
                        ...(previous[PermanentId] || { PermanentId }),
                        X: x + 300,
                        Y: y + 200
                    }
                }), state.Rooms)
            }
        default:
            return state
    }
}

const boundingForceFactory = (nodes) => () => {
    nodes.forEach((node) => {
        node.x = Math.max(-260, Math.min(260, node.x))
        node.y = Math.max(-160, Math.min(160, node.y))
    })
}

const gridInfluenceForceFactory = (nodes, granularity) => (alpha) => {
    const sqrtAlpha = Math.sqrt(alpha)
    nodes.forEach((node) => {
        const targetX = Math.round(node.x / granularity) * granularity
        const targetY = Math.round(node.y / granularity) * granularity
        node.vx += (targetX - node.x) * 0.4 * sqrtAlpha
        node.vy += (targetY - node.y) * 0.4 * sqrtAlpha
    })
}

export const EditMapDisplay = ({ map }) => {
    const permanentHeaders = useSelector(getPermanentHeaders)
    const [state, localDispatch] = useReducer(mapDisplayReducer, {
        ...map,
        Rooms: Object.values(map.Rooms)
            .reduce((previous, { PermanentId, ...rest }) => ({
                ...previous,
                [PermanentId]: {
                    PermanentId,
                    Exits: (permanentHeaders[PermanentId] || { Exits: [] }).Exits || [],
                    ...rest
                }
            }), {})
    })
    useEffect(() => {
        localDispatch({
            type: REGISTER_D_THREE,
            localDispatch
        })
        return () => {
            localDispatch({ type: UNREGISTER_D_THREE })
        }
    }, [localDispatch])
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