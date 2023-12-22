import { SimCallback, MapLinks, SimNode, SimulationReturn } from './baseClasses'
import MapDThreeIterator from './MapDThreeIterator'
import { GenericTree, GenericTreeDiff, GenericTreeDiffAction } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses'
import { diffTrees, foldDiffTree } from '@tonylb/mtw-wml/dist/sequence/tree/diff'
import dfsWalk from '@tonylb/mtw-wml/dist/sequence/tree/dfsWalk'
import { unique } from '../../../../lib/lists'

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
export const mapDFSWalk = <O, State extends {}>(callback: (value: { data: SimulationTreeNode; previousLayers: number[]; action: GenericTreeDiffAction; state: Partial<State> }, output: O[]) => O[]) => 
        (tree: GenericTreeDiff<SimulationTreeNode>) => {
    const { output, state: { previousLayers } } = dfsWalk<SimulationTreeNode & { action: GenericTreeDiffAction }, O[], Partial<State> & { previousLayers: number[], previousInvisibleLayers?: number[]; visible: boolean }>({
        default: { output: [], state: { previousLayers: [], previousInvisibleLayers: [], visible: true } as Partial<State> & { previousLayers: number[], previousInvisibleLayers?: number[]; visible: boolean } },
        callback: (previous, data) => {
            if (data.nodes.length > 0) {
                const { action, ...rest } = data
                const { previousLayers: _, previousInvisibleLayers, visible, ...processState } = previous.state
                const previousLayers = previous.state.visible ? previous.state.previousLayers : previous.state.previousInvisibleLayers
                const newLayers = callback({ data: rest, previousLayers, action, state: processState as unknown as Partial<State> }, previous.output)
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
        returnVerbose: true
    })(foldDiffTree(tree))
    return { output, visibleLayers: previousLayers }
}

export class MapDThreeTree extends Object {
    layers: MapDThreeIterator[] = [];
    stable: boolean = true;
    onStability: SimCallback = () => {};
    onTick: SimCallback = () => {};
    _tree: GenericTree<SimulationTreeNode> = [];
    _cascadeIndex?: number;
    _visibleLayers: number[] = [];

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
    // An aggregator that decodes the nodes for a certain set of layers, and delivers it in readable format.
    //
    getNodes(layers: number[], options: { referenceLayers?: MapDThreeIterator[] } = {}): (SimNode & { layers: number[] })[] {
        return layers.reduceRight<(SimNode & { layers: number[] })[]>((previous, layerIndex) => {
            const layer = (options.referenceLayers ?? this.layers)[layerIndex]
            return (layer.nodes || [])
                .reduce<(SimNode & { layers: number[] })[]>((accumulator, node) => {
                    const previousNode = accumulator.find(({ id }) => (id === node.id))
                    return [
                        ...accumulator.filter(({ id }) => (id !== node.id)),
                        { ...node, layers: [layerIndex, ...(previousNode?.layers ?? [])] }
                    ]
                }, previous)
        }, [])
    }

    get nodes(): (SimNode & { layers: number[] })[] {
        return this.getNodes(this._visibleLayers)
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
        const { output, visibleLayers } = mapDFSWalk(({ data, previousLayers, action }, outputLayers: MapDThreeIterator[]) => {
            //
            // Add appropriate callbacks based on previous layers information
            //

            //
            // Limit cascadeCallback to the specific nodes and layers that are needed in cascade (rather
            // than cascading everything).
            //
            const getCascadeNodes = () => (this.getNodes(previousLayers, { referenceLayers: outputLayers }))
            const addableCascadeNodes = previousLayers
                .map((index) => (outputLayers[index].nodes))
                .flat(1)
                .reduce<Record<string, SimNode>>((previous, node) => ({
                    ...previous,
                    [node.roomId]: node
                }), {})
            const internalRoomIds = data.nodes.map(({ roomId }) => (roomId))
            const neededCascadeKeys = unique(data.links
                .map(({ source, target }) => {
                    const sourceRoomId = typeof source === 'number' ? '' : typeof source === 'string' ? source : source.roomId
                    const targetRoomId = typeof target === 'number' ? '' : typeof target === 'string' ? target : target.roomId
                    const sourceIncluded = internalRoomIds.includes(sourceRoomId)
                    const targetIncluded = internalRoomIds.includes(targetRoomId)
                    if (sourceIncluded && !targetIncluded) {
                        return [targetRoomId]
                    }
                    if (targetIncluded && !sourceIncluded) {
                        return [sourceRoomId]
                    }
                    return []
                }).flat(1))
            const addedCascadeNodes = neededCascadeKeys
                .filter((key) => (key in addableCascadeNodes))
                .map((key) => (addableCascadeNodes[key]))
            switch(action) {
                case GenericTreeDiffAction.Context:
                case GenericTreeDiffAction.Exclude:
                    if (data.nodes.length + data.links.length === 0) {
                        return []
                    }
                    if (this.layers[nextLayerIndex].key !== data.key) {
                        throw new Error(`Unaligned diff node (${this.layers[nextLayerIndex].key} vs. ${data.key})`)
                    }
                    this.layers[nextLayerIndex].setCallbacks({ getCascadeNodes })
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
                        [...addedCascadeNodes, ...data.nodes],
                        data.links,
                        getCascadeNodes
                    )
                    return [addedIterator]
                case GenericTreeDiffAction.Set:
                    if (nextLayerIndex >= this.layers.length || this.layers[nextLayerIndex].key !== data.key) {
                        const addedIterator = new MapDThreeIterator(
                            data.key,
                            [...addedCascadeNodes, ...data.nodes],
                            data.links,
                        )
                        addedIterator.setCallbacks({ getCascadeNodes })
                        return [addedIterator]
                    }
                    this.layers[nextLayerIndex].update([...addedCascadeNodes, ...data.nodes], data.links, true, getCascadeNodes)
                    return [this.layers[nextLayerIndex++]]
            }
        })(incomingDiff)
        this.layers = output
        this._visibleLayers = visibleLayers
        this._tree = tree
        this.layers.forEach((layer) => {
            layer.setCallbacks({
                onTick: () => {},
                onStability: this.checkStability.bind(this)
            })
        })
        if (visibleLayers.length) {
            this.layers[visibleLayers.slice(-1)[0]].setCallbacks({ onTick: this.cascade.bind(this) })
        }
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

    cascade() {
        this.onTick(this.nodes)
    }

    unmount() {
        this.layers.forEach((layer) => {
            layer.simulation.stop()
        })
    }
}

export default MapDThreeTree
