import {
    SimulationLinkDatum,
    Simulation,
} from 'd3-force'
import { SimCallback, MapNodes, MapLinks, SimNode, SimulationReturn } from './baseClasses'
import MapDThreeIterator from './MapDThreeIterator'
import { GenericTree, GenericTreeDiff, GenericTreeDiffAction, GenericTreeDiffNode, GenericTreeNode } from '@tonylb/mtw-sequence/dist/tree/baseClasses'
import { diffTrees } from '@tonylb/mtw-sequence/dist/tree/diff'

export type SimulationTreeNode = SimulationReturn & {
    visible: boolean;
}

type MapDThreeTreeProps = {
    tree: GenericTree<SimulationTreeNode>;
    onStabilize?: SimCallback;
    onTick?: SimCallback;
}

type MapDThreeDFSReduce<O> = {
    output: O[];
    leadingLayer?: number;
    leadingInvisibleLayer?: number;
}

//
// MapDFSWalk converts the tree into a depth-first-sequence of layers, appending
// data about which previous layer each layer should look to in order to gather cascading
// node positions
//
export class MapDFSWalk<O> {
    _leadingLayer: number;
    _leadingInvisibleLayer: number;
    _callback: (value: { data: SimulationReturn; previousLayer: number; action: GenericTreeDiffAction }, output: O[]) => O[];
    constructor(callback: (value: { data: SimulationReturn; previousLayer: number; action: GenericTreeDiffAction }, output: O[]) => O[]) {
        this._callback = callback
    }

    _walkHelper(
        options: { invisible?: boolean }
    ): (previous: MapDThreeDFSReduce<O>, layer: GenericTreeDiffNode<SimulationTreeNode>) => MapDThreeDFSReduce<O> {
        return (previous, layer) => {
            const invisible = options.invisible || (!layer.data.visible)
            let nodeOutput = previous
            if (layer.data.nodes.length > 0) {
                const { visible, ...rest } = layer.data
                //
                // If you're in a nested invisible section, your siblings will be listed in leadingInvisibleLayer,
                // otherwise you should hark back to the most recent visible layer (even if the node itself is
                // freshly invisible)
                //
                const previousLayer = (options.invisible ? previous.leadingInvisibleLayer : undefined) ?? previous.leadingLayer
                const newItems = this._callback({ data: rest, previousLayer, action: layer.action }, previous.output)
                const output = [
                    ...previous.output,
                    ...newItems
                ]
                nodeOutput = {
                    ...previous,
                    output,
                    //
                    // Update running track of invisible layer (for independent cascade of invisible branches) and visible layer
                    // (for the cascade of everything visible, ignoring invisible)
                    //
                    ...(invisible ? { leadingInvisibleLayer: output.length - 1 } : { leadingInvisibleLayer: undefined, leadingLayer: output.length - 1 })
                }
            }
            return layer.children.reduce(this._walkHelper({ invisible }), nodeOutput)
        }
    }

    walk(tree: GenericTreeDiff<SimulationTreeNode>)  {
        const { output, leadingLayer: cascadeIndex } = tree.reduce<MapDThreeDFSReduce<O>>(this._walkHelper({}), { output: [] })
        return { output, cascadeIndex }
    }
}

//
// TODO: ISS3230: Refactor incoming properties to accept a tree of SimulationReturns, with
// added visible property
//
export class MapDThreeTree extends Object {
    layers: MapDThreeIterator[] = []
    stable: boolean = true
    onStability: SimCallback = () => {}
    onTick: SimCallback = () => {}
    _tree: GenericTree<SimulationTreeNode> = [];
    _cascadeIndex?: number;

    constructor(props: MapDThreeTreeProps) {
        super(props)
        const {
            tree,
            onStabilize,
            onTick
        } = props
        //
        // TODO: ISS3228: Refactor construction of MapDThree layers
        //
        this.layers = []
        this.setCallbacks({ onTick, onStability: onStabilize })
        this.update(tree)
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
    update(tree: GenericTree<SimulationTreeNode>): void {
        const incomingDiff = diffTrees({
            compare: ({ key: keyA }: SimulationTreeNode, { key: keyB }: SimulationTreeNode) => (keyA === keyB),
            extractProperties: ({ key, nodes, links }): SimulationReturn => ({ key, nodes, links }),
            rehydrateProperties: (baseValue, properties) => (Object.assign(baseValue, ...properties)),
            verbose: true
        })(this._tree, tree)

        //
        // Use _dfsWalk on the tree diff, handling Add, Delete and Set actions on Rooms, Exits, and Layers.
        //
        let nextLayerIndex = 0
        const dfsWalker = new MapDFSWalk(({ data, previousLayer, action }, outputLayers: MapDThreeIterator[]) => {
            //
            // Add appropriate callbacks based on previousLayer information
            //
            const cascadeCallback = (typeof previousLayer === 'undefined' || previousLayer >= outputLayers.length - 1)
                ? () => {}
                : () => (outputLayers[previousLayer].nodes)
            switch(action) {
                case GenericTreeDiffAction.Context:
                case GenericTreeDiffAction.Exclude:
                    if (this.layers[nextLayerIndex].key !== data.key) {
                        throw new Error(`Unaligned diff node (${this.layers[nextLayerIndex].key} vs. ${data.key})`)
                    }
                    this.layers[nextLayerIndex].setCallbacks(
                        cascadeCallback,
                        //
                        // TODO: Does onStabilize need to be reset?
                        //
                        () => {}
                    )
                    return [this.layers[nextLayerIndex++]]
                case GenericTreeDiffAction.Delete:
                    if (this.layers[nextLayerIndex].key !== data.key) {
                        throw new Error(`Unaligned diff node (${this.layers[nextLayerIndex].key} vs. ${data.key})`)
                    }
                    this.layers[nextLayerIndex].simulation.stop()
                    nextLayerIndex++
                    return []
                case GenericTreeDiffAction.Add:
                    const addedIterator = new MapDThreeIterator(
                        data.key,
                        data.nodes,
                        data.links,
                    )
                    addedIterator.setCallbacks(
                        cascadeCallback,
                        this.checkStability.bind(this)
                    )
                    return [addedIterator]
                case GenericTreeDiffAction.Set:
                    this.layers[nextLayerIndex].update(data.nodes, data.links, true)
                    this.layers[nextLayerIndex].setCallbacks(
                        cascadeCallback,
                        this.checkStability.bind(this)
                    )
                    return [this.layers[nextLayerIndex++]]
            }
        })
        const { output, cascadeIndex } = dfsWalker.walk(incomingDiff)
        this.layers = output
        this._cascadeIndex = cascadeIndex
        this._tree = tree
        this.layers.forEach((layer, index) => {
            layer.setCallbacks(this.cascade(index).bind(this), this.checkStability.bind(this))
        })
        this.checkStability()
        
        // const previousNodesByRoomId = this.nodes.reduce<Record<string, SimNode>>((accumulator, node) => {
        //     return {
        //         ...accumulator,
        //         [node.roomId]: node
        //     }
        // }, {})
        // type PreviousLayerRecords = Record<string, { found: boolean; index: number, simulation: Simulation<SimNode, SimulationLinkDatum<SimNode>> }>
        // const previousLayersByKey = this.layers.reduce<PreviousLayerRecords>((previous, { key, simulation }, index) => ({ ...previous, [key]: { index, found: false, simulation } }), {})

        // let forceRestart = false

        // type IncomingLayersReduce = {
        //     layers: MapDThreeIterator[];
        //     previousLayersByKey: PreviousLayerRecords;
        // }
        // const { layers: newLayers, previousLayersByKey: processedLayers } = layers.reduce<IncomingLayersReduce>((previous, incomingLayer, index) => {

        //     //
        //     // Find where (if at all) this layer is positioned in current data
        //     //

        //     const previousIndex = previousLayersByKey[incomingLayer.key]?.index

        //     //
        //     // Map existing positions (where known) onto incoming nodes
        //     //

        //     const currentNodes = incomingLayer.nodes.map((node) => {
        //         if (previousNodesByRoomId[node.roomId]) {
        //             if (node.cascadeNode) {
        //                 return {
        //                     ...node,
        //                     fx: previousNodesByRoomId[node.roomId].x,
        //                     fy: previousNodesByRoomId[node.roomId].y,
        //                 }    
        //             }
        //             else {
        //                 return {
        //                     ...node,
        //                     x: previousNodesByRoomId[node.roomId].x,
        //                     y: previousNodesByRoomId[node.roomId].y,
        //                 }    
        //             }
        //         }
        //         return node
        //     })

        //     //
        //     // Apply create or update, and check whether forceRestart needs to be set
        //     //

        //     if (previousIndex !== undefined) {
        //         const layerToUpdate = this.layers[previousIndex]
        //         if (previousIndex !== index) {
        //             forceRestart = true
        //         }
        //         const layerUpdateResult = layerToUpdate.update(currentNodes, incomingLayer.links, forceRestart, previous.layers.length > 0 ? () => previous.layers[previous.layers.length-1].nodes : () => []) ?? false
        //         forceRestart = forceRestart || layerUpdateResult

        //         return {
        //             layers: [
        //                 ...previous.layers,
        //                 this.layers[previousIndex]
        //             ],
        //             previousLayersByKey: {
        //                 ...previous.previousLayersByKey,
        //                 [incomingLayer.key]: {
        //                     ...previous.previousLayersByKey[incomingLayer.key],
        //                     found: true
        //                 }
        //             }
        //         }
        //     }

        //     //
        //     // If no match, you have a new layer (which needs to be created) and which should
        //     // cause a forceRestart cascade
        //     //

        //     forceRestart = true
        //     return {
        //         layers: [
        //             ...previous.layers,
        //             new MapDThreeIterator(
        //                 incomingLayer.key,
        //                 incomingLayer.nodes,
        //                 incomingLayer.links
        //             )
        //         ],
        //         previousLayersByKey: previous.previousLayersByKey
        //     }
        // }, {
        //     layers: [],
        //     previousLayersByKey
        // })

        // //
        // // If some layers have been removed, their DThree simulation processes should be stopped.
        // //
        // Object.values(processedLayers).filter(({ found }) => (!found))
        //     .forEach(({ simulation }) => { simulation.stop() })

        // this.layers = newLayers
        // this.layers.forEach((layer, index) => {
        //     layer.setCallbacks(this.cascade(index).bind(this), this.checkStability.bind(this))
        // })
        // this.checkStability()
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

    cascade(startingIndex: number) {
        return () => {
            if (startingIndex < 0 || startingIndex >= this.layers.length ) {
                throw new Error('MapDThree cascade index out of bounds')
            }
            //
            // If cascading off of the final visible layer of the simulation, deliver to simulation onTick
            //
            if (this._cascadeIndex >= startingIndex && this.layers.length > this._cascadeIndex) {
                this.onTick(this.layers[this._cascadeIndex].nodes)
            }
        }
    }

    unmount() {
        this.layers.forEach((layer) => {
            layer.simulation.stop()
        })
    }
}

export default MapDThreeTree
