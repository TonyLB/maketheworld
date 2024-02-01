import { SimCallback, MapLinks, SimNode, SimulationReturn } from './baseClasses'
import MapDThreeIterator from './MapDThreeIterator'
import { GenericTree, GenericTreeDiff, GenericTreeDiffAction } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses'
import { diffTrees, foldDiffTree } from '@tonylb/mtw-wml/dist/sequence/tree/diff'
import dfsWalk from '@tonylb/mtw-wml/dist/sequence/tree/dfsWalk'
import { unique } from '../../../../lib/lists'
import { SimulationLinkDatum } from 'd3-force'

export type SimulationTreeNode = SimulationReturn & {
    visible: boolean;
}

type MapDThreeTreeProps = {
    tree: GenericTree<SimulationTreeNode>;
    onStabilize?: SimCallback;
    onTick?: SimCallback;
}

type MapDFSActionDelete = {
    type: 'delete';
    index: number;
}

type MapDFSActionRetain = {
    type: 'retain';
    index: number;
    getCascadeNodes: () => (SimNode & { layers: number[] })[];
}

type MapDFSActionAdd = {
    type: 'add';
    iterator: MapDThreeIterator;
}

type MapDFSActionUpdate = {
    type: 'update';
    index: number;
    nodes: SimNode[];
    links: {
        index?: number;
        id: string;
        source: string;
        target: string;
    }[];
    getCascadeNodes: () => (SimNode & { layers: number[] })[];
}

type MapDFSAction = MapDFSActionAdd | MapDFSActionDelete | MapDFSActionRetain | MapDFSActionUpdate

type MapDFSWalkCallbackReduce = {
    output: MapDFSAction[];
    state: {
        links?: (SimulationLinkDatum<SimNode> & { id: string })[];
        previousLayers: number[];
        previousInvisibleLayers?: number[];
        visible: boolean;
        nextLayerIndex: number;
    };
}

type MapDFSWalkInnerCallbackReduceState = Omit<MapDFSWalkCallbackReduce["state"], "previousLayers" | "previousInvisibleLayers" | "visible">

type MapDFSInnerCallback = {
    (value: { data: SimulationTreeNode; previousLayers: number[]; action: GenericTreeDiffAction; state: MapDFSWalkInnerCallbackReduceState }, output: MapDThreeIterator[]): { output: MapDFSAction[]; state: MapDFSWalkInnerCallbackReduceState };
}

//
// TODO: Decouple mutation of the existing DThree structures from the processing of incoming changes:
//   - Create minimal action structures that list the exact mutations that might be requested
//   - Refactor mapDFSInnerCallbackFactory to create a reducer that returns a list of those changes
//   - Refactor mapDThreeTree.update to run the nested DFSWalk over the incoming change-tree, generate the changes, then apply them
//   - Rewrite unit tests to test each phase separately
//
const mapDFSInnerCallbackFactory =
        ({ getNodes, layers }: {
            getNodes: (layers: number[], options?: { referenceLayers?: MapDThreeIterator[] }) => (SimNode & { layers: number[] })[];
            layers: MapDThreeIterator[];
        }): MapDFSInnerCallback =>
        ({ data, previousLayers, action, state }, outputLayers) =>
    {
    //
    // Only some of the links in the state variable will be relevant to the current layer of data.
    // Extract a relevantLinks listing, so that we include only the relevant data from the running
    // aggregate at each layer.
    //
    const internalRoomIds = data.nodes.map(({ roomId }) => (roomId))
    const relevantLinks = [...(state.links ?? []), ...data.links]
        .map(({ source, ...rest }) => ({ source: typeof source === 'number' ? '' : typeof source === 'string' ? source: source.roomId, ...rest }))
        .map(({ target, ...rest }) => ({ target: typeof target === 'number' ? '' : typeof target === 'string' ? target: target.roomId, ...rest }))
        .filter(({ source, target }) => (internalRoomIds.includes(source) || internalRoomIds.includes(target)))

    //
    // Similarly, only some of the nodes that exist in previous layers need to be cascaded forward
    // to influence the nodes in *this* layer.
    // Limit cascadeCallback to the specific nodes and layers that are needed (rather
    // than cascading everything).
    //
    const getCascadeNodes = () => (getNodes(previousLayers, { referenceLayers: outputLayers }))
    const addableCascadeNodes = previousLayers
        .map((index) => (outputLayers[index].nodes))
        .flat(1)
        .reduce<Record<string, SimNode>>((previous, node) => ({
            ...previous,
            [node.roomId]: node
        }), {})
    const neededCascadeKeys = unique(relevantLinks
        .map(({ source, target }) => {
            const sourceIncluded = internalRoomIds.includes(source)
            const targetIncluded = internalRoomIds.includes(target)
            if (sourceIncluded && !targetIncluded) {
                return [target]
            }
            if (targetIncluded && !sourceIncluded) {
                return [source]
            }
            return []
        }).flat(1))
    const addedCascadeNodes = neededCascadeKeys
        .filter((key) => (key in addableCascadeNodes))
        .map((key) => ({ ...addableCascadeNodes[key], cascadeNode: true }))
    switch(action) {
        case GenericTreeDiffAction.Context:
        case GenericTreeDiffAction.Exclude:
            if (data.nodes.length + data.links.length === 0) {
                return { output: [], state }
            }
            return {
                output: [{ type: 'retain', index: state.nextLayerIndex, getCascadeNodes }],
                state: {
                    links: [ ...(state.links ?? []), ...data.links ],
                    nextLayerIndex: state.nextLayerIndex + 1
                }
            }
        case GenericTreeDiffAction.Delete:
            if (data.nodes.length + data.links.length === 0) {
                return { output: [], state }
            }
            return {
                output: [{ type: 'delete', index: state.nextLayerIndex }],
                state: {
                    links: state.links,
                    nextLayerIndex: state.nextLayerIndex + 1
                }
            }
        case GenericTreeDiffAction.Add:
            const addedIterator = new MapDThreeIterator(
                data.key,
                [...addedCascadeNodes, ...data.nodes],
                relevantLinks,
                getCascadeNodes
            )
            return {
                output: [{ type: 'add', iterator: addedIterator }],
                state: {
                    ...state,
                    links: [ ...(state.links ?? []), ...data.links ]
                }
            }
        case GenericTreeDiffAction.Set:
            if (state.nextLayerIndex >= layers.length || layers[state.nextLayerIndex].key !== data.key) {
                const addedIterator = new MapDThreeIterator(
                    data.key,
                    [...addedCascadeNodes, ...data.nodes],
                    relevantLinks,
                    getCascadeNodes
                )
                return {
                    output: [{ type: 'add', iterator: addedIterator }],
                    state: {
                        ...state,
                        links: [ ...(state.links ?? []), ...data.links ]
                    }
                }
            }
            return {
                output: [{ type: 'update', index: state.nextLayerIndex, nodes: [...addedCascadeNodes, ...data.nodes], links: relevantLinks, getCascadeNodes }],
                state: {
                    links: [ ...(state.links ?? []), ...data.links ],
                    nextLayerIndex: state.nextLayerIndex + 1
                }
            }
    }
}

