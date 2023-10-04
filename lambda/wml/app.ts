import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/readOnly'

export const handler = async (event: { address?: AssetWorkspaceAddress; player: string; requestId: string }) => {

    const { address, player, requestId } = event

    console.log(`Address to Parse: ${JSON.stringify(address, null, 4)}`)
}
