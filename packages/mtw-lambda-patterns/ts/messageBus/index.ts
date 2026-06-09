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

export type DeferralRegistration = {
    onClear?: () => void
    afterSettled: () => Promise<void>
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

function assertSubscriptionCallback<PayloadType>(
    subscription: UnconstrainedInternalMessageSubscription<PayloadType> | ConstrainedInternalMessageSubscription<PayloadType, any>,
    stage: 'subscribe' | 'flush' | 'publish'
): void {
    if (typeof subscription.callback !== 'function') {
        const callbackType = typeof subscription.callback
        throw new TypeError(
            `InternalMessageBus ${stage} error: subscription "${subscription.tag}" at priority ${subscription.priority} has non-function callback (${callbackType}).`
        )
    }
}

export class InternalMessageBus<PayloadType> {
    _stream: InternalMessageItem<PayloadType>[] = []
    _subscriptions: (UnconstrainedInternalMessageSubscription<PayloadType> | ConstrainedInternalMessageSubscription<PayloadType, any>)[] = []
    _inFlight: Map<Promise<void>, string> = new Map()
    _deferrals: Map<string, DeferralRegistration> = new Map()

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

    publish(payload: PayloadType): void {
        const matchingSubscriptions = this._subscriptions.filter(({ filter: filterFunc }) => filterFunc(payload))
        for (const subscription of matchingSubscriptions) {
            const { tag, callback } = subscription
            if (typeof callback !== 'function') {
                throw new TypeError(
                    `InternalMessageBus publish error: subscription "${tag}" at priority ${subscription.priority} has non-function callback (${typeof callback}).`
                )
            }
            const promise = callback({
                payloads: [payload],
                messageBus: this,
                activeFlushLane: undefined
            }).finally(() => {
                this._inFlight.delete(promise)
            })
            this._inFlight.set(promise, tag)
        }
    }

    subscribe<P extends PayloadType>(props: UnconstrainedInternalMessageSubscription<PayloadType> | ConstrainedInternalMessageSubscription<PayloadType, P>): void {
        assertSubscriptionCallback(props, 'subscribe')
        this._subscriptions.push(props)
    }

    registerDeferral(tag: string, hooks: DeferralRegistration): void {
        if (this._deferrals.has(tag)) {
            throw new Error(`InternalMessageBus registerDeferral error: deferral "${tag}" is already registered.`)
        }
        this._deferrals.set(tag, hooks)
    }

    async runDeferrals(): Promise<void> {
        const entries = [...this._deferrals.entries()]
        const results = await Promise.allSettled(entries.map(([, { afterSettled }]) => afterSettled()))
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const tag = entries[index][0]
                console.error(`InternalMessageBus runDeferrals: deferral "${tag}" rejected:`, result.reason)
            }
        })
    }

    async settle(): Promise<boolean> {
        let didWork = false
        while (this._inFlight.size > 0) {
            didWork = true
            const snapshot = [...this._inFlight.entries()]
            const results = await Promise.allSettled(snapshot.map(([promise]) => promise))
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const tag = snapshot[index][1]
                    console.error(`InternalMessageBus settle: subscription "${tag}" rejected:`, result.reason)
                }
            })
        }
        return didWork
    }

    flush(): Promise<boolean>;
    flush(laneId: string): Promise<boolean>;
    async flush(laneId?: string): Promise<boolean> {
        const activeLane = laneId === undefined ? undefined : laneId
        return this.flushLane(activeLane)
    }

    async flushAndSettle(laneId?: string): Promise<void> {
        while (true) {
            const [didFlush, didSettle] = await Promise.all([
                laneId === undefined ? this.flush() : this.flush(laneId),
                this.settle(),
            ])
            if (!didFlush && !didSettle) {
                break
            }
        }
        await this.runDeferrals()
    }

    private async flushLane(activeLane: string | undefined): Promise<boolean> {
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
            return false
        }
        const subscriptionsToProcess = this._subscriptions.filter(({ priority }) => (priority === priorityToProcess))
        let didWork = false
        const processSubscription = async ({ tag, filter: filterFunc, callback }): Promise<void> => {
            if (typeof callback !== 'function') {
                throw new TypeError(
                    `InternalMessageBus flush error: subscription "${tag}" at priority ${priorityToProcess} has non-function callback (${typeof callback}).`
                )
            }
            const filteredMessages = this._stream
                .filter((item) => (matchesActiveLane(item, activeLane)))
                .filter(({ processedBy }) => (!processedBy.includes(tag)))
                .filter(({ payload }) => (filterFunc(payload)))
            filteredMessages.forEach((message) => (message.processedBy.push(tag)))
            if (filteredMessages.length > 0) {
                didWork = true
                await callback({
                    payloads: filteredMessages.map(({ payload }) => (payload)),
                    messageBus: this,
                    activeFlushLane: activeLane
                })
            }
        }
        await Promise.all(subscriptionsToProcess.map(processSubscription))
        const childDidWork = await this.flushLane(activeLane)
        return didWork || childDidWork
    }

    clear(): void {
        this._stream = []
        this._inFlight.clear()
        for (const { onClear } of this._deferrals.values()) {
            onClear?.()
        }
    }
}
