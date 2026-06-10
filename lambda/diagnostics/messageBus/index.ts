import { MessageBus } from './baseClasses'
import { diagnosticsIntakeDeduper } from '../dataSource/intakeDeduper'
import { registerReturnValueCollector } from '../returnValue/collector'

const messageBus = new MessageBus()
registerReturnValueCollector(messageBus)
diagnosticsIntakeDeduper.registerDeferral(messageBus)

export default messageBus
