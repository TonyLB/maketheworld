
import { MapTree } from '../maps'
import {
    SimulationNodeDatum,
    SimulationLinkDatum,
    Simulation,
    forceSimulation,
    forceX,
    forceY,
    forceCollide
} from 'd3-force'

import { SimNode } from './treeToSimulation'

import boundingForceFactory from './boundingForce'
import gridInfluenceForceFactory from './gridInfluenceForce'
import forceFlexLink from './forceFlexLink'
import cascadeForce from './cascadeForce'
import treeToSimulation from './treeToSimulation'
import ExitDragD3Layer from './exitDragSimulation'

export type SimCallback = (nodes: SimNode[]) => void

type MapNodes = SimNode[]
type MapLinks = SimulationLinkDatum<SimulationNodeDatum>[]

export class MapDThreeIterator extends Object {
    key: string = ''
    nodes: MapNodes = []
    links: MapLinks = []
    simulation: Simulation<SimNode, SimulationLinkDatum<SimNode>>
    stable: boolean = true
    callback: SimCallback = () => {}
    onStability: SimCallback = () => {}
    get boundingForce() {
        return boundingForceFactory(this.nodes)
    }
    get gridInfluenceForce() {
        return gridInfluenceForceFactory(this.nodes, 50)
    }
    get forceFlexLink() {
        //
        // TODO: When we refactor to stop storing links by internal ID and store roomID, this will need to be changed.
        //
        const nodesById = this.nodes.reduce<Record<string, SimNode>>((previous, node) => ({ ...previous, [node.id]: node }), {})
        return forceFlexLink(
                this.links
                    .map(({ source, target, ...rest }) => ({ source: source as string, target: target as string, ...rest }))
                    .filter(({ source, target }) => (nodesById[source]?.cascadeNode === false || nodesById[target]?.cascadeNode === false)),
                this.nodes
            ).minDistance(70).maxDistance(180).id(({ id }: { id: string }) => (id))
    }
    constructor(key: string, nodes: MapNodes, links: MapLinks, getCascadeNodes?: () => MapNodes) {
        super()
        this.key = key
        this.nodes = nodes
        this.links = links
        this.simulation = forceSimulation(this.nodes)
            .alphaDecay(0.15)

        if (getCascadeNodes) {
            this.simulation.force("cascade", cascadeForce(getCascadeNodes, this.nodes).id(({ roomId }) => roomId))
        }

        this.simulation
            .force("boundingBox", this.boundingForce)
            .force("gridDrift", this.gridInfluenceForce)
            .force("link", this.forceFlexLink)
            .force("collision", forceCollide(40).iterations(3))

        //
        // TODO:  Replace onTick-based cascade with a cascade force that can refer back to previous layers and set
        // fx/fy values during the applForce stage.  Then refactor all the places that we reinitialize forces
        // to account for our having mucked with the nodes structure during cascade
        //
        this.simulation.on('tick', () => {
            this.callback?.(this.nodes)
        })
        this.simulation.on('end', () => {
            this.stable = true
            this.onStability?.(this.nodes)
        })
    }
    //
    // Update at the individual layer level does a differential against old data, to check whether there are any additions
    // or deletions of nodes.  It returns that value to the controller, so that in the case of a change any successive layer
    // can be forced to also restart its simulation.
    //
    update(nodes: MapNodes, links: MapLinks, forceRestart: boolean = false, getCascadeNodes?: () => MapNodes): boolean {
        const nodesFound: Record<string, boolean> = this.nodes.reduce<Record<string, boolean>>((previous, node) => ({ ...previous, [node.roomId]: false }), {})
        type NestedLinkMap = Record<string, Record<string, boolean>>
        const linksFound: NestedLinkMap = this.links.reduce<NestedLinkMap>((previous, { source, target }) => {
            const sourceId = typeof source === "string" ? source : (source as SimNode).id
            const targetId = typeof target === "string" ? target : (target as SimNode).id
            if (sourceId && targetId) {
                return {
                    ...previous,
                    [sourceId]: {
                        ...(previous[sourceId] ?? {}),
                        [targetId]: false
                    }
                }
            }
            return previous
        }, {})
        this.links = links
        let anyDifference: boolean = false

        nodes.forEach((node) => {
            //
            // TODO:  As functionality expands, you will likely need to add some further comparisons here to see
            // whether the state of the nodes has changed in a way that requires resimulation (right now, the only
            // important state for them is what layer they are on)
            //
            if (nodesFound[node.roomId] !== undefined) {
                nodesFound[node.roomId] = true
            }
            else {
                anyDifference = true
            }
        })
        anyDifference = anyDifference || (Object.values(nodesFound).filter((found) => (!found)).length > 0)
        links.forEach(({ source, target }) => {
            const sourceId = typeof source === "string" ? source : (source as SimNode).id
            const targetId = typeof target === "string" ? target : (target as SimNode).id
            if (sourceId && targetId) {
                if (linksFound[sourceId] === undefined || linksFound[sourceId][targetId] === undefined) {
                    anyDifference = true
                }
                linksFound[sourceId] = {
                    ...linksFound[sourceId],
                    [targetId]: true
                }
            }
        })
        anyDifference = anyDifference || (Object.values(linksFound).filter((links) => (Object.values(links).filter((found) => (!found)))).length > 0)

        this.simulation.nodes(nodes)
        this.nodes = nodes
        if (anyDifference || forceRestart) {
            if (getCascadeNodes) {
                this.simulation.force("cascade", cascadeForce(getCascadeNodes, this.nodes).id(({ roomId }) => roomId))
            }
            this.simulation
                .force("boundingBox", this.boundingForce)
                .force("gridDrift", this.gridInfluenceForce)
                .force("link", this.forceFlexLink)
                .alpha(1.0)
                .restart()
            this.stable = false
        }
        return anyDifference
    }
    setCallbacks(callback: SimCallback, stabilityCallback: SimCallback) {
        this.callback = callback
        this.onStability = stabilityCallback
    }
    liven(first: boolean) {
        if (this.stable) {
            this.simulation.alpha(1).restart()
        }
        this.simulation.alphaTarget(first ? 0 : 1.0)
        this.stable = false
    }
    dragNode({ roomId, x, y }: { roomId: string, x: number, y: number }) {
        this.simulation?.nodes(this.nodes)
            .alpha(1)
            .force("draggingForceX", forceX<SimNode>()
                .x(x)
                .strength(({ roomId: nodeRoomId }: SimNode) => (nodeRoomId === roomId ? 1 : 0))
            )
            .force("draggingForceY", forceY<SimNode>()
                .y(y)
                .strength(({ roomId: nodeRoomId }: SimNode) => (nodeRoomId === roomId ? 1 : 0))
            )
            .force("boundingBox", this.boundingForce)
            .force("gridDrift", this.gridInfluenceForce)
            .force("link", this.forceFlexLink)
            .restart()
        this.stable = false
    }
    endDrag() {
        //
        // TODO: Change alphaTarget assignment such that it assigns to some non-zero number for
        // layers that still have active layers below them, and to zero for the currently bottom-most
        // active layer.
        //
        this.simulation.force("draggingForceX", null).force("draggingForceY", null)
        if (this.simulation) {
            this.simulation.alphaTarget(0).restart()
        }
    }
}

