import baseMessage from './base.js'

export class worldMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { MessageId, Message = '' } = props
        this.MessageId = MessageId
        this.Message = Message
    }
}

export default worldMessage