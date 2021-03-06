import baseMessage from './base.js'

export class worldMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { MessageId, Message = '', Target } = props
        this.MessageId = MessageId
        this.Message = Message
        this.Target = Target
    }
}

export default worldMessage