import baseMessage from './base.js'

export class directMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { Message = '', FromCharacterId, ToCharacterId } = props
        this.Message = Message
        this.FromCharacterId = FromCharacterId
        this.ToCharacterId = ToCharacterId
    }
}

export default directMessage