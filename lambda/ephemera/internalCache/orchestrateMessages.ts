import { CacheConstructor } from "./baseClasses"

type MessageGroupId = string;

type OrchestrateMessagesGroup = {
    messageGroupId: MessageGroupId;
    parentGroupId: MessageGroupId;
    before: MessageGroupId[];           // A list of child messageGroups that must occur before this one, with no necessary ordering relative to each other
    after: MessageGroupId[];            // A list of child messageGroups that must occur after this one, with no necessary ordering relative to each other
    during: MessageGroupId[];           // A list of child messageGroups that must be reported, in sequence order, after all "before" items and before all "after"
}

export class OrchestrateMessagesData {
    OrchestrateMessagesById: Record<MessageGroupId, OrchestrateMessagesGroup> = {};
    clear() {
        this.OrchestrateMessagesById = {}
    }
}


export const OrchestrateMessages = <GBase extends CacheConstructor>(Base: GBase) => {
    return class OrchestrateMessages extends Base {
        OrchestrateMessages: OrchestrateMessagesData

        constructor(...rest: any) {
            super(...rest)
            this.OrchestrateMessages = new OrchestrateMessagesData()
        }

        override clear() {
            this.OrchestrateMessages.clear()
            super.clear()
        }
    }
}

export default OrchestrateMessages
