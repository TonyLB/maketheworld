
import { MapTree } from '../maps'

import { SimCallback, SimNode } from './baseClasses'

import MapDThreeStack from './MapDThreeStack'
import treeToSimulation from './treeToSimulation'
import ExitDragD3Layer from './exitDragSimulation'

//
// Check through the current links in the map and compile a list of rooms that are already as linked as this
// operation can make them:
//    * If a one-way link, reject all rooms that the focus room has an exit to
//    * If a two-way link, reject only rooms that the focus room has both an exit to and an entry from
//
const getInvalidExits = (mapDThree: MapDThree, roomId: string, double: boolean = false): string[] => {
    const currentExits = mapDThree.stack.layers.reduce<Record<string, { from: boolean; to: boolean }>>((previous, layer) => {
        //
        // Add to the current accumulator the rooms that the focus room has an exit TO in this layer
        //
        const fromFocusRoom = layer.links
            .filter(({ source }) => {
                const matchNode = mapDThree.nodes.find(({ id }) => (id === source))
                return matchNode && matchNode.roomId === roomId
            })
            .map(({ target }) => {
                const matchNode = mapDThree.nodes.find(({ id }) => (id === target))
                return matchNode ? matchNode.roomId as string : ''
            })
            .filter((value) => value)
            .reduce<Record<string, { from: boolean; to: boolean }>>(
                (accumulator, targetRoomId) => ({ ...accumulator, [targetRoomId]: { to: accumulator[targetRoomId]?.to ?? false, from : true } }),
                previous
            )
        if (double) {
            //
            // Add to the current accumulator the rooms that the focus room has an entry FROM in this layer
            //
            const alsoToFocusRoom = layer.links
                .filter(({ target }) => {
                    const matchNode = mapDThree.nodes.find(({ id }) => (id === target))
                    return matchNode && matchNode.roomId === roomId
                })
                .map(({ source }) => {
                    const matchNode = mapDThree.nodes.find(({ id }) => (id === source))
                    return matchNode ? matchNode.roomId as string : ''
                })
                .filter((value) => value)
                .reduce<Record<string, { from: boolean; to: boolean }>>(
                    (accumulator, targetRoomId) => ({ ...accumulator, [targetRoomId]: { from: accumulator[targetRoomId]?.from ?? false, to : true } }),
                    fromFocusRoom
                )
            return alsoToFocusRoom
        }
        else {
            return fromFocusRoom
        }
    }, {})
    //
    // Use the aggregate data to make a decision
    //
    if (double) {
        return [ ...Object.entries(currentExits).filter(([_, { to, from }]) => (to && from)).map(([key]) => key), roomId ]
    }
    return [ ...Object.keys(currentExits), roomId ]
}

export class MapDThree extends Object {
    stack: MapDThreeStack = new MapDThreeStack({ layers: [] })
    exitDragLayer?: ExitDragD3Layer
    stable: boolean = true
    onStability: SimCallback = () => {}
    onTick: SimCallback = () => {}
    onExitDrag?: (dragTarget: { sourceRoomId: string, x: number, y: number }) => void
    onAddExit?: (fromRoomId: string, toRoomId: string, double: boolean) => void
    constructor({ tree, onStability, onTick, onExitDrag, onAddExit }: {
        tree: MapTree,
        onStability?: SimCallback,
        onTick?: SimCallback,
        onExitDrag?: (dragTarget: { sourceRoomId: string, x: number, y: number }) => void,
        onAddExit?: (fromRoomId: string, toRoomId: string, double: boolean) => void
    }) {
        super()
        const layers = treeToSimulation(tree)
        this.stack = new MapDThreeStack({
            layers,
            onTick,
            onStabilize: onStability
        })
        this.onExitDrag = onExitDrag
        this.onAddExit = onAddExit
        this.stack.checkStability()
    }
    //
    // An aggregator that decodes the nodes at the top layer (i.e., everything that has been cascaded up from the lower
    // level simulators) and delivers it in readable format.
    //
    get nodes(): SimNode[] {
        return this.stack.nodes
    }
    setCallbacks(props: { onTick?: SimCallback, onStability?: SimCallback }) {
        this.stack.setCallbacks(props)
    }
    //
    // Update responds to changes in the semantic structure of the map, while keeping live and running simulations.
    //
    // Do NOT use it to respond to simulation-level changes in the simulations themselves ... only semantic changes
    // in the incoming map tree.
    //
    update(tree: MapTree): void {
        const incomingLayers = treeToSimulation(tree)
        this.stack.update(incomingLayers)

        this.stack.checkStability()
    }

    //
    // dragNode and endDrag dispatch events to set forces on the appropriate layer
    //
    dragNode(props: { roomId: string, x: number, y: number }): void {
        this.stack.dragNode(props)
    }
    //
    // dragExit creates (if needed) a dragging layer and passes data into its simulation
    //
    dragExit({ roomId, x, y, double }: { roomId: string, x: number, y: number, double: boolean }): void {
        if (!this.exitDragLayer) {
            this.exitDragLayer = new ExitDragD3Layer(() => (this.nodes), roomId, double, getInvalidExits(this, roomId, double))
            if (this.onExitDrag) {
                this.exitDragLayer.onTick = this.onExitDrag
            }
        }
        this.exitDragLayer.drag(x, y)
    }
    endDrag(): void {
        this.stack.endDrag()
        if (this.exitDragLayer) {
            const dragNode = this.exitDragLayer.nodes.find(({ roomId }) => (roomId === 'DRAG-TARGET'))
            if (dragNode && this.onAddExit) {
                const invalidExits = getInvalidExits(this, this.exitDragLayer.sourceRoomId, this.exitDragLayer.double)
                const closeTargets = this.nodes
                    .map(({ fx, x, fy, y, ...rest }) => ({ x: fx ?? (x || 0), y: fy ?? (y || 0), ...rest }))
                    .filter(({ x, y }) => (Math.abs((dragNode.x || 0) - x) < 30 && Math.abs((dragNode.y || 0) - y)))
                    .filter(({ roomId }) => (!invalidExits.includes(roomId)))
                    .map(({ roomId, x, y }) => ({
                        roomId,
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
                        addExit(exitDragLayer.sourceRoomId, closeTargets[0].roomId, exitDragLayer.double)
                    }, 0)
                }
            }
            this.exitDragLayer.endDrag()
            this.exitDragLayer = undefined
        }
    }
}

export type { SimNode }
export default MapDThree