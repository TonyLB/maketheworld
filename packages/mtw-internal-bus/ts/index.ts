type InternalMessageItem<PayloadType> = {
    processedBy: string[];
    payload: PayloadType;
}

type UnconstrainedInternalMessageSubscription<PayloadType> = {
    tag: string;
    priority: number;
    filter: (payload: PayloadType) => boolean;
    callback: (props: { payloads: PayloadType[]; messageBus: InternalMessageBus<PayloadType> }) => Promise<void>;
}

type ConstrainedInternalMessageSubscription<PayloadType, P extends PayloadType> = {
    tag: string;
    priority: number;
    filter: (payload: PayloadType) => payload is P;
    callback: (props: { payloads: P[]; messageBus: InternalMessageBus<PayloadType> }) => Promise<void>;
}

export class InternalMessageBus<PayloadType> {
    _stream: InternalMessageItem<PayloadType>[] = []
    _subscriptions: (UnconstrainedInternalMessageSubscription<PayloadType> | ConstrainedInternalMessageSubscription<PayloadType, any>)[] = []

    send(payload: PayloadType): void {
        this._stream.push({
            processedBy: [],
            payload
        })
    }

    subscribe<P extends PayloadType>(props: UnconstrainedInternalMessageSubscription<PayloadType> | ConstrainedInternalMessageSubscription<PayloadType, P>): void {
        this._subscriptions.push(props)
    }

    async flush(): Promise<void> {
        const priorities = [...(new Set(this._subscriptions.map(({ priority }) => (priority))))].sort()
        const priorityToProcess = priorities.find((priority) => (
            this._subscriptions
                .filter((subscription) => (subscription.priority === priority))
                .filter(({ filter: filterFunc, tag }) => (this._stream
                    .filter(({ processedBy }) => (!processedBy.includes(tag)))
                    .map(({ payload }) => (payload))
                    .filter(filterFunc)
                    .length > 0
                ))
                .length > 0
        ))
        if (priorityToProcess === undefined) {
            return
        }
        const subscriptionsToProcess = this._subscriptions.filter(({ priority }) => (priority === priorityToProcess))
        const processSubscription = ({ tag, filter: filterFunc, callback }): Promise<void> => {
            const filteredMessages = this._stream
                .filter(({ processedBy }) => (!processedBy.includes(tag)))
                .filter(({ payload }) => (filterFunc(payload)))
            filteredMessages.forEach((message) => (message.processedBy.push(tag)))
            return callback({ payloads: filteredMessages.map(({ payload }) => (payload)), messageBus: this })
        }
        await Promise.all(subscriptionsToProcess.map(processSubscription))
        await this.flush()
    }

    clear(): void {
        this._stream = []
    }
}
