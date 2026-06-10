import { isReturnValueMessage, MessageBus, ReturnValueMessage } from '../messageBus/baseClasses'

let collectedBody: Record<string, unknown> = {}

export const collectReturnValues = (payloads: ReturnValueMessage[]): void => {
    collectedBody = payloads.reduce(
        (previous, { body }) => ({
            ...previous,
            ...body,
        }),
        collectedBody
    )
}

export const resetReturnValueCollector = (): void => {
    collectedBody = {}
}

export const getCollectedReturnValueBody = (): Record<string, unknown> => collectedBody

const returnValueCollectorCallback = async ({
    payloads,
}: {
    payloads: ReturnValueMessage[]
}): Promise<void> => {
    collectReturnValues(payloads)
}

export const registerReturnValueCollector = (messageBus: MessageBus): void => {
    messageBus.subscribe({
        tag: 'ReturnValue',
        priority: 16,
        filter: isReturnValueMessage,
        callback: returnValueCollectorCallback,
    })
    messageBus.registerDeferral('returnValue', {
        onClear: resetReturnValueCollector,
        afterSettled: async () => {},
    })
}
