import { createBoundaryResponseCollector } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import type { MessageType } from '../messageBus/baseClasses'

export const {
    register: registerReturnValueCollector,
    collectReturnValues,
    collectErrors,
    reset: resetReturnValueCollector,
    getCollectedReturnValueBody,
    getCollectedError,
} = createBoundaryResponseCollector<MessageType>()
