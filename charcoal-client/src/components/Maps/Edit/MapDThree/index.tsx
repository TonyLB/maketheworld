
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
import treeToSimulation from './treeToSimulation';

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
        return forceFlexLink(
                this.links.map(({ source, target, ...rest }) => ({ source: source as string, target: target as string, ...rest })),
                this.nodes
            ).minDistance(70).maxDistance(180).id(({ id }: { id: string }) => (id))
    }
    constructor(key: string, nodes: MapNodes, links: MapLinks) {
        super()
        this.key = key
        this.nodes = nodes
        this.links = links
        this.simulation = forceSimulation(this.nodes)
            .alphaDecay(0.15)
            .force("boundingBox", this.boundingForce)
            .force("gridDrift", this.gridInfluenceForce)
            .force("link", this.forceFlexLink)
            .force("collision", forceCollide(40).iterations(3))

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
    update(nodes: MapNodes, links: MapLinks, forceRestart: boolean = false): boolean {
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
    //
    // Cascade accepts incoming node data (in a map by roomID) and updates fx/fy on cascade nodes
    // where possible (which it always *should* be, but ... y'know...)
    //
    cascade(nodesByRoomId: Record<string, SimNode>): void {
        this.nodes = this.nodes.map((node) => {
            if (node.cascadeNode) {
                const cascadingNode = nodesByRoomId[node.roomId]
                if (cascadingNode) {
                    return {
                        ...node,
                        fx: cascadingNode.fx ?? cascadingNode.x,
                        fy: cascadingNode.fy ?? cascadingNode.y
                    }
                }
            }
            return node
        })
        this.simulation
            .nodes(this.nodes)
            .force("link", this.forceFlexLink)
            .tick(1)
    }
}

export class MapDThree extends Object {
    layers: MapDThreeIterator[] = []
    stable: boolean = true
    onStability: SimCallback = () => {}
    onTick: SimCallback = () => {}
    constructor({ tree, onStability, onTick }: {
        tree: MapTree,
        onStability?: SimCallback,
        onTick?: SimCallback
    }) {
        super()
        const layers = treeToSimulation(tree)
        this.layers = layers.map(({ key, nodes, links }, index) => {
            const newMap = new MapDThreeIterator(key, nodes, links)
            newMap.setCallbacks(this.cascade(index).bind(this), this.checkStability.bind(this))
            return newMap
        })
        this.setCallbacks({ onTick, onStability })
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
                const layerUpdateResult = layerToUpdate.update(currentNodes, incomingLayer.links, forceRestart)
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
    endDrag(): void {
        this.layers.forEach((layer) => { layer.endDrag() })
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
                    if (index === this.layers.length - 1) {
                        this.onTick(this.nodes)
                    }
                    else {
                        const nodesByRoomId = this.layers[index].nodes.reduce<Record<string, SimNode>>((previous, node) => ({ ...previous, [node.roomId]: node }), {})
                        this.layers[index + 1].cascade(nodesByRoomId)
                    }    
                }
            })
        }
    }
}

export type { SimNode }
export default MapDThree