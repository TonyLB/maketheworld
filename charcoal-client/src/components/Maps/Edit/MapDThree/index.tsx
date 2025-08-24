
import { SimCallback, SimNode } from './baseClasses'

import MapDThreeTree from './MapDThreeTree'
import ExitDragD3Layer from './exitDragSimulation'

import { produce } from 'immer'
import { UpdateStandardPayload } from '../../../../slices/personalAssets/reducers'
import StandardMap, { StandardMapPayload } from '@tonylb/mtw-wml/ts/standardize/components/map'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

//
// Check through the current links in the map and compile a list of rooms that are already as linked as this
// operation can make them:
//    * If a one-way link, reject all rooms that the focus room has an exit to
//    * If a two-way link, reject only rooms that the focus room has both an exit to and an entry from
//
const getInvalidExits = (mapDThree: MapDThree, roomId: string, double: boolean = false): string[] => {
    const currentExits = mapDThree.tree.links.reduce<Record<string, { from: boolean; to: boolean }>>(
        (previous, { source, target }) => (produce(previous, (draft) => {
            if (source === roomId) {
                draft[target as string] = {
                    to: true,
                    from: draft[target as string]?.from || false
                }
            }
            if (target === roomId) {
                draft[source as string] = {
                    from: true,
                    to: draft[source as string]?.to || false
                }
            }
        })), {} as Record<string, { from: boolean; to: boolean }>)

    if (double) {
        return [ ...Object.entries(currentExits).filter(([_, { to, from }]) => (to && from)).map(([key]) => key), roomId ]
    }
    return [ ...Object.entries(currentExits).filter(([_, { to }]) => (to)).map(([key]) => key), roomId ]
}

export class MapDThree extends Object {
    tree: MapDThreeTree;
    exitDragLayer?: ExitDragD3Layer
    stable: boolean = true
    onStability: SimCallback = () => {}
    onTick: SimCallback = () => {}
    onExitDrag?: (dragTarget: { sourceRoomId: `ROOM#${string}`, x: number, y: number }) => void
    onAddExit?: (fromRoomId: `ROOM#${string}`, toRoomId: `ROOM#${string}`, double: boolean) => void

    constructor({ inherited, editable, updateStandard, mapId, onStability, onTick, onExitDrag, onAddExit }: {
        inherited: StandardForm;
        editable: StandardForm;
        updateStandard: (action: UpdateStandardPayload) => void;
        mapId: `MAP#${string}`;
        onStability?: SimCallback;
        onTick?: SimCallback;
        onExitDrag?: (dragTarget: { sourceRoomId: `ROOM#${string}`, x: number, y: number }) => void;
        onAddExit?: (fromRoomId: `ROOM#${string}`, toRoomId: `ROOM#${string}`, double: boolean) => void
    }) {
        super()
        this.tree = new MapDThreeTree({
            mapId,
            inherited,
            editable,
            onChange: (change) => {
                updateStandard({
                    type: 'update',
                    update: (incoming) => {
                        if (typeof change === 'function') {
                            return produce(incoming, change)
                        }
                        else {
                            return change
                        }
                    }
                })
            },
            onTick,
            onStabilize: onStability
        })
        this.tree.checkStability()
        this.onExitDrag = onExitDrag
        this.onAddExit = onAddExit
        // this.stack.checkStability()
    }
    //
    // An aggregator that decodes the nodes at the top layer (i.e., everything that has been cascaded up from the lower
    // level simulators) and delivers it in readable format.
    //
    get nodes(): SimNode[] {
        return this.tree.nodes
    }
    setCallbacks(props: {
            onTick?: SimCallback,
            onStability?: SimCallback;
            onExitDrag?: (props: { sourceRoomId: `ROOM#${string}`; x: number; y: number }) => void;
            onAddExit?: (fromRoomId: `ROOM#${string}`, toRoomId: `ROOM#${string}`, double: boolean) => void
        }) {
        const { onTick, onStability, onExitDrag, onAddExit } = props
        this.tree.setCallbacks({ onTick, onStability })
        if (onExitDrag) {
            this.onExitDrag = onExitDrag
        }
        if (onAddExit) {
            this.onAddExit = onAddExit
        }
    }
    //
    // Update responds to changes in the semantic structure of the map, while keeping live and running simulations.
    //
    // Do NOT use it to respond to simulation-level changes in the simulations themselves ... only semantic changes
    // in the incoming map tree.
    //
    update(inherited: StandardForm, editable: StandardForm, updateStandard: (action: UpdateStandardPayload) => void, mapId: `MAP#${string}`): void {
        this.tree.update(inherited, editable, (change) => {
            const mapComponent = editable.byUniversalId[mapId]
            if (mapComponent && mapComponent instanceof StandardMap) {
                updateStandard({
                    type: 'update',
                    update: (incoming) => {
                        if (typeof change === 'function') {
                            return produce(incoming, change)
                        }
                        else {
                            return change
                        }
                    }
                })
            }
        })
        this.tree.checkStability()
    }

    //
    // dragNode and endDrag dispatch events to set forces on the appropriate layer
    //
    dragNode(props: { roomId: string, x: number, y: number }): void {
        this.tree.dragNode(props)
    }
    //
    // dragExit creates (if needed) a dragging layer and passes data into its simulation
    //
    dragExit({ roomId, x, y, double }: { roomId: `ROOM#${string}`, x: number, y: number, double: boolean }): void {
        if (!this.exitDragLayer) {
            this.exitDragLayer = new ExitDragD3Layer(() => (this.nodes), roomId, double, getInvalidExits(this, roomId, double))
            if (this.onExitDrag) {
                this.exitDragLayer.onTick = this.onExitDrag
            }
        }
        this.exitDragLayer.drag(x, y)
    }
    endDrag(): void {
        this.tree.endDrag()
        if (this.exitDragLayer) {
            const dragNode = this.exitDragLayer.nodes.find(({ id }) => (id === 'ROOM#DRAG-TARGET'))
            if (dragNode && this.onAddExit) {
                const invalidExits = getInvalidExits(this, this.exitDragLayer.sourceRoomId, this.exitDragLayer.double)
                const closeTargets = this.nodes
                    .map(({ fx, x, fy, y, ...rest }) => ({ x: fx ?? (x || 0), y: fy ?? (y || 0), ...rest }))
                    .filter(({ x, y }) => (Math.abs((dragNode.x || 0) - x) < 30 && Math.abs((dragNode.y || 0) - y)))
                    .filter(({ id }) => (!invalidExits.includes(id)))
                    .map(({ id, x, y }) => ({
                        id,
                        distance: Math.pow((dragNode.x || 0) - (x || 0), 2) + Math.pow((dragNode.y || 0) - (y || 0), 2)
                    }))
                    .filter(({ distance }) => (distance < 900))
                    .sort(({ distance: a }, { distance: b }) => ( a - b ))
                if (closeTargets.length > 0) {
                    const addExit = this.onAddExit
                    const exitDragLayer = this.exitDragLayer
                    //
                    // TODO: Figure out why there's a set-state problem if this setTimeout is omitted
                    //
                    setTimeout(() => {
                        addExit(exitDragLayer.sourceRoomId, closeTargets[0].id, exitDragLayer.double)
                    }, 0)
                }
            }
            this.exitDragLayer.endDrag()
            this.exitDragLayer = undefined
        }
    }
    unmount(): void {
        this.tree.unmount()
    }
}

export type { SimNode }
export default MapDThree