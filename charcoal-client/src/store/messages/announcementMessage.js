import baseMessage from './base.js'

export class announcementMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { Title = '', Message = '' } = props
        this.Message = Message
        this.Title = Title
    }
}

export default announcementMessage