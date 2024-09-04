import { SimCallback, MapLinks, SimNode, SimulationReturn, MapNodes } from './baseClasses'
import MapDThreeIterator from './MapDThreeIterator'
import { GenericTree, GenericTreeDiff, GenericTreeDiffAction, GenericTreeNode, treeNodeTypeguard } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { diffTrees, foldDiffTree } from '@tonylb/mtw-wml/dist/tree/diff'
import dfsWalk from '@tonylb/mtw-wml/dist/tree/dfsWalk'
import { unique } from '../../../../lib/lists'
import { SimulationLinkDatum } from 'd3-force'
import { StandardForm } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import { isSchemaPosition, isSchemaRoom, SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { v4 as uuidv4 } from 'uuid'

export type SimulationTreeNode = SimulationReturn & {
    onChange: (newValue: SimulationTreeNode['nodes']) => void;
    visible: boolean;
}

type MapDThreeTreeProps = {
    tree: GenericTree<SchemaTag>;
    onChange: (newTree: GenericTree<SchemaTag>) => void;
    standardForm: StandardForm;
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
    key: string;
    nodes: SimNode[];
    links: {
        index?: number;
        id: string;
        source: string;
        target: string;
    }[];
    getCascadeNodes: () => (SimNode & { layers: number[] })[];
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

export type MapDFSWalkInnerCallbackReduce = {
    output: MapDFSAction[];
    state: {
        links?: (SimulationLinkDatum<SimNode> & { id: string })[];
        previousLayers: number[];
        nextLayerIndex: number;
        referenceLayers: MapNodes[];
    };
}

type MapDFSInnerCallback = {
    (previous: MapDFSWalkInnerCallbackReduce, data: { treeNode: SimulationTreeNode; action: GenericTreeDiffAction }): MapDFSWalkInnerCallbackReduce;
}

export type MapDFSWalkCallbackReduce = {
    output: MapDFSAction[];
    state: {
        links?: (SimulationLinkDatum<SimNode> & { id: string })[];
        incomingLayersFromParent: number[];
        parentVisible: boolean;
        incomingLayersFromSiblings: number[];
        nextLayerIndex: number;
        referenceLayers: MapNodes[];
    };
}


//
// TODO: Decouple mutation of the existing DThree structures from the processing of incoming changes:
//   - Rewrite nested MapDFSCallback to be a single-level callback
//   - Examine whether DFSWalk nest and unnest permit a less convoluted state structure (less number[] and more
//     direct immutable representation of the changing state)
//   - Rewrite unit tests to test each phase separately
//
const mapDFSInnerCallbackFactory =
        ({ getNodes, layers }: {
            getNodes: (layers: number[], options?: { referenceLayers?: MapNodes[] }) => (SimNode & { layers: number[] })[];
            layers: MapDThreeIterator[];
        }): MapDFSInnerCallback =>
        (previous: MapDFSWalkInnerCallbackReduce, data: { treeNode: SimulationTreeNode; action: GenericTreeDiffAction }): MapDFSWalkInnerCallbackReduce =>
{
    const { treeNode, action } = data
    const { state } = previous
    const { previousLayers, referenceLayers }  = state
    //
    // Only some of the links in the state variable will be relevant to the current layer of data.
    // Extract a relevantLinks listing, so that we include only the relevant data from the running
    // aggregate at each layer.
    //
    const internalRoomIds = data.treeNode.nodes.map(({ roomId }) => (roomId))
    const relevantLinks = [...(previous.state.links ?? []), ...data.treeNode.links]
        .map(({ source, ...rest }) => ({ source: typeof source === 'number' ? '' : typeof source === 'string' ? source: source.roomId, ...rest }))
        .map(({ target, ...rest }) => ({ target: typeof target === 'number' ? '' : typeof target === 'string' ? target: target.roomId, ...rest }))
        .filter(({ source, target }) => (internalRoomIds.includes(source) || internalRoomIds.includes(target)))

    //
    // Similarly, only some of the nodes that exist in previous layers need to be cascaded forward
    // to influence the nodes in *this* layer.
    // Limit cascadeCallback to the specific nodes and layers that are needed (rather
    // than cascading everything).
    //
    const getCascadeNodes = () => (getNodes(previousLayers, { referenceLayers }))
    const addableCascadeNodes = previousLayers
        .map((index) => (referenceLayers[index]))
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
            if (treeNode.nodes.length + treeNode.links.length === 0) {
                return { output: [], state }
            }
            return {
                output: [{ type: 'retain', index: state.nextLayerIndex, getCascadeNodes }],
                state: {
                    ...state,
                    links: [ ...(state.links ?? []), ...treeNode.links ],
                    nextLayerIndex: state.nextLayerIndex + 1,
                    referenceLayers: [...referenceLayers, treeNode.nodes]
                }
            }
        case GenericTreeDiffAction.Delete:
            if (treeNode.nodes.length + treeNode.links.length === 0) {
                return { output: [], state }
            }
            return {
                output: [{ type: 'delete', index: state.nextLayerIndex }],
                state: {
                    ...state,
                    nextLayerIndex: state.nextLayerIndex + 1,
                }
            }
        case GenericTreeDiffAction.Add:
        case GenericTreeDiffAction.Set:
            if ((action === GenericTreeDiffAction.Add) || (state.nextLayerIndex >= layers.length || layers[state.nextLayerIndex].key !== treeNode.key)) {
                return {
                    output: [{
                        type: 'add',
                        key: treeNode.key,
                        nodes: [...addedCascadeNodes, ...treeNode.nodes],
                        links: relevantLinks,
                        getCascadeNodes
                    }],
                    state: {
                        ...state,
                        links: [ ...(state.links ?? []), ...treeNode.links ],
                        referenceLayers: [...referenceLayers, [...addedCascadeNodes, ...treeNode.nodes]]
                    }
                }
            }
            return {
                output: [{ type: 'update', index: state.nextLayerIndex, nodes: [...addedCascadeNodes, ...treeNode.nodes], links: relevantLinks, getCascadeNodes }],
                state: {
                    ...state,
                    links: [ ...(state.links ?? []), ...treeNode.links ],
                    nextLayerIndex: state.nextLayerIndex + 1,
                    referenceLayers: [...referenceLayers, [...addedCascadeNodes, ...treeNode.nodes]]
                }
            }
    }
    return previous
}

const mapDFSWalkCallback = (
        callback: MapDFSInnerCallback
    ) => (
        (previous: MapDFSWalkCallbackReduce, data: SimulationTreeNode & { action: GenericTreeDiffAction }): MapDFSWalkCallbackReduce => {
            if (data.nodes.length > 0) {
                const { action, ...rest } = data
                const previousLayers = [...previous.state.incomingLayersFromParent, ...previous.state.incomingLayersFromSiblings]
                const { output: newLayers, state: newState } = callback({
                    output: previous.output,
                    state: {
                        links: previous.state.links,
                        nextLayerIndex: previous.state.nextLayerIndex,
                        referenceLayers: previous.state.referenceLayers,
                        previousLayers
                    }
                }, { treeNode: rest, action })
                const incomingLayersFromSiblings = [
                    ...previous.state.incomingLayersFromSiblings,
                    ...newLayers.filter(({ type }) => (type !== 'delete')).map((_, index) => (index + previous.output.filter(({ type }) => (type !== 'delete')).length))
                ]
                return {
                    output: [...previous.output, ...newLayers],
                    state: (previous.state.parentVisible === data.visible)
                        ? { ...previous.state, ...newState, incomingLayersFromSiblings }
                        : { ...previous.state, ...newState }
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
    const { output, state: { incomingLayersFromSiblings } } = dfsWalk<typeof wrappedCallback>({
        default: { output: [], state: { incomingLayersFromParent: [], incomingLayersFromSiblings: [], parentVisible: true, nextLayerIndex: 0, referenceLayers: [] } },
        callback: wrappedCallback,
        nest: ({ state, data }) => {
            return {
                ...state,
                parentVisible: state.parentVisible && data.visible,
                incomingLayersFromParent: [...state.incomingLayersFromParent, ...state.incomingLayersFromSiblings],
                incomingLayersFromSiblings: []
            }
        },
        unNest: ({ previous, state, data }) => {
            if (previous.parentVisible === data.visible) {
                return {
                    ...previous,
                    incomingLayersFromSiblings: [...previous.incomingLayersFromSiblings, ...state.incomingLayersFromSiblings],
                    referenceLayers: state.referenceLayers
                }    
            }
            return { ...previous, referenceLayers: state.referenceLayers }
        },
        returnVerbose: true
    })(foldDiffTree(tree))
    return { output, visibleLayers: incomingLayersFromSiblings }
}

// const mapTreeTranslateHelper = (previous: GenericTreeNode<SimulationTreeNode>, node: GenericTreeNode<SchemaTag, TreeId>): GenericTreeNode<SimulationTreeNode> => {
//     const { data: nodeData, children } = node
//     if (isSchemaAsset(nodeData)) {
//         return children.reduce(mapTreeTranslateHelper, previous)
//     }
//     if (isSchemaCondition(nodeData)) {
//         const isSchemaConditionalContent = (data: SchemaTag): data is SchemaConditionStatementTag | SchemaConditionFallthroughTag => (isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data))
//         return {
//             ...previous,
//             children: [
//                 ...previous.children,
//                 ...children.map(({ data, children, id }) => (
//                     (isSchemaConditionalContent(data))
//                         ? mapTreeTranslate(children, id).map(({ data: internalData, ...rest }) => ({ data: { ...internalData, key: id, visible: Boolean(data.selected) }, ...rest }))
//                         : []
//                 )).flat(1)
//             ]
//         }
//     }
//     if (isSchemaRoom(nodeData)) {
//         return {
//             ...previous,
//             data: children.reduce<SimulationTreeNode>((accumulator, { data: child, id: childId }) => {
//                 if (isSchemaExit(child)) {
//                     return {
//                         ...accumulator,
//                         links: [
//                             ...accumulator.links,
//                             {
//                                 id: child.key,
//                                 source: nodeData.key,
//                                 target: child.to
//                             }
//                         ]
//                     }
//                 }
//                 else if (isSchemaPosition(child)) {
//                     return {
//                         ...accumulator,
//                         nodes: [
//                             ...accumulator.nodes,
//                             {
//                                 id: childId,
//                                 roomId: nodeData.key,
//                                 x: child.x,
//                                 y: child.y,
//                                 cascadeNode: false,
//                                 visible: previous.data.visible
//                             }
//                         ]
//                     }
//                 }
//                 else {
//                     return accumulator
//                 }
//             }, previous.data)
//         }
//     }
// }

export const mapTreeTranslate = ({ tree, onChange, standardForm, parentId = '' }: { tree: GenericTree<SchemaTag>, onChange: (newTree: GenericTree<SchemaTag>) => void, standardForm: StandardForm, parentId?: string }): GenericTree<SimulationTreeNode> => {
    //
    // Create nodes for all top-level Rooms with positions in the tree
    //
    const { nodes, onChangeMap } = tree.reduce<{ nodes: SimulationTreeNode['nodes']; onChangeMap: Record<string, number>}>((previous, node, index) => {
        if (treeNodeTypeguard(isSchemaRoom)(node)) {
            const position = node.children.find(treeNodeTypeguard(isSchemaPosition))
            if (position) {
                return {
                    ...previous,
                    nodes: [
                        ...previous.nodes,
                        {
                            id: uuidv4(),
                            x: position.data.x,
                            y: position.data.y,
                            roomId: node.data.key,
                            cascadeNode: false,
                            visible: true
                        }
                    ],
                    onChangeMap: {
                        ...previous.onChangeMap,
                        [node.data.key]: index
                    }
                }
            }
        }
        return previous
    }, { nodes: [], onChangeMap: {} })
    const topTreeNode: SimulationTreeNode = {
        key: parentId,
        nodes,
        onChange: (newPositions) => {
            //
            // TODO: Refactor onChange procedures to accept either a new argument or an immer producer function,
            // and use such a function to map incoming position changes to just updates in the nested position
            // records on each top-level room
            //
        },
        links: [],
        visible: true
    }
    return [{ data: topTreeNode, children: [] }]
}

//
// TODO: ISS4348: Refactor MapDThreeTree to accept incoming GenericTree<SchemaTag> and ignore all
// the conditional sub-trees, so that there can be a clearer through-line for onChange calls to
// send back the entire appropriate sub-tree to the sub-change function.
//
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
            standardForm,
            onChange,
            onStabilize,
            onTick
        } = props
        //
        // TODO: ISS3228: Refactor construction of MapDThree layers
        //
        this.layers = []
        this.setCallbacks({ onTick, onStability: onStabilize })
        this.update(tree, standardForm, onChange)
        this.checkStability()
    }

    //
    // An aggregator that decodes the nodes for a certain set of layers, and delivers it in readable format.
    //
    getNodes(layers: number[], options: { referenceLayers?: MapNodes[] } = {}): (SimNode & { layers: number[] })[] {
        return layers.reduceRight<(SimNode & { layers: number[] })[]>((previous, layerIndex) => {
            const layer: MapNodes = (options.referenceLayers ? options.referenceLayers[layerIndex] : this.layers[layerIndex].nodes) || []
            return layer
                .reduce<(SimNode & { layers: number[] })[]>((accumulator, node) => {
                    const previousNode = accumulator.find(({ roomId }) => (roomId === node.roomId))
                    return [
                        ...accumulator.filter(({ roomId }) => (roomId !== node.roomId)),
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

    update(tree: GenericTree<SchemaTag>, standardForm: StandardForm, onChange: (newTree: GenericTree<SchemaTag>) => void): void {

        const translatedTree = mapTreeTranslate({ tree, onChange, standardForm })
        const incomingDiff = diffTrees({
            compare: ({ key: keyA }: SimulationTreeNode, { key: keyB }: SimulationTreeNode) => (keyA === keyB),
            extractProperties: ({ key, nodes, links, visible }): SimulationReturn & { visible: boolean } => ({ key, nodes, links, visible }),
            rehydrateProperties: (baseValue, properties) => (Object.assign(baseValue, ...properties)),
            verbose: true
        })(this._tree, translatedTree)

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
                return [
                    ...previous,
                    new MapDThreeIterator(
                        mapAction.key,
                        mapAction.nodes,
                        mapAction.links,
                        mapAction.getCascadeNodes
                    )
                ]
            }
            if (mapAction.type === 'update') {
                const updateLayer = this.layers[mapAction.index]
                updateLayer.update(mapAction.nodes, mapAction.links, true, mapAction.getCascadeNodes)
                return [...previous, updateLayer]
            }
        }, [])
        this.layers = newLayers
        this._visibleLayers = visibleLayers
        this._tree = translatedTree
        this.layers.forEach((layer) => {
            layer.setCallbacks({
                onTick: () => {},
                onStability: this.checkStability.bind(this)
            })
        })
        if (visibleLayers.length) {
            this.layers[visibleLayers.slice(-1)[0]].setCallbacks({ onTick: this.cascade.bind(this) })
        }
        else {
            this.cascade()
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
