import {
    ErrorMessage,
    isErrorMessage,
    isReturnValueMessage,
    MessageBus,
    ReturnValueMessage,
} from '../messageBus/baseClasses'

let collectedBody: Record<string, unknown> = {}
let collectedError: ErrorMessage['body'] | undefined

export const collectReturnValues = (payloads: ReturnValueMessage[]): void => {
    collectedBody = payloads.reduce(
        (previous, { body }) => ({
            ...previous,
            ...body,
        }),
        collectedBody
    )
}

export const collectErrors = (payloads: ErrorMessage[]): void => {
    if (collectedError === undefined && payloads.length > 0) {
        collectedError = payloads[0].body
    }
}

export const resetReturnValueCollector = (): void => {
    collectedBody = {}
    collectedError = undefined
}

export const getCollectedReturnValueBody = (): Record<string, unknown> => collectedBody

export const getCollectedError = (): ErrorMessage['body'] | undefined => collectedError

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

export const registerReturnValueCollector = (messageBus: MessageBus): void => {
    messageBus.subscribe({
        tag: 'ReturnValueCollector',
        priority: 16,
        filter: isReturnValueMessage,
        callback: returnValueCollectorCallback,
    })
    messageBus.subscribe({
        tag: 'ErrorCollector',
        priority: 16,
        filter: isErrorMessage,
        callback: errorCollectorCallback,
    })
    messageBus.registerDeferral('returnValue', {
        onClear: resetReturnValueCollector,
        afterSettled: async () => {},
    })
}
