import { MapTree, MapTreeEntry } from '../maps'

import { SimNode, NodeRecord, LinkRecord, SimulationReturn } from './baseClasses'

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
            //
            // TODO: Consider a refactor where we don't map to the source and target IDs, but rather map to roomIDs, to keep the data
            // representation in keeping with other places where we store links (i.e., fromRoomId and toRoomId)
            //
            const layerLinks = allLinks
                .filter(({ source, target }) => (combinedNodes[source] && combinedNodes[target]))
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