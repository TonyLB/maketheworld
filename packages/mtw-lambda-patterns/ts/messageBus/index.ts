type InternalMessageItem<PayloadType> = {
    processedBy: string[];
    payload: PayloadType;
    laneId?: string;
}

function matchesActiveLane<PayloadType>(item: InternalMessageItem<PayloadType>, activeLane: string | undefined): boolean {
    if (activeLane === undefined) {
        return item.laneId === undefined
    }
    return item.laneId === activeLane
}

export type InternalMessageBusCallbackProps<PayloadType> = {
    payloads: PayloadType[];
    messageBus: InternalMessageBus<PayloadType>;
    /** Lane being drained by the active `flush()` / `flush(laneId)`; `undefined` means default lane. */
    activeFlushLane: string | undefined;
}

type UnconstrainedInternalMessageSubscription<PayloadType> = {
    tag: string;
    priority: number;
    filter: (payload: PayloadType) => boolean;
    callback: (props: InternalMessageBusCallbackProps<PayloadType>) => Promise<void>;
}

type ConstrainedInternalMessageSubscription<PayloadType, P extends PayloadType> = {
    tag: string;
    priority: number;
    filter: (payload: PayloadType) => payload is P;
    callback: (props: { payloads: P[]; messageBus: InternalMessageBus<PayloadType>; activeFlushLane: string | undefined }) => Promise<void>;
}

export class InternalMessageBus<PayloadType> {
    _stream: InternalMessageItem<PayloadType>[] = []
    _subscriptions: (UnconstrainedInternalMessageSubscription<PayloadType> | ConstrainedInternalMessageSubscription<PayloadType, any>)[] = []

    send(payload: PayloadType): void;
    send(payload: PayloadType, laneId: string): void;
    send(payload: PayloadType, laneId?: string): void {
        if (laneId === undefined || laneId === '') {
            this._stream.push({
                processedBy: [],
                payload
            })
        } else {
            this._stream.push({
                processedBy: [],
                payload,
                laneId
            })
        }
    }

    subscribe<P extends PayloadType>(props: UnconstrainedInternalMessageSubscription<PayloadType> | ConstrainedInternalMessageSubscription<PayloadType, P>): void {
        this._subscriptions.push(props)
    }

    flush(): Promise<void>;
    flush(laneId: string): Promise<void>;
    async flush(laneId?: string): Promise<void> {
        const activeLane = laneId === undefined ? undefined : laneId
        await this.flushLane(activeLane)
    }

    private async flushLane(activeLane: string | undefined): Promise<void> {
        const priorities = [...(new Set(this._subscriptions.map(({ priority }) => (priority))))].sort()
        const priorityToProcess = priorities.find((priority) => (
            this._subscriptions
                .filter((subscription) => (subscription.priority === priority))
                .filter(({ filter: filterFunc, tag }) => (this._stream
                    .filter((item) => (matchesActiveLane(item, activeLane)))
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
        const processSubscription = async ({ tag, filter: filterFunc, callback }): Promise<void> => {
            const filteredMessages = this._stream
                .filter((item) => (matchesActiveLane(item, activeLane)))
                .filter(({ processedBy }) => (!processedBy.includes(tag)))
                .filter(({ payload }) => (filterFunc(payload)))
            filteredMessages.forEach((message) => (message.processedBy.push(tag)))
            if (filteredMessages.length > 0) {
                await callback({
                    payloads: filteredMessages.map(({ payload }) => (payload)),
                    messageBus: this,
                    activeFlushLane: activeLane
                })
            }
        }
        await Promise.all(subscriptionsToProcess.map(processSubscription))
        await this.flushLane(activeLane)
    }

    clear(): void {
        this._stream = []
    }
}
