import { v4 as uuidv4 } from 'uuid'

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

    _newMessageGroup(parentGroupId: MessageGroupId | ''): MessageGroupId {
        const messageGroupId = uuidv4()
        this.OrchestrateMessagesById[messageGroupId] = {
            messageGroupId,
            parentGroupId,
            before: [],
            after: [],
            during: []
        }
        return messageGroupId
    }

    next(root: MessageGroupId): MessageGroupId {
        if (!(root in this.OrchestrateMessagesById)) {
            throw new Error('root meesageGroupId not in cache in next call')
        }
        const messageGroupId = this._newMessageGroup(root)

        this.OrchestrateMessagesById[root].during = [...this.OrchestrateMessagesById[root].during, messageGroupId]
        return messageGroupId
    }

    before(root: MessageGroupId): MessageGroupId {
        if (!(root in this.OrchestrateMessagesById)) {
            throw new Error('root meesageGroupId not in cache in next call')
        }
        const messageGroupId = this._newMessageGroup(root)

        this.OrchestrateMessagesById[root].before = [messageGroupId, ...this.OrchestrateMessagesById[root].before]
        return messageGroupId
    }

    after(root: MessageGroupId): MessageGroupId {
        if (!(root in this.OrchestrateMessagesById)) {
            throw new Error('root meesageGroupId not in cache in next call')
        }
        const messageGroupId = this._newMessageGroup(root)

        this.OrchestrateMessagesById[root].after = [...this.OrchestrateMessagesById[root].after, messageGroupId]
        return messageGroupId
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
