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
// mapDFSWalk converts the tree into a depth-first-sequence of layer-arguments for
// MapDThreeIterator, including data about which previous layers are legitimate
// sources of cascading information for nodes (given the relationship of the
// current node to other layers and their visibility).
//
export const mapDFSWalk = <O>(callback: (value: { data: SimulationTreeNode; previousLayers: number[]; action: GenericTreeDiffAction }, output: O[]) => O[]) => 
        (tree: GenericTreeDiff<SimulationTreeNode>) => {
    const output = dfsWalk<SimulationTreeNode & { action: GenericTreeDiffAction }, O[], { previousLayers: number[], previousInvisibleLayers?: number[]; visible: boolean }>({
        default: { output: [], state: { previousLayers: [], previousInvisibleLayers: [], visible: true } },
        callback: (previous, data) => {
            if (data.nodes.length > 0) {
                const { action, ...rest } = data
                const previousLayers = previous.state.visible ? previous.state.previousLayers : previous.state.previousInvisibleLayers
                const newLayers = callback({ data: rest, previousLayers, action }, previous.output)
                const newPreviousLayers = [
                    ...previousLayers,
                    ...newLayers.map((_, index) => (index + previousLayers.length))
                ]
                return {
                    output: [...previous.output, ...newLayers],
                    state: previous.state.visible && data.visible
                        ? { ...previous.state, previousLayers: newPreviousLayers }
                        : { ...previous.state, previousInvisibleLayers: newPreviousLayers }
                }
            }
            else {
                return previous
            }
        },
        nest: ({ state, data }) => {
            if (!data.visible) {
                return {
                    ...state,
                    visible: false,
                    previousInvisibleLayers: state.previousInvisibleLayers ?? state.previousLayers
                }
            }
            return state
        },
        unNest: ({ previous, state, data }) => {
            return {
                ...state,
                visible: previous.visible,
                previousInvisibleLayers: previous.visible ? undefined : state.previousInvisibleLayers
            }
        },
    })(foldDiffTree(tree))
    return output
}

type MapDThreeTreeNode = {
    index: number;
    node: SimNode;
}
type MapDThreeTreeLink = {
    index: number;
    link: MapLinks;
}
export class MapDThreeTree extends Object {
    layers: MapDThreeIterator[] = [];
    stable: boolean = true;
    onStability: SimCallback = () => {};
    onTick: SimCallback = () => {};
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
            extractProperties: ({ key, nodes, links, visible }): SimulationReturn & { visible: boolean } => ({ key, nodes, links, visible }),
            rehydrateProperties: (baseValue, properties) => (Object.assign(baseValue, ...properties)),
            verbose: true
        })(this._tree, tree)

        //
        // Use mapDFSWalk on the tree diff, handling Add, Delete and Set actions on Rooms, Exits, and Layers.
        //
        let nextLayerIndex = 0
        const output = mapDFSWalk(({ data, previousLayers, action }, outputLayers: MapDThreeIterator[]) => {
            //
            // Add appropriate callbacks based on previous layers information
            //
            const cascadeCallback = () => ([])
            // const cascadeCallback = (typeof previousLayer === 'undefined' || previousLayer >= outputLayers.length - 1)
            //     ? () => {}
            //     : () => (outputLayers[previousLayer].nodes)
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
        this._tree = tree
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
