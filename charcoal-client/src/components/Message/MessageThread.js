import React from 'react'
import PropTypes from "prop-types"

//
// MessageThread is a purely semantic (non-rendering) component
// for use as a child in the polymorphic Message component
//
export const MessageThread = ({ thread }) => <React.Fragment>
</React.Fragment>

MessageThread.propTypes = {
    thread: PropTypes.string
}
export default MessageThread