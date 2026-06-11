import type { InternalMessageBus } from './index'

export type ReturnValueMessage = {
    type: 'ReturnValue';
    body: Record<string, unknown>;
}

export type ErrorMessage = {
    type: 'Error';
    body: {
        error: string;
        statusCode?: number;
    };
}

export type BoundaryResponseMessage = ReturnValueMessage | ErrorMessage

export type WithBoundaryResponseMessages<T> = T | ReturnValueMessage | ErrorMessage

export const isReturnValueMessage = (prop: { type: string }): prop is ReturnValueMessage => (
    prop.type === 'ReturnValue'
)

export const isErrorMessage = (prop: { type: string }): prop is ErrorMessage => (
    prop.type === 'Error'
)

export type BoundaryResponseCollectorOptions = {
    priority?: number
    deferralTag?: string
    includeError?: boolean
}

export type BoundaryResponseCollector<PayloadType> = {
    register: (messageBus: InternalMessageBus<PayloadType>) => void
    collectReturnValues: (payloads: ReturnValueMessage[]) => void
    collectErrors: (payloads: ErrorMessage[]) => void
    reset: () => void
    getCollectedReturnValueBody: () => Record<string, unknown>
    getCollectedError: () => ErrorMessage['body'] | undefined
}

export function createBoundaryResponseCollector<
    PayloadType extends BoundaryResponseMessage | { type: string }
>(options?: BoundaryResponseCollectorOptions): BoundaryResponseCollector<PayloadType> {
    const priority = options?.priority ?? 16
    const deferralTag = options?.deferralTag ?? 'returnValue'
    const includeError = options?.includeError ?? true

    let collectedBody: Record<string, unknown> = {}
    let collectedError: ErrorMessage['body'] | undefined

    const collectReturnValues = (payloads: ReturnValueMessage[]): void => {
        collectedBody = payloads.reduce(
            (previous, { body }) => ({
                ...previous,
                ...body,
            }),
            collectedBody
        )
    }

    const collectErrors = (payloads: ErrorMessage[]): void => {
        if (collectedError === undefined && payloads.length > 0) {
            collectedError = payloads[0].body
        }
    }

    const reset = (): void => {
        collectedBody = {}
        collectedError = undefined
    }

    const getCollectedReturnValueBody = (): Record<string, unknown> => collectedBody

    const getCollectedError = (): ErrorMessage['body'] | undefined => collectedError

    const returnValueCollectorCallback = async ({
        payloads,
    }: {
        payloads: ReturnValueMessage[]
    }): Promise<void> => {
        collectReturnValues(payloads)
    }

    const errorCollectorCallback = async ({
        payloads,
    }: {
        payloads: ErrorMessage[]
    }): Promise<void> => {
        collectErrors(payloads)
    }

    const register = (messageBus: InternalMessageBus<PayloadType>): void => {
        messageBus.subscribe({
            tag: 'ReturnValueCollector',
            priority,
            filter: (prop: PayloadType): prop is ReturnValueMessage & PayloadType => isReturnValueMessage(prop),
            callback: returnValueCollectorCallback,
        })
        if (includeError) {
            messageBus.subscribe({
                tag: 'ErrorCollector',
                priority,
                filter: (prop: PayloadType): prop is ErrorMessage & PayloadType => isErrorMessage(prop),
                callback: errorCollectorCallback,
            })
        }
        messageBus.registerDeferral(deferralTag, {
            onClear: reset,
            afterSettled: async () => {},
        })
    }

    return {
        register,
        collectReturnValues,
        collectErrors,
        reset,
        getCollectedReturnValueBody,
        getCollectedError,
    }
}
