import { MessageBus } from "./baseClasses"
import { registerReturnValueCollector } from "../returnValue/collector"

const messageBus = new MessageBus()
registerReturnValueCollector(messageBus)

export default messageBus
