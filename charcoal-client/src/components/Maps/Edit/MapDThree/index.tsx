
import {
    SimulationLinkDatum
} from 'd3-force'

import { SimCallback, SimNode } from './baseClasses'

import MapDThreeTree, { SimulationTreeNode } from './MapDThreeTree'
import ExitDragD3Layer from './exitDragSimulation'

import { produce } from 'immer'
import { GenericTree, GenericTreeNode, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { MapTreeItem, isMapTreeRoomWithPosition } from '../../Controller/baseClasses'
import dfsWalk from '@tonylb/mtw-wml/dist/tree/dfsWalk'
import { SchemaConditionFallthroughTag, SchemaConditionStatementTag, SchemaTag, isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement, isSchemaExit, isSchemaInherited, isSchemaPosition, isSchemaRoom } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import SchemaTagTree from '@tonylb/mtw-wml/dist/tagTree/schema'
import { defaultSelected } from '@tonylb/mtw-wml/dist/standardize'

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

const mapTreeTranslateHelper = (previous: GenericTreeNode<SimulationTreeNode>, node: GenericTreeNode<SchemaTag, TreeId>): GenericTreeNode<SimulationTreeNode> => {
    const { data: nodeData, children } = node
    if (isSchemaCondition(nodeData)) {
        const isSchemaConditionalContent = (data: SchemaTag): data is SchemaConditionStatementTag | SchemaConditionFallthroughTag => (isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data))
        return {
            ...previous,
            children: [
                ...previous.children,
                ...children.map(({ data, children, id }) => (
                    (isSchemaConditionalContent(data))
                        ? mapTreeTranslate(children, id).map(({ data: internalData, ...rest }) => ({ data: { ...internalData, key: id, visible: Boolean(data.selected) }, ...rest }))
                        : []
                )).flat(1)
            ]
        }
    }
    if (isSchemaRoom(nodeData)) {
        return {
            ...previous,
            data: children.reduce<SimulationTreeNode>((accumulator, { data: child, id: childId }) => {
                if (isSchemaExit(child)) {
                    return {
                        ...accumulator,
                        links: [
                            ...accumulator.links,
                            {
                                id: child.key,
                                source: nodeData.key,
                                target: child.to
                            }
                        ]
                    }
                }
                else if (isSchemaPosition(child)) {
                    return {
                        ...accumulator,
                        nodes: [
                            ...accumulator.nodes,
                            {
                                id: childId,
                                roomId: nodeData.key,
                                x: child.x,
                                y: child.y,
                                cascadeNode: false,
                                visible: previous.data.visible
                            }
                        ]
                    }
                }
                else {
                    return accumulator
                }
            }, previous.data)
        }
    }
}

export const mapTreeTranslate = (tree: GenericTree<SchemaTag, TreeId>, parentId: string): GenericTree<SimulationTreeNode> => {
    const reorderedTree = new SchemaTagTree(tree)
        .reordered([{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Room' }, { or: [{ match: 'Position' }, { match: 'Exit' }] }])
        .tree
    return [reorderedTree.reduce<GenericTreeNode<SimulationTreeNode>>(mapTreeTranslateHelper, { data: { nodes: [], links: [], visible: true, key: parentId }, children: [] })]
}

export class MapDThree extends Object {
    tree: MapDThreeTree;
    exitDragLayer?: ExitDragD3Layer
    stable: boolean = true
    onStability: SimCallback = () => {}
    onTick: SimCallback = () => {}
    onExitDrag?: (dragTarget: { sourceRoomId: string, x: number, y: number }) => void
    onAddExit?: (fromRoomId: string, toRoomId: string, double: boolean) => void

    constructor({ tree, inherited=[], parentId, onStability, onTick, onExitDrag, onAddExit }: {
        tree: GenericTree<SchemaTag, TreeId>;
        inherited?: GenericTree<SchemaTag, TreeId>;
        parentId: string;
        onStability?: SimCallback;
        onTick?: SimCallback;
        onExitDrag?: (dragTarget: { sourceRoomId: string, x: number, y: number }) => void;
        onAddExit?: (fromRoomId: string, toRoomId: string, double: boolean) => void
    }) {
        super()
        const simulatorTree: GenericTree<SimulationTreeNode> = mapTreeTranslate(tree, parentId)
        const inheritedLayer: GenericTree<SimulationTreeNode> = mapTreeTranslate(defaultSelected(inherited), 'INHERITED')
        this.tree = new MapDThreeTree({
            tree: simulatorTree,
            inherited: inheritedLayer,
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
    update(tree: GenericTree<SchemaTag, TreeId>, parentId: string): void {
        const simulatorTree: GenericTree<SimulationTreeNode> = mapTreeTranslate(tree, parentId)
        
        this.tree.update(simulatorTree)
        this.tree.checkStability()
    }

    updateInherited(tree: GenericTree<SchemaTag, TreeId>): void {
        const simulatorTree: GenericTree<SimulationTreeNode> = mapTreeTranslate(tree, 'NONE')
        
        this.tree.updateInherited(simulatorTree)
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