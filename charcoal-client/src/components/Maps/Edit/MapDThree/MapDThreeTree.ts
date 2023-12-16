import { SimCallback, MapLinks, SimNode, SimulationReturn } from './baseClasses'
import MapDThreeIterator from './MapDThreeIterator'
import { GenericTree, GenericTreeDiff, GenericTreeDiffAction } from '@tonylb/mtw-sequence/dist/tree/baseClasses'
import { diffTrees, foldDiffTree } from '@tonylb/mtw-sequence/dist/tree/diff'
import dfsWalk from '@tonylb/mtw-sequence/dist/tree/dfsWalk'

export type SimulationTreeNode = SimulationReturn & {
    visible: boolean;
}

type MapDThreeTreeProps = {
    tree: GenericTree<SimulationTreeNode>;
    onStabilize?: SimCallback;
    onTick?: SimCallback;
}

//
// mapDFSWalk converts the tree into a depth-first-sequence of layers, appending
// data about which previous layer each layer should look to in order to gather cascading
// node positions
//
export const mapDFSWalk = <O>(callback: (value: { data: SimulationTreeNode; previousLayer: number; action: GenericTreeDiffAction }, output: O[]) => O[]) => 
        (tree: GenericTreeDiff<SimulationTreeNode>) => {
    const { output, state } = dfsWalk<SimulationTreeNode & { action: GenericTreeDiffAction }, O[], { leadingLayer?: number; leadingInvisibleLayer?: number; invisible?: boolean }>({
        default: { output: [], state: {} },
        callback: (previous, data) => {
            if (data.nodes.length > 0) {
                const { action, ...rest } = data
                const invisible = previous.state.invisible || (!data.visible)
                //
                // If you're in a nested invisible section, your siblings will be listed in leadingInvisibleLayer,
                // otherwise you should hark back to the most recent visible layer (even if the node itself is
                // freshly invisible)
                //
                const previousLayer = (previous.state.invisible ? previous.state.leadingInvisibleLayer : undefined) ?? previous.state.leadingLayer
                return {
                    output: [...previous.output, ...callback({ data: rest, previousLayer, action }, previous.output)],
                    state: {
                        ...previous.state,
                        ...(invisible ? { leadingInvisibleLayer: previous.output.length } : { leadingInvisibleLayer: undefined, leadingLayer: previous.output.length })
                    }
                }
            }
            else {
                return previous
            }
        },
        nest: ({ state, data: { visible } }) => ({ ...state, invisible: state.invisible || !visible }),
        unNest: ({ previous, state }) => ({ ...state, invisible: previous.invisible }),
        returnVerbose: true
    })(foldDiffTree(tree))
    return { output, cascadeIndex: state.leadingLayer }
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
        // Use mapDFSWalk on the tree diff, handling Add, Delete and Set actions on Rooms, Exits, and Layers.
        //
        let nextLayerIndex = 0
        const { output, cascadeIndex } = mapDFSWalk(({ data, previousLayer, action }, outputLayers: MapDThreeIterator[]) => {
            //
            // Add appropriate callbacks based on previousLayer information
            //
            const cascadeCallback = (typeof previousLayer === 'undefined' || previousLayer >= outputLayers.length - 1)
                ? () => {}
                : () => (outputLayers[previousLayer].nodes)
            switch(action) {
                case GenericTreeDiffAction.Context:
                case GenericTreeDiffAction.Exclude:
                    if (data.nodes.length + data.links.length === 0) {
                        return []
                    }
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
                    if (data.nodes.length + data.links.length === 0) {
                        return []
                    }
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
                    if (nextLayerIndex >= this.layers.length || this.layers[nextLayerIndex].key !== data.key) {
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
                    }
                    this.layers[nextLayerIndex].update(data.nodes, data.links, true)
                    this.layers[nextLayerIndex].setCallbacks(
                        cascadeCallback,
                        this.checkStability.bind(this)
                    )
                    return [this.layers[nextLayerIndex++]]
            }
        })(incomingDiff)
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
        //
        // TODO: Drag *only* the specific selection
        //
        const relevantLayers = this.layers.filter(({ nodes }) => (nodes.find((node) => (node.roomId === roomId))))
        relevantLayers.forEach((layer) => { layer.dragNode({ roomId, x, y }) })
        if (relevantLayers.length) {
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