const mapDFSWalkCallback = (
        callback: MapDFSInnerCallback
    ) => (
        (previous: MapDFSWalkCallbackReduce, data: SimulationTreeNode & { action: GenericTreeDiffAction }) => {
            if (data.nodes.length > 0) {
                const { action, ...rest } = data
                const { previousLayers: _, previousInvisibleLayers, visible, ...processState } = previous.state
                const previousLayers = previous.state.visible ? previous.state.previousLayers : previous.state.previousInvisibleLayers
                const { output: newLayers, state: newState } = callback({ data: rest, previousLayers, action, state: processState }, previous.output)
                const newPreviousLayers = [
                    ...previousLayers,
                    ...newLayers.map((_, index) => (index + previousLayers.length))
                ]
                return {
                    output: [...previous.output, ...newLayers],
                    state: previous.state.visible && data.visible
                        ? { ...previous.state, ...newState, previousLayers: newPreviousLayers }
                        : { ...previous.state, ...newState, previousInvisibleLayers: newPreviousLayers }
                }
            }
            else {
                return previous
            }
        }
    )

//
// mapDFSWalk converts the tree into a depth-first-sequence of layer-arguments for
// MapDThreeIterator, including data about which previous layers are legitimate
// sources of cascading information for nodes (given the relationship of the
// current node to other layers and their visibility).
//
export const mapDFSWalk = (callback: MapDFSInnerCallback) => 
        (tree: GenericTreeDiff<SimulationTreeNode>) => {
    const wrappedCallback = mapDFSWalkCallback(callback)
    const { output, state: { previousLayers } } = dfsWalk<typeof wrappedCallback>({
        default: { output: [], state: { previousLayers: [], previousInvisibleLayers: [], visible: true, nextLayerIndex: 0 } },
        callback: wrappedCallback,
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
                ...previous,
                previousLayers: state.previousLayers,
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
        const { output, visibleLayers } = mapDFSWalk(mapDFSInnerCallbackFactory({ getNodes: this.getNodes.bind(this), layers: this.layers }))(incomingDiff)
        const newLayers = output.reduce<MapDThreeIterator[]>((previous, mapAction) => {
            if (mapAction.type === 'retain') {
                const retainLayer = this.layers[mapAction.index]
                retainLayer.setCallbacks({ getCascadeNodes: mapAction.getCascadeNodes })
                return [...previous, retainLayer]
            }
            if (mapAction.type === 'delete') {
                const deleteLayer = this.layers[mapAction.index]
                deleteLayer.simulation.stop()
                return previous
            }
            if (mapAction.type === 'add') {
                return [...previous, mapAction.iterator]
            }
            if (mapAction.type === 'update') {
                const updateLayer = this.layers[mapAction.index]
                updateLayer.update(mapAction.nodes, mapAction.links, true, mapAction.getCascadeNodes)
                return [...previous, updateLayer]
            }
        }, [])
        this.layers = newLayers
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
