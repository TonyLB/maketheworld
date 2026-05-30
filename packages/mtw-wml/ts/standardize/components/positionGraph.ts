import { ReferenceList } from "./reference"
import StandardReference from "../keys/reference"
import {
    PositionGraphNodeTag,
    StandardPositionGraphData,
} from "./dataTypes/positionGraph"
import { ExitEdgeList } from "../keys/edges/exitEdge"

export class StandardPositionGraph {
    _nodes: ReferenceList
    _edges: ExitEdgeList

    constructor(arg?: StandardPositionGraph | StandardPositionGraphData | ReferenceList) {
        if (arg instanceof StandardPositionGraph) {
            this._nodes = new ReferenceList(arg._nodes)
            this._edges = new ExitEdgeList(arg._edges)
            return
        }
        if (arg instanceof ReferenceList) {
            this._nodes = new ReferenceList(arg)
            this._edges = new ExitEdgeList([])
            return
        }
        if (arg && typeof arg === 'object' && ('nodes' in arg || 'edges' in arg)) {
            const data = arg as StandardPositionGraphData
            this._nodes = new ReferenceList(
                data.nodes?.map((reference) => new StandardReference(reference)) ?? []
            )
            this._edges = new ExitEdgeList(data.edges ?? [])
            return
        }
        this._nodes = new ReferenceList([])
        this._edges = new ExitEdgeList([])
    }

    static fromJSON(data?: StandardPositionGraphData): StandardPositionGraph {
        return new StandardPositionGraph(data)
    }

    get nodes(): ReferenceList {
        return this._nodes
    }

    get edges(): ExitEdgeList {
        return this._edges
    }

    toJSON(): StandardPositionGraphData | undefined {
        const nodesJSON = this._nodes.payload.length ? this._nodes.toJSON() : undefined
        const edgesJSON = this._edges.length ? this._edges.toJSON() : undefined
        if (!nodesJSON && !edgesJSON) {
            return undefined
        }
        return {
            ...(nodesJSON ? { nodes: nodesJSON } : {}),
            ...(edgesJSON ? { edges: edgesJSON } : {}),
        }
    }

    merge(other: StandardPositionGraph): StandardPositionGraph {
        const mergedNodes = this._nodes.merge(other._nodes) ?? new ReferenceList([])
        const mergedEdges = this._edges.merge(other._edges) ?? new ExitEdgeList([])
        return new StandardPositionGraph({
            nodes: mergedNodes.toJSON(),
            edges: mergedEdges.toJSON(),
        })
    }

    diff(other: StandardPositionGraph): StandardPositionGraph | undefined {
        const diffedNodes = this._nodes.diff(other._nodes) ?? new ReferenceList([])
        const diffedEdges = this._edges.diff(other._edges) ?? new ExitEdgeList([])
        if (diffedNodes.isEmpty() && diffedEdges.isEmpty()) {
            return undefined
        }
        return new StandardPositionGraph({
            ...(diffedNodes.payload.length ? { nodes: diffedNodes.toJSON() } : {}),
            ...(diffedEdges.length ? { edges: diffedEdges.toJSON() } : {}),
        })
    }

    equals(other: StandardPositionGraph): boolean {
        if (!(other instanceof StandardPositionGraph)) {
            return false
        }
        return this._nodes.equals(other._nodes) && this._edges.equals(other._edges)
    }

    clone(): StandardPositionGraph {
        return new StandardPositionGraph(this)
    }

    nodesByTag(tag: PositionGraphNodeTag): ReferenceList {
        return this._nodes.filter((item) => item.tag === tag)
    }
}

export default StandardPositionGraph
