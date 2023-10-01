import { GraphNodeResult } from "../cache/graphNode";
import { Graph } from "../utils/graph";
import withGetOperations from "../../dynamoDB/mixins/get"
import withUpdate from "../../dynamoDB/mixins/update"
import withTransaction from "../../dynamoDB/mixins/transact"
import withBatchWrite from "../../dynamoDB/mixins/batchWrite";

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
    action: 'put' | 'delete';
}

export type GraphStorageDBH = InstanceType<ReturnType<ReturnType<typeof withGetOperations<'PrimaryKey'>>>> &
    InstanceType<ReturnType<ReturnType<typeof withUpdate<'PrimaryKey'>>>> &
    InstanceType<ReturnType<ReturnType<typeof withTransaction<'PrimaryKey'>>>> &
    InstanceType<ReturnType<ReturnType<typeof withBatchWrite<'PrimaryKey'>>>>

export class GraphOfUpdates extends Graph<string, GraphOfUpdatesNode, GraphOfUpdatesEdge> {}

export default GraphOfUpdates
