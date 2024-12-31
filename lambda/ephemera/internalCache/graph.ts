import GraphCache from "@tonylb/mtw-utilities/dist/graphStorage/cache"

export type GraphCacheType = InstanceType<ReturnType<ReturnType<typeof GraphCache>>>["Graph"]
export type GraphNodeType = InstanceType<ReturnType<ReturnType<typeof GraphCache>>>["Nodes"]
export type GraphEdgeType = InstanceType<ReturnType<ReturnType<typeof GraphCache>>>["Edges"]
