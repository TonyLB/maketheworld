import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import internalCache from "../internalCache";
import { DecacheAssetMessage, MessageBus } from "../messageBus/baseClasses";
import AssetWorkspace from "@tonylb/mtw-asset-workspace";
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema";
import { StandardRemove } from "@tonylb/mtw-wml/ts/standardize/components/edits";
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB";

export const decacheAssetMessage = async ({ payloads, messageBus }: { payloads: DecacheAssetMessage[], messageBus: MessageBus }): Promise<void> => {
}

export default decacheAssetMessage