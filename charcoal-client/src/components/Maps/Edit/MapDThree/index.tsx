
import {
    SimulationLinkDatum
} from 'd3-force'

import { SimCallback, SimNode } from './baseClasses'

import MapDThreeTree, { SimulationTreeNode } from './MapDThreeTree'
import ExitDragD3Layer from './exitDragSimulation'

import { produce } from 'immer'
import { GenericTree, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { MapTreeItem, isMapTreeRoomWithPosition } from '../../Controller/baseClasses'
import dfsWalk from '@tonylb/mtw-wml/dist/tree/dfsWalk'
import { SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'

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

type MapTreeTranslateReduce = {
    nextConditionIndex: number;
    keyStack: string;
    visible: boolean;
    nodes: SimNode[],
    links: (SimulationLinkDatum<SimNode> & { id: string })[]
}

export const mapTreeTranslate = (tree: GenericTree<SchemaTag, TreeId>, hiddenConditions: string[]) => (dfsWalk<(previous: { output: GenericTree<SimulationTreeNode>; state: MapTreeTranslateReduce }, data: SchemaTag, extra: TreeId) => { output: GenericTree<SimulationTreeNode>; state: MapTreeTranslateReduce }>({
    nest: ({ state, data }) => {
        if (data.tag === 'If') {
            return {
                ...state,
                nextConditionIndex: state.nextConditionIndex + 1,
                keyStack: `${state.keyStack}::If-${state.nextConditionIndex}`,
                visible: state.visible && !(hiddenConditions.includes(data.key)),
                nodes: [],
                links: []
            }
        }
        else {
            return state
        }
    },
    unNest: ({ previous, state, data }) => {
        if (data.tag === 'If') {
            return {
                ...state,
                visible: previous.visible,
                keyStack: previous.keyStack,
                nodes: previous.nodes,
                links: previous.links
            }
        }
        return state
    },
    aggregate: ({ direct, children, data }) => {
        if (!data || data.tag === 'If') {
            return {
                output: [
                    ...direct.output,
                    {
                        data: {
                            key: children.state.keyStack,
                            nodes: children.state.nodes,
                            links: children.state.links,
                            visible: children.state.visible
                        },
                        children: children.output
                    }
                ],
                state: children.state
            }
        }
        else {
            return {
                output: [...direct.output, ...children.output],
                state: children.state
            }
        }
    },
    callback: (previous, data, { id }) => {
        //
        // Add room and exit data to the running record of nodes and links in state (this record
        // is turned into a SimulationTreeNode in the aggregate method)
        //
        switch(data.tag) {
            case 'Room':
                if ((typeof data.x !== 'undefined') && (typeof data.y !== 'undefined')) {
                    return {
                        output: previous.output,
                        state: {
                            ...previous.state,
                            nodes: [
                                ...previous.state.nodes,
                                {
                                    id,
                                    roomId: data.key,
                                    x: data.x,
                                    y: data.y,
                                    cascadeNode: false,
                                    visible: previous.state.visible
                                }
                            ]
                        }
                    }
                }
                return previous
            case 'Exit':
                return {
                    output: previous.output,
                    state: {
                        ...previous.state,
                        links: [...previous.state.links, {
                            id: data.key,
                            source: data.from,
                            target: data.to
                        }]
                    }
                }
        }
        return previous
    },
    default: { output: [] as GenericTree<SimulationTreeNode>, state: { nextConditionIndex: 1, keyStack: 'Root', visible: true, nodes: [], links: [] } }
})(tree))

export class MapDThree extends Object {
    tree: MapDThreeTree;
    exitDragLayer?: ExitDragD3Layer
    stable: boolean = true
    onStability: SimCallback = () => {}
    onTick: SimCallback = () => {}
    onExitDrag?: (dragTarget: { sourceRoomId: string, x: number, y: number }) => void
    onAddExit?: (fromRoomId: string, toRoomId: string, double: boolean) => void

    constructor({ tree, hiddenConditions, onStability, onTick, onExitDrag, onAddExit }: {
        tree: GenericTree<SchemaTag, TreeId>;
        hiddenConditions: string[];
        onStability?: SimCallback,
        onTick?: SimCallback,
        onExitDrag?: (dragTarget: { sourceRoomId: string, x: number, y: number }) => void,
        onAddExit?: (fromRoomId: string, toRoomId: string, double: boolean) => void
    }) {
        super()
        const simulatorTree: GenericTree<SimulationTreeNode> = mapTreeTranslate(tree, hiddenConditions)
        this.tree = new MapDThreeTree({
            tree: simulatorTree,
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
            onExitDrag?: (props: { sourceRoomId: string; x: number; y: number }) => void;
            onAddExit?: (fromRoomId: string, toRoomId: string, double: boolean) => void
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
    update(tree: GenericTree<SchemaTag, TreeId>, hiddenConditions: string[]): void {
        const simulatorTree: GenericTree<SimulationTreeNode> = mapTreeTranslate(tree, hiddenConditions)
        
        this.tree.update(simulatorTree)
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
        this.tree.endDrag()
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
    unmount(): void {
        this.tree.unmount()
    }
}

export type { SimNode }
export default MapDThree