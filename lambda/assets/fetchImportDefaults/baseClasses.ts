import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { Graph } from "@tonylb/mtw-utilities/dist/graphStorage/utils/graph"
import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace"

export class InheritanceGraph extends Graph<EphemeraAssetId, { key: EphemeraAssetId; address: AssetWorkspaceAddress }, {}> {}
