import {
    SimulationLinkDatum,
    Simulation,
} from 'd3-force'
import { SimCallback, MapNodes, MapLinks, SimNode, SimulationReturn } from './baseClasses'
import MapDThreeIterator from './MapDThreeIterator'
import { GenericTree, GenericTreeNode } from '@tonylb/mtw-sequence/dist/tree/baseClasses';

//
// MapDFSWalk converts the tree into a depth-first-sequence of layers, appending
// data about which previous layer each layer should look to in order to gather cascading
// node positions
//
export class MapDFSWalk {
    _leadingLayer: number;
    _leadingInvisibleLayer: number;

    _walkHelper(
        options: {
            invisible?: boolean;
            callback: (value: { item: SimulationReturn; previousLayer: number; }) => MapDThreeDFSOutput[]
        }
    ): (previous: MapDThreeDFSReduce, layer: GenericTreeNode<SimulationTreeNode>) => MapDThreeDFSReduce {
        return (previous, layer) => {
            const invisible = options.invisible || (!layer.data.visible)
            const nextLayerIndex = previous.output.length
            let nodeOutput = previous
            if (layer.data.nodes.length > 0) {
                const { visible, ...rest } = layer.data
                //
                // If you're in a nested invisible section, your siblings will be listed in leadingInvisibleLayer,
                // otherwise you should hark back to the most recent visible layer (even if the node itself is
                // freshly invisible)
                //
                const previousLayer = (options.invisible ? previous.leadingInvisibleLayer : undefined) ?? previous.leadingLayer
                nodeOutput = {
                    ...previous,
                    output: [
                        ...previous.output,
                        {
                            data: rest,
                            previousLayer
                        }
                    ],
                    //
                    // Update running track of invisible layer (for independent cascade of invisible branches) and visible layer
                    // (for the cascade of everything visible, ignoring invisible)
                    //
                    ...(invisible ? { leadingInvisibleLayer: nextLayerIndex } : { leadingInvisibleLayer: undefined, leadingLayer: nextLayerIndex })
                }
            }
            return layer.children.reduce(this._walkHelper({ invisible, callback: options.callback }), nodeOutput)
        }
    }

    walk(tree: GenericTree<SimulationTreeNode>, callback: (value: { item: SimulationReturn; previousLayer: number; }) => MapDThreeDFSOutput[])  {
        const { output, leadingLayer: cascadeIndex } = tree.reduce<MapDThreeDFSReduce>(this._walkHelper({ callback }), { output: [] })
        return { output, cascadeIndex }
    }
}

//
// TODO: ISS3230: Refactor incoming properties to accept a tree of SimulationReturns, with
// added visible property
//
export type SimulationTreeNode = SimulationReturn & {
    visible: boolean;
}

type MapDThreeTreeProps = {
    layers: SimulationTreeNode[];
    onStabilize?: SimCallback;
    onTick?: SimCallback;
}

type MapDThreeDFSOutput = {
    data: SimulationReturn;
    previousLayer?: number;
}

type MapDThreeDFSReduce = {
    output: MapDThreeDFSOutput[];
    leadingLayer?: number;
    leadingInvisibleLayer?: number;
}

export class MapDThreeTree extends Object {
    layers: MapDThreeIterator[] = []
    stable: boolean = true
    onStability: SimCallback = () => {}
    onTick: SimCallback = () => {}

    constructor(props: MapDThreeTreeProps) {
        super(props)
        const {
            layers,
            onStabilize,
            onTick
        } = props
        //
        // TODO: ISS3228: Refactor construction of MapDThree layers
        //
        this.layers = layers.map(({ key, nodes, links }, index) => {
            //
            // TODO: ISS3228: Refactor getCascadeNodes function to do a more sophisticated search through the
            // DFS ordering of the internal tree of layers.
            //
            const newMap = new MapDThreeIterator(key, nodes, links, index > 0 ? () => (this.layers[index-1].nodes) : () => [])
            newMap.setCallbacks(this.cascade(index).bind(this), this.checkStability.bind(this))
            return newMap
        })
        this.setCallbacks({ onTick, onStability: onStabilize })
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
    get links(): MapLinks {
        return this.layers.reduce<MapLinks>((previous, { links }) => ([ ...previous, ...links ]), [] as MapLinks)
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
    update(layers: SimulationReturn[]): void {
        //
        // TODO: Refactor _dfsSequence as _dfsWalk, with a callback rather than a return sequence.
        //

        //
        // TODO: Record the current tree type in the class instance
        //

        //
        // TODO: Use tree diff on the incoming tree (compared to the recorded tree) without filtering Exclude
        // action types.
        //

        //
        // TODO: Use _dfsWalk on the tree diff, handling Add, Delete and Set actions on Rooms, Exits, and Layers.
        //
        
        const previousNodesByRoomId = this.nodes.reduce<Record<string, SimNode>>((accumulator, node) => {
            return {
                ...accumulator,
                [node.roomId]: node
            }
        }, {})
        type PreviousLayerRecords = Record<string, { found: boolean; index: number, simulation: Simulation<SimNode, SimulationLinkDatum<SimNode>> }>
        const previousLayersByKey = this.layers.reduce<PreviousLayerRecords>((previous, { key, simulation }, index) => ({ ...previous, [key]: { index, found: false, simulation } }), {})

        let forceRestart = false

        type IncomingLayersReduce = {
            layers: MapDThreeIterator[];
            previousLayersByKey: PreviousLayerRecords;
        }
        const { layers: newLayers, previousLayersByKey: processedLayers } = layers.reduce<IncomingLayersReduce>((previous, incomingLayer, index) => {

            //
            // Find where (if at all) this layer is positioned in current data
            //

            const previousIndex = previousLayersByKey[incomingLayer.key]?.index

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
                const layerUpdateResult = layerToUpdate.update(currentNodes, incomingLayer.links, forceRestart, previous.layers.length > 0 ? () => previous.layers[previous.layers.length-1].nodes : () => []) ?? false
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
    // cascade takes positions from the layer tree and cascades them forward to layers that inherit that
    // position data.  Inheritance is calculated as follows:
    //   - Sequential in Depth-First-Search sequence, EXCEPT
    //   - Non-visible nodes inherit data (to keep themselves up to date) but do not pass on their
    //     own data to visible nodes
    //

    //
    // TODO: ISS-3230: Refactor cascade to respect the new design, above.
    //
    cascade(startingIndex: number) {
        return () => {
            if (startingIndex < 0 || startingIndex >= this.layers.length ) {
                throw new Error('MapDThree cascade index out of bounds')
            }
            this.layers.forEach((layer, index) => {
                if (index >= startingIndex) {
                    //
                    // If cascading off of the final layer of the simulation, deliver to simulation onTick
                    //
                    if (index === this.layers.length - 1) {
                        this.onTick(this.nodes)
                    }
                }
            })
        }
    }

    unmount() {
        this.layers.forEach((layer) => {
            layer.simulation.stop()
        })
    }
}

export default MapDThreeTree
