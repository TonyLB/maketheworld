import {
    SimulationNodeDatum,
    SimulationLinkDatum
} from 'd3-force';
import { Link } from 'react-router-dom';
import { NestedTreeEntry } from '../../../DraggableTree/interfaces';
import { MapTree, MapTreeEntry } from '../maps'

//
// STEP 1: Edit SimNode so that it carries a boolean saying whether (for a given simulation) the
// node is fixed or moving
//

//
// STEP 5: Remove zLevel and all lockThreshold code
//
export type SimNode = SimulationNodeDatum & {
    id: string;
    zLevel?: number;
    cascadeNode: boolean;
    roomId: string;
    visible: boolean;
}
type NodeRecord = Record<string, SimNode>
type LinkRecord = {
    id: string,
    source: string,
    target: string,
    visible?: boolean
}[]
type SimulationReturn = {
    key: string,
    nodes: SimNode[],
    links: SimulationLinkDatum<SimNode>[]
}

const simulationNodes = (treeEntry: MapTreeEntry): NodeRecord => {
    const { children = [], key, item } = treeEntry
    const childrenNodes = children.reduceRight<NodeRecord>((previous: NodeRecord, child: MapTreeEntry) => ({
        ...previous,
        ...simulationNodes(child)
    }), {})
    if (item.type === 'ROOM') {
        return {
            ...childrenNodes,
            [item.roomId]: {
                id: key,
                cascadeNode: false,
                roomId: item.roomId,
                x: item.x,
                y: item.y,
                visible: item.visible
            }
        }
    }
    else {
        return childrenNodes
    }
}

const simulationLinks = (treeEntry: MapTreeEntry): LinkRecord => {
    const { children = [], key, item } = treeEntry
    const childrenNodes = children.reduceRight<LinkRecord>((previous: LinkRecord, child: MapTreeEntry) => ([
        ...previous,
        ...simulationLinks(child)
    ]), [])
    if (item.type === 'EXIT') {
        return [
            ...childrenNodes,
            {
                id: key,
                source: item.fromRoomId,
                target: item.toRoomId,
                visible: item.visible
            }
        ]
    }
    else {
        return childrenNodes
    }
    
}

export const treeToSimulation = (tree: MapTree): SimulationReturn[] => {
    type TreeToSimReduceReturn = {
        allLinks: LinkRecord,
        layers: {
            key: string,
            nodes: NodeRecord,
            links: LinkRecord
        }[]
    }
    const simList: TreeToSimReduceReturn = tree.reduceRight<TreeToSimReduceReturn>((
            { allLinks: previousLinks, layers },
            treeEntry
        ) => {
            //
            // Mark all nodes from previous layers as being cascade nodes
            //
            const previousNodes = Object.entries((layers.length > 0) ? layers[layers.length-1].nodes : {} as NodeRecord).map<[string, SimNode]>(([key, node]) => ([key, {
                ...node,
                cascadeNode: true
            }])).reduce<NodeRecord>((previous, [key, node]) => ({ ...previous, [key]: node }), {})

            //
            // Combine nodes from this layer into the NodeRecord
            //
            const layerNodes = simulationNodes(treeEntry)
            const combinedNodes = { ...previousNodes, ...layerNodes }

            //
            // Links are filtered so that a given exit can only effect either (a) rooms defined on the same
            // layer, or (b) rooms defined on later layers.  No looping back into the "past"
            //
            const allLinks: LinkRecord = [
                ...previousLinks,
                ...simulationLinks(treeEntry)
            ]
            const layerLinks = allLinks
                .filter(({ source, target }) => (combinedNodes[source] && combinedNodes[target] && !(combinedNodes[source].cascadeNode && combinedNodes[target].cascadeNode)))
                .map(({ source, target, ...rest }) => ({ ...rest, source: combinedNodes[source].id, target: combinedNodes[target].id }))
            return {
                allLinks,
                layers: [
                    ...layers,
                    {
                        key: treeEntry.key,
                        nodes: combinedNodes,
                        links: layerLinks
                    }
                ]
            }
        }, { allLinks: [], layers: [] })

    return simList.layers.map<SimulationReturn>(({ key, nodes, links }) => ({ key, nodes: Object.values(nodes), links }))
}

export default treeToSimulation