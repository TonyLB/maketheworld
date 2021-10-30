import {
    SimulationNodeDatum,
    SimulationLinkDatum
} from 'd3-force';
import { MapTree, MapTreeEntry } from '../maps'

export type SimNode = SimulationNodeDatum & {
    id: string;
    zLevel?: number;
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
    nodes: SimNode[],
    links: SimulationLinkDatum<SimNode>[]
}

const simulationNodes = (treeEntry: MapTreeEntry, zLevel: number, lockThreshold?: number): NodeRecord => {
    const { children = [], key, item } = treeEntry
    const childrenNodes = children.reduceRight<NodeRecord>((previous: NodeRecord, child: MapTreeEntry) => ({
        ...previous,
        ...simulationNodes(child, zLevel, lockThreshold)
    }), {})
    if (item.type === 'ROOM') {
        return {
            ...childrenNodes,
            [item.roomId]: {
                id: key,
                zLevel,
                roomId: item.roomId,
                x: item.x,
                y: item.y,
                visible: item.visible,
                ...(((lockThreshold !== undefined) && (lockThreshold < zLevel)) ? {
                    fx: item.x,
                    fy: item.y
                } : {})
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

export const treeToSimulation = (tree: MapTree, lockThreshold?: number): SimulationReturn => {
    const { nodes, links } = tree.reduceRight<{ nodes: NodeRecord, links: LinkRecord }>((
            { nodes: previousNodes, links: previousLinks },
            treeEntry,
            index
        ) => {
            const layerNodes = simulationNodes(treeEntry, index, lockThreshold)
            const combinedNodes = { ...previousNodes, ...layerNodes }
            //
            // Links are filtered so that a given exit can only effect either (a) rooms defined on the same
            // layer, or (b) rooms defined on later layers.  No looping back into the "past"
            //
            const layerLinks = simulationLinks(treeEntry)
                .filter(({ source, target }) => (layerNodes[target as string] && combinedNodes[source as string]))
                .map(({ source, target, ...rest }) => ({ source: combinedNodes[source].id, target: combinedNodes[target].id, ...rest }))
            return {
                nodes: {
                    ...previousNodes,
                    ...layerNodes
                },
                links: [
                    ...previousLinks,
                    ...layerLinks
                ]
            }
        }, { nodes: {}, links: [] })
    return { nodes: Object.values(nodes), links }
}

export default treeToSimulation