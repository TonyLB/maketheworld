import { ReferenceList } from "./reference"
import StandardReference from "../keys/reference"
import {
    LudicGraphNodeTag,
    StandardLudicGraphData,
} from "./dataTypes/ludicGraph"
import { ExitEdgeList } from "../keys/edges/exitEdge"

export class StandardLudicGraph {
    _nodes: ReferenceList
    _edges: ExitEdgeList

    constructor(arg?: StandardLudicGraph | StandardLudicGraphData | ReferenceList) {
        if (arg instanceof StandardLudicGraph) {
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
            const data = arg as StandardLudicGraphData
            this._nodes = new ReferenceList(
                data.nodes?.map((reference) => new StandardReference(reference)) ?? []
            )
            this._edges = new ExitEdgeList(data.edges ?? [])
            return
        }
        this._nodes = new ReferenceList([])
        this._edges = new ExitEdgeList([])
    }

    static fromJSON(data?: StandardLudicGraphData): StandardLudicGraph {
        return new StandardLudicGraph(data)
    }

    get nodes(): ReferenceList {
        return this._nodes
    }

    get edges(): ExitEdgeList {
        return this._edges
    }

    toJSON(): StandardLudicGraphData | undefined {
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

    merge(other: StandardLudicGraph): StandardLudicGraph {
        const mergedNodes = this._nodes.merge(other._nodes) ?? new ReferenceList([])
        const mergedEdges = this._edges.merge(other._edges) ?? new ExitEdgeList([])
        return new StandardLudicGraph({
            nodes: mergedNodes.toJSON(),
            edges: mergedEdges.toJSON(),
        })
    }

    diff(other: StandardLudicGraph): StandardLudicGraph | undefined {
        const diffedNodes = this._nodes.diff(other._nodes) ?? new ReferenceList([])
        const diffedEdges = this._edges.diff(other._edges) ?? new ExitEdgeList([])
        if (diffedNodes.isEmpty() && diffedEdges.isEmpty()) {
            return undefined
        }
        return new StandardLudicGraph({
            ...(diffedNodes.payload.length ? { nodes: diffedNodes.toJSON() } : {}),
            ...(diffedEdges.length ? { edges: diffedEdges.toJSON() } : {}),
        })
    }

    equals(other: StandardLudicGraph): boolean {
        if (!(other instanceof StandardLudicGraph)) {
            return false
        }
        return this._nodes.equals(other._nodes) && this._edges.equals(other._edges)
    }

    clone(): StandardLudicGraph {
        return new StandardLudicGraph(this)
    }

    nodesByTag(tag: LudicGraphNodeTag): ReferenceList {
        return this._nodes.filter((item) => item.tag === tag)
    }
}

export default StandardLudicGraph
