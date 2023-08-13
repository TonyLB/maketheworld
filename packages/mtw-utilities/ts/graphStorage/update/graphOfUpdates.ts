import { GraphNodeResult } from "../cache/graphNode";
import { Graph } from "../utils/graph";

export type GraphOfUpdatesNode = Partial<Omit<GraphNodeResult<string>, 'PrimaryKey'>> & {
    key: string;
    needsForwardUpdate?: boolean;
    needsForwardInvalidate?: boolean;
    forwardInvalidatedAt?: number;
    needsBackUpdate?: boolean;
    needsBackInvalidate?: boolean;
    backInvalidatedAt?: number;
}

export type GraphOfUpdatesEdge = {
    context: string;
    action: 'put' | 'delete';
}

export class GraphOfUpdates extends Graph<string, GraphOfUpdatesNode, GraphOfUpdatesEdge> {}

export default GraphOfUpdates