//
// Check through the current links in the map and compile a list of rooms that are already as linked as this
// operation can make them:
//    * If a one-way link, reject all rooms that the focus room has an exit to
//    * If a two-way link, reject only rooms that the focus room has both an exit to and an entry from
//
const getInvalidExits = (mapDThree: MapDThree, roomId: string, double: boolean = false): string[] => {
    const currentExits = mapDThree.layers.reduce<Record<string, { from: boolean; to: boolean }>>((previous, layer) => {
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
    layers: MapDThreeIterator[] = []
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
        this.layers = layers.map(({ key, nodes, links }, index) => {
            const newMap = new MapDThreeIterator(key, nodes, links, index > 0 ? () => (this.layers[index-1].nodes) : () => [])
            newMap.setCallbacks(this.cascade(index).bind(this), this.checkStability.bind(this))
            return newMap
        })
        this.setCallbacks({ onTick, onStability })
        this.onExitDrag = onExitDrag
        this.onAddExit = onAddExit
        this.checkStability()
    }
    //
    // An aggregator that decodes the nodes at the top layer (i.e., everything that has been cascaded up from the lower
    // level simulators) and delivers it in readable format.
    //
    get nodes(): SimNode[] {
        if (this.layers.length > 0) {
            //
            // Overlay x and y with fx/fy if necessary (converting from null to undefined if needed)
            //
            return this.layers[this.layers.length - 1].nodes
                .map(({ x, y, fx, fy, ...rest }) => ({ ...rest, x: x ?? (fx === null ? undefined : fx), y: y ?? (fy === null ? undefined : fy) }))
        }
        return []
    }
    setCallbacks({ onTick, onStability }: { onTick?: SimCallback, onStability?: SimCallback }) {
        if (onStability) {
            this.onStability = onStability
        }
        if (onTick) {
            this.onTick = onTick
        }
    }
    //
    // Update responds to changes in the semantic structure of the map, while keeping live and running simulations.
    //
    // Do NOT use it to respond to simulation-level changes in the simulations themselves ... only semantic changes
    // in the incoming map tree.
    //
    update(tree: MapTree): void {
        //
        // TODO:  When we create bookmarks and references so that the same RoomId can appear meaningfully in different layers,
        // we'll have to refactor this matching algorithm to be based on layer item IDs rather than roomIDs.
        //
        
        const previousNodesByRoomId = this.nodes.reduce<Record<string, SimNode>>((accumulator, node) => {
            return {
                ...accumulator,
                [node.roomId]: node
            }
        }, {})
        type PreviousLayerRecords = Record<string, { found: boolean; index: number, simulation: Simulation<SimNode, SimulationLinkDatum<SimNode>> }>
        const previousLayersByKey = this.layers.reduce<PreviousLayerRecords>((previous, { key, simulation }, index) => ({ ...previous, [key]: { index, found: false, simulation } }), {})

        const incomingLayers = treeToSimulation(tree)
        let forceRestart = false

        type IncomingLayersReduce = {
            layers: MapDThreeIterator[];
            previousLayersByKey: PreviousLayerRecords;
        }
        const { layers: newLayers, previousLayersByKey: processedLayers } = incomingLayers.reduce<IncomingLayersReduce>((previous, incomingLayer, index) => {

            //
            // Find where (if at all) this layer is positioned in current data
            //

            const previousIndex = previousLayersByKey[incomingLayer.key].index

            //
            // Map existing positions (where known) onto incoming nodes
            //

            const currentNodes = incomingLayer.nodes.map((node) => {
                if (previousNodesByRoomId[node.roomId]) {
                    if (node.cascadeNode) {
                        return {
                            ...node,
                            fx: previousNodesByRoomId[node.roomId].x,
                            fy: previousNodesByRoomId[node.roomId].y,
                        }    
                    }
                    else {
                        return {
                            ...node,
                            x: previousNodesByRoomId[node.roomId].x,
                            y: previousNodesByRoomId[node.roomId].y,
                        }    
                    }
                }
                return node
            })

            //
            // Apply create or update, and check whether forceRestart needs to be set
            //

            if (previousIndex !== undefined) {
                const layerToUpdate = this.layers[previousIndex]
                if (previousIndex !== index) {
                    forceRestart = true
                }
                const layerUpdateResult = layerToUpdate.update(currentNodes, incomingLayer.links, forceRestart, previous.layers.length > 0 ? () => previous.layers[previous.layers.length-1].nodes : () => [])
                forceRestart = forceRestart || layerUpdateResult

                return {
                    layers: [
                        ...previous.layers,
                        this.layers[previousIndex]
                    ],
                    previousLayersByKey: {
                        ...previous.previousLayersByKey,
                        [incomingLayer.key]: {
                            ...previous.previousLayersByKey[incomingLayer.key],
                            found: true
                        }
                    }
                }
            }

            //
            // If no match, you have a new layer (which needs to be created) and which should
            // cause a forceRestart cascade
            //

            forceRestart = true
            return {
                layers: [
                    ...previous.layers,
                    new MapDThreeIterator(
                        incomingLayer.key,
                        incomingLayer.nodes,
                        incomingLayer.links
                    )
                ],
                previousLayersByKey: previous.previousLayersByKey
            }
        }, {
            layers: [],
            previousLayersByKey
        })

        //
        // If some layers have been removed, their DThree simulation processes should be stopped.
        //
        Object.values(processedLayers).filter(({ found }) => (!found))
            .forEach(({ simulation }) => { simulation.stop() })

        this.layers = newLayers
        this.layers.forEach((layer, index) => {
            layer.setCallbacks(this.cascade(index).bind(this), this.checkStability.bind(this))
        })
        this.checkStability()
    }
    //
    // checkStability re-evaluates the stability of the entire stack of simulation layers.  Used as
    // a callback for each individual simulation layer.
    //
    checkStability(): void {
        let wasStable = this.stable
        this.stable = true
        let previousLayerStable = true
        this.layers.forEach((layer, index) => {
            this.stable = this.stable && layer.stable
            if (!this.stable) {
                layer.liven(previousLayerStable)
            }
            previousLayerStable = previousLayerStable && layer.stable
        })
        //
        // If all layers have reached stability, call onStability with an aggregate of all nodes in all simulations
        // (overwriting by roomIds for the time being)
        //
        if (this.stable && !wasStable) {
            this.onStability(Object.values(this.layers.reduce<Record<string, SimNode>>((previous, layer) => ({
                ...previous,
                ...(layer.nodes.reduce<Record<string, SimNode>>((previous, { roomId, ...rest }) => ({ ...previous, [roomId]: { roomId, ...rest } }), {}))
            }), {})))
        }
    }
    //
    // dragNode and endDrag dispatch events to set forces on the appropriate layer
    //
    dragNode({ roomId, x, y }: { roomId: string, x: number, y: number }): void {
        const layerToMessage = this.layers.find(({ nodes }) => (nodes.find((node) => (node.roomId === roomId))))
        if (layerToMessage) {
            layerToMessage?.dragNode({ roomId, x, y })
            this.checkStability()
        }
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
        this.layers.forEach((layer) => { layer.endDrag() })
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
    //
    // cascade takes positions from layer index and cascades them forward to later layers
    //
    cascade(startingIndex: number) {
        return () => {
            if (startingIndex < 0 || startingIndex >= this.layers.length ) {
                throw new Error('MapDThree cascade index out of bounds')
            }
            this.layers.forEach((layer, index) => {
                if (index >= startingIndex) {
                    //
                    // If cascading off of the topmost layer of the simulation, deliver to simulation onTick
                    //
                    //
                    // TODO:  Assign onTick only to the topmost layer
                    //
                    if (index === this.layers.length - 1) {
                        this.onTick(this.nodes)
                    }
                }
            })
        }
    }
}

export type { SimNode }
export default MapDThree