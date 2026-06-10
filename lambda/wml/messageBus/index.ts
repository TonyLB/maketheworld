import { MessageBus } from "./baseClasses"
import { registerReturnValueCollector } from "../returnValue/collector"

export const messageBus = new MessageBus()
registerReturnValueCollector(messageBus)

export default messageBus
