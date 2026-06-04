import { SimCallback, MapLinks, SimNode, SimulationReturn, MapNodes } from './baseClasses'
import MapDThreeIterator from './MapDThreeIterator'
import { Draft } from 'immer'
import { isSchemaComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { extractExitsFromStandardForm } from '../../exitExtraction'

export type SimulationTreeNode = SimulationReturn & {
    onChange: (newValue: SimulationTreeNode['nodes']) => void;
}

type MapDThreeTreeProps = {
    mapId: `MAP#${string}`;
    inherited: StandardForm;
    editable: StandardForm
    onChange: (newEditable: StandardForm | ((draft: Draft<StandardForm>) => void)) => void;
    onStabilize?: SimCallback;
    onTick?: SimCallback;
}

//
// mapTranslate converts a StandardForm and mapId into the nodes and links for a MapDThreeTree.
// It first translates all the positions in the Map component referenced by mapId into nodes.
// Then it translates all the exits on rooms referenced in the positions into links.
//
export const mapTranslate = ({
    mapId,
    standardForm
}: {
    mapId: `MAP#${string}`,
    standardForm: StandardForm
}): { nodes: MapNodes, links: MapLinks } => {
    const map = standardForm.byUniversalId[mapId]
    if (!map) {
        throw new Error(`Map ${mapId} not found in standardForm`)
    }
    if (!(map instanceof StandardMap)) {
        throw new Error(`Map ${mapId} is not a StandardMap`)
    }
    
    const nodes: MapNodes = map.positions.items.map((facet) => ({
            id: facet.reference.universalKey,
            x: facet.payload.plain?.x,
            y: facet.payload.plain?.y,
        }))
        .filter((node): node is SimNode => (Boolean(node.id && isSchemaComponentUUID(node.id) && node.id.startsWith('ROOM#'))))
    
    // Use the exitExtraction utility to get all exits from the map
    const exits = extractExitsFromStandardForm(standardForm, mapId)
    
    // Transform exits into D3.js link format
    const links: MapLinks = exits
        .filter((exit): exit is typeof exit & { to: string } => Boolean(exit.to))
        .map((exit) => ({
            id: `${exit.from}:${exit.to}`,
            source: exit.from,
            target: exit.to
        }))
    
    return { nodes, links }
}

//
// MapDThreeTree manages a simplified two-layer D3.js simulation system for map visualization.
// It handles inherited and editable layers without conditional complexity.
//
export class MapDThreeTree extends Object {
    mapId: `MAP#${string}`;
    layers: MapDThreeIterator[] = [];
    stable: boolean = true;
    onStability: SimCallback = () => {};
    onTick: SimCallback = () => {};
    _inheritedLayer: MapDThreeIterator;
    _editableLayer: MapDThreeIterator;

    constructor(props: MapDThreeTreeProps) {
        super(props)
        const {
            mapId,
            inherited,
            editable,
            onChange,
            onStabilize,
            onTick
        } = props

        const { nodes: inheritedNodes, links: inheritedLinks } = mapTranslate({
            mapId: mapId,
            standardForm: inherited
        })
        const { nodes: editableNodes, links: editableLinks } = mapTranslate({
            mapId: mapId,
            standardForm: editable
        })
        this.mapId = mapId
        this._inheritedLayer = new MapDThreeIterator('inherited', inheritedNodes, inheritedLinks, () => {}, () => ([]))
        this._editableLayer = new MapDThreeIterator('editable', editableNodes, editableLinks, () => {}, () => ([]))
        this.setCallbacks({ onTick, onStability: onStabilize })
        this.update(inherited, editable, onChange)
        this.checkStability()
    }

    get nodes(): (SimNode & { editable: boolean })[] {
        return [
            ...this._inheritedLayer.nodes
                .filter(({ id }) => (!this._editableLayer.nodes.find(({ id: editableRoomId }) => (id === editableRoomId))))
                .map((data) => ({ ...data, editable: false })),
            ...this._editableLayer.nodes
                .map((data) => ({ ...data, editable: true }))
        ]
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
    // in the incoming map definition (inherited and editable).
    //

    update(inherited: StandardForm, editable: StandardForm, onChange: (newEditable: StandardForm | ((draft: Draft<StandardForm>) => void)) => void): void {
        const { nodes: inheritedNodes, links: inheritedLinks } = mapTranslate({
            mapId: this.mapId,
            standardForm: inherited
        })
        const { nodes: editableNodes, links: editableLinks } = mapTranslate({
            mapId: this.mapId,
            standardForm: editable
        })
        this._inheritedLayer.update(inheritedNodes, inheritedLinks, false, () => {}, () => ([]))
        this._editableLayer.update(editableNodes, editableLinks, false, () => {}, () => ([]))

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
                ...(layer.nodes.reduce<Record<string, SimNode>>((previous, { id, ...rest }) => ({ ...previous, [id]: { id, ...rest } }), {}))
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
        const relevantLayers = this.layers.filter(({ nodes }) => (nodes.find((node) => (node.id === roomId))))
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
