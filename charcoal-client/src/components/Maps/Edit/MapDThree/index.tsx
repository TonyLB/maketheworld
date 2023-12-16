
import {
    SimulationLinkDatum
} from 'd3-force'

import { SimCallback, SimNode, SimulationReturn, MapLayer, MapLayerRoom } from './baseClasses'

import MapDThreeTree, { SimulationTreeNode } from './MapDThreeTree'
import ExitDragD3Layer from './exitDragSimulation'

import { produce } from 'immer'
import { GenericTree } from '@tonylb/mtw-sequence/dist/tree/baseClasses'
import { MapTreeItem } from '../../Controller/baseClasses'

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

const argumentParse = ({ roomLayers, exits }: {
    roomLayers: MapLayer[];
    exits: { to: string; from: string; visible: boolean; }[];
}) => {
    const keyByRoomId = roomLayers.reduce<Record<string, string>>((previous, { rooms }) => (
        Object.values(rooms).reduce<Record<string, string>>((accumulator, { id, roomId }) => ({ ...accumulator, [roomId]: id }), previous)
    ), {})
    const links = exits
        .filter(({ to, from }) => (keyByRoomId[to] && keyByRoomId[from]))
        .map(({ to, from }, index) => ({
            id: `${index}`,
            source: keyByRoomId[from],
            target: keyByRoomId[to],
            visible: true
        } as (SimulationLinkDatum<SimNode> & { id: string })))
    const { layers } = roomLayers.reduce<{ layers: SimulationReturn[], previousRooms: Record<string, MapLayerRoom & { visible: boolean }>}>((previous, roomLayer) => {
        return {
            layers: [
                ...previous.layers,
                {
                    key: roomLayer.key,
                    nodes: [
                        ...Object.values(previous.previousRooms).map((room) => ({
                            ...room,
                            cascadeNode: true
                        })),
                        ...Object.values(roomLayer.rooms).map((room) => ({
                            ...room,
                            cascadeNode: false,
                            visible: roomLayer.roomVisibility[room.roomId] || false
                        }))
                    ] as SimNode[],
                    links
                }
            ],
            previousRooms: {
                ...previous.previousRooms,
                ...Object.entries(roomLayer.rooms).reduce((previous, [key, value]) => ({
                    ...previous,
                    [key]: {
                        ...value,
                        visible: roomLayer.roomVisibility[key] || false
                    }
                }), {})
            }
        }
    }, { layers: [] as SimulationReturn[], previousRooms: {} as Record<string, MapLayerRoom & { visible: boolean }> })
    return layers
}

type MapTreeTranslateHelperOutput = {
    topLevel: SimulationTreeNode;
    children: GenericTree<SimulationTreeNode>;
}

//
// Merge function for MapTreeTranslateHelperOutput that aggregates nodes and links
//
const mergeMapTreeTranslateHelperOutput = (...args: MapTreeTranslateHelperOutput[]): MapTreeTranslateHelperOutput => {
    return args.reduce<MapTreeTranslateHelperOutput>((previous, { topLevel, children }) => ({
        topLevel: {
            nodes: [
                ...previous.topLevel.nodes.filter(({ id }) => (!topLevel.nodes.find(({ id: checkId }) => (id === checkId)))),
                ...topLevel.nodes
            ],
            links: [
                ...previous.topLevel.links.filter(({ id }) => (!topLevel.links.find(({ id: checkId }) => (id === checkId)))),
                ...topLevel.links
            ],
            visible: topLevel.visible,
            key: topLevel.key
        },
        children: [
            ...previous.children,
            ...children
        ]
    }), { topLevel: { key: '', nodes: [], links: [], visible: true }, children: [] })
}

type MapTreeTranslateOptions = {
    hiddenLayers: string[];
    inheritedHidden?: boolean;
    keyStack: string;
    getConditionIndex: () => number;
}
//
// mapTreeTranslateHelper:
//    - Reorders entries at each level of the Tree to put non-conditional nodes before all conditional nodes,
//      and then conditional nodes in their original order
//    - Aggregates in depth-first order, creating a new layer each time a condition is reached.
//

