const mongoose = require('mongoose')

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    creator: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    }],
    messages: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Message'
    }],
    groupAvatar: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
})

const GroupModel = mongoose.model('Group', groupSchema)

module.exports = GroupModel 