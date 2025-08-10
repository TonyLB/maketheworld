import { ExecuteActionMessage } from './messageBus/baseClasses'
import { executeAction } from './parse/executeAction'

export default async ({ payloads }: { payloads: ExecuteActionMessage[], messageBus?: any }) => {
    await Promise.all(payloads.map(async (message) => {
        await executeAction(message.action)
    }))
}
