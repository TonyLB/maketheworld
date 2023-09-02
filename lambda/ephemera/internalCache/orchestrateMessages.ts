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

type AllOffsetsWorkspace = {
    expandedKeys: MessageGroupId[];
    treesByRoot: Record<MessageGroupId, MessageGroupId[]>
}

export class OrchestrateMessagesData {
    OrchestrateMessagesById: Record<MessageGroupId, OrchestrateMessagesGroup> = {};

    clear() {
        this.OrchestrateMessagesById = {}
    }

    newMessageGroup(parentGroupId: MessageGroupId | '' = ''): MessageGroupId {
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
        const messageGroupId = this.newMessageGroup(root)

        this.OrchestrateMessagesById[root].during = [...this.OrchestrateMessagesById[root].during, messageGroupId]
        return messageGroupId
    }

    before(root: MessageGroupId): MessageGroupId {
        if (!(root in this.OrchestrateMessagesById)) {
            throw new Error('root meesageGroupId not in cache in next call')
        }
        const messageGroupId = this.newMessageGroup(root)

        this.OrchestrateMessagesById[root].before = [messageGroupId, ...this.OrchestrateMessagesById[root].before]
        return messageGroupId
    }

    after(root: MessageGroupId): MessageGroupId {
        if (!(root in this.OrchestrateMessagesById)) {
            throw new Error('root meesageGroupId not in cache in next call')
        }
        const messageGroupId = this.newMessageGroup(root)

        this.OrchestrateMessagesById[root].after = [...this.OrchestrateMessagesById[root].after, messageGroupId]
        return messageGroupId
    }

    allOffsets(): Record<MessageGroupId, number> {
        const startingRoots = Object.assign({}, 
            ...Object.entries(this.OrchestrateMessagesById)
                .filter(([_, { parentGroupId }]) => (parentGroupId === ''))
                .map(([key]) => ({ [key]: [key] }))
        ) as Record<MessageGroupId, MessageGroupId[]>
        let workspace: AllOffsetsWorkspace = {
            expandedKeys: [],
            treesByRoot: startingRoots
        }
        let messageExpanded = true
        while(messageExpanded) {
            messageExpanded = false
            workspace = Object.entries(workspace.treesByRoot)
                .reduce<AllOffsetsWorkspace>((previous, [root, messageGroups]) => (
                    messageGroups.reduce<AllOffsetsWorkspace>((aggregator, messageGroupId) => {
                        if (!(aggregator.expandedKeys.includes(messageGroupId))) {
                            const index = aggregator.treesByRoot[root].indexOf(messageGroupId)
                            if (index === -1) {
                                throw new Error('MessageGroup lost in processing by allOffsets functions')
                            }
                            //
                            // Expand the value by replacing it with a list of its before items, the messageGroupId
                            // itself, then its during items, and after items.  Mark the message as expanded, so that
                            // nothing gets expanded twice (and the loop eventually ends).
                            //
                            messageExpanded = true
                            const returnValue = {
                                expandedKeys: [...aggregator.expandedKeys, messageGroupId],
                                treesByRoot: {
                                    ...aggregator.treesByRoot,
                                    [root]: [
                                        ...aggregator.treesByRoot[root].slice(0, index),
                                        ...this.OrchestrateMessagesById[messageGroupId]?.before || [],
                                        messageGroupId,
                                        ...this.OrchestrateMessagesById[messageGroupId]?.during || [],
                                        ...this.OrchestrateMessagesById[messageGroupId]?.after || [],
                                        ...aggregator.treesByRoot[root].slice(index + 1)
                                    ]
                                }
                            }
                            return returnValue
                        }
                        return aggregator
                    }, previous)
                ), workspace)
        }
        return Object.entries(workspace.treesByRoot).reduce<Record<MessageGroupId, number>>((previous, [root, messageGroups]) => {
            const zeroOffsetIndex = messageGroups.indexOf(root)
            if (zeroOffsetIndex === -1) {
                throw new Error('MessageGroup lost in processing by allOffsets functions')
            }
            return messageGroups.reduce<Record<MessageGroupId, number>>((aggregator, messageGroupId, index) => ({
                ...aggregator,
                [messageGroupId]: index - zeroOffsetIndex
            }), previous)
    }, {})
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