//
// TODO: Refactor mapTreeTranslateHelper with dfsWalk
//
const mapTreeTranslateHelper = (tree: GenericTree<MapTreeItem>, options: MapTreeTranslateOptions = { hiddenLayers: [], keyStack: 'Root', getConditionIndex: () => 0 }): MapTreeTranslateHelperOutput => {
    return tree.reduce<MapTreeTranslateHelperOutput>((previous, item) => {
        const { data, children } = item
        switch(data.tag) {
            case 'If':
                const newKeyStack = `${options.keyStack}::If-${options.getConditionIndex()}`
                return {
                    topLevel: previous.topLevel,
                    children: [
                        ...previous.children,
                        ...mapTreeTranslate(
                            children,
                            {
                                ...options,
                                keyStack: newKeyStack,
                                inheritedHidden: options.inheritedHidden || options.hiddenLayers.includes(data.key)
                            }
                        )
                    ]
                }
            case 'Room':
                if (typeof data.x === 'undefined' || typeof data.y === 'undefined') {
                    return previous
                }
                return mergeMapTreeTranslateHelperOutput(
                    previous,
                    {
                        topLevel: {
                            nodes: [{
                                id: data.key,
                                roomId: data.key,
                                x: data.x ?? 0,
                                y: data.y ?? 0,
                                cascadeNode: true,
                                visible: !Boolean(options.inheritedHidden)
                            }],
                            links: [],
                            visible: !Boolean(options.inheritedHidden),
                            key: options.keyStack
                        },
                        children: []
                    },
                    mapTreeTranslateHelper(children, options)
                )
            case 'Exit':
                return mergeMapTreeTranslateHelperOutput(
                    previous,
                    {
                        topLevel: {
                            nodes: [],
                            links: [{
                                id: data.key,
                                source: data.from,
                                target: data.to
                            }],
                            visible: !Boolean(options.inheritedHidden),
                            key: options.keyStack
                        },
                        children: []
                    },
                    mapTreeTranslateHelper(children, options)
                )
        }
    }, { topLevel: { key: options.keyStack, nodes: [], links: [], visible: true }, children: [] })

}

export const mapTreeTranslate = (tree: GenericTree<MapTreeItem>, options?: MapTreeTranslateOptions): GenericTree<SimulationTreeNode> => {
    let nextConditionIndex = 1
    const getConditionIndex = () => (nextConditionIndex++)
    const finalOptions = options ?? { hiddenLayers: [], keyStack: 'Root', getConditionIndex }
    const { topLevel, children } = mapTreeTranslateHelper(tree, finalOptions)
    return [{ data: topLevel, children }]
}

export class MapDThree extends Object {
    tree: MapDThreeTree;
    exitDragLayer?: ExitDragD3Layer
    stable: boolean = true
    onStability: SimCallback = () => {}
    onTick: SimCallback = () => {}
    onExitDrag?: (dragTarget: { sourceRoomId: string, x: number, y: number }) => void
    onAddExit?: (fromRoomId: string, toRoomId: string, double: boolean) => void
    //
    // TODO: Refactor constructor and update to accept GenericTree<MapTreeItem> rather than
    // pre-sorted roomLayers and exits.
    //
    constructor({ tree, roomLayers, exits, onStability, onTick, onExitDrag, onAddExit }: {
        tree: GenericTree<MapTreeItem>;
        roomLayers: MapLayer[];
        exits: { to: string; from: string; visible: boolean; }[];
        onStability?: SimCallback,
        onTick?: SimCallback,
        onExitDrag?: (dragTarget: { sourceRoomId: string, x: number, y: number }) => void,
        onAddExit?: (fromRoomId: string, toRoomId: string, double: boolean) => void
    }) {
        super()
        const layers = argumentParse({ roomLayers: [...roomLayers].reverse(), exits })
        const simulatorTree: GenericTree<SimulationTreeNode> = mapTreeTranslate(tree)
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
        // this.stack.setCallbacks({ onTick, onStability })
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
    update(tree: GenericTree<MapTreeItem>): void {
        const simulatorTree: GenericTree<SimulationTreeNode> = mapTreeTranslate(tree)
        
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