const express = require('express')
const { Server } = require('socket.io')
const http  = require('http')
const UserTokenHelper = require('../helpers/getUserDetailsFromToken')
const UserModel = require('../models/UserModel')
const { ConversationModel,MessageModel } = require('../models/ConversationModel')
const ConversationHelper = require('../helpers/getConversation')
const GroupModel = require('../models/GroupModel')
const CryptoHelper = require('../helpers/crypto')
const HmacHelper = require('../helpers/hmac')
const HMAC_SECRET = 'hardcoded-hmac-secret-key' // Hardcoded for demo, use env var in production

const app = express()

/***socket connection */
const server = http.createServer(app)
const io = new Server(server,{
    cors : {
        origin : process.env.FRONTEND_URL,
        credentials : true
    }
})

/***
 * socket running at http://localhost:8080/
 */

//online user
const onlineUser = new Set()

io.on('connection',async(socket)=>{
    console.log("connect User ", socket.id)

    const token = socket.handshake.auth.token 

    //current user details 
    const user = await UserTokenHelper.getUserDetailsFromToken(token)

    if (user && user._id) {
        socket.join(user._id.toString())
        onlineUser.add(user._id.toString())
    } else {
        console.log('User not found or invalid token:', token);
        socket.disconnect(true); // Optionally disconnect the socket
        return;
    }

    io.emit('onlineUser',Array.from(onlineUser))

    socket.on('message-page',async(userId)=>{
        console.log('userId',userId)
        const userDetails = await UserModel.findById(userId).select("-password")
        
        const payload = {
            _id : userDetails?._id,
            name : userDetails?.name,
            email : userDetails?.email,
            profile_pic : userDetails?.profile_pic,
            online : onlineUser.has(userId)
        }
        socket.emit('message-user',payload)

         //get previous message
         const getConversationMessage = await ConversationModel.findOne({
            "$or" : [
                { sender : user?._id, receiver : userId },
                { sender : userId, receiver :  user?._id}
            ]
        }).populate('messages').sort({ updatedAt : -1 })

        // Decrypt messages before sending to client
        const decryptedMessages = getConversationMessage?.messages?.map(msg => {
            let decryptedText;
            try {
                decryptedText = CryptoHelper.decryptMessage(msg.text);
            } catch (error) {
                console.error('Decryption failed for message:', msg._id, error);
                decryptedText = '[Message decryption failed]';
            }
            return {
                ...msg.toObject(),
                text: decryptedText // Decrypt for display
            };
        }) || []

        socket.emit('message', decryptedMessages)
    })

    //new message
    socket.on('new message',async(data)=>{
        //check conversation is available both user
        let conversation = await ConversationModel.findOne({
            "$or" : [
                { sender : data?.sender, receiver : data?.receiver },
                { sender : data?.receiver, receiver :  data?.sender}
            ]
        })
        //if conversation is not available
        if(!conversation){
            const createConversation = await ConversationModel({
                sender : data?.sender,
                receiver : data?.receiver
            })
            conversation = await createConversation.save()
        }
        // Encrypt message text before storing in database
        const encryptedText = CryptoHelper.encryptMessage(data.text)
        const signature = CryptoHelper.signHMAC(encryptedText + (data.imageUrl || '') + (data.videoUrl || ''))
        // Generate HMAC for message authentication using from-scratch implementation
        const hmac = HmacHelper.generateHmac(encryptedText + (data.imageUrl || '') + (data.videoUrl || ''))
        
        console.log('=== RSA ENCRYPTION DEBUG ===');
        console.log('Original text:', data.text);
        console.log('Encrypted text:', encryptedText);
        console.log('Decrypted text:', CryptoHelper.decryptMessage(encryptedText));
        console.log('Encryption working:', data.text === CryptoHelper.decryptMessage(encryptedText));
        console.log('Signature:', signature);
        console.log('Signature valid:', CryptoHelper.verifyHMAC(encryptedText + (data.imageUrl || '') + (data.videoUrl || ''), signature));
        console.log('================================');
        
        const message = new MessageModel({
          text : encryptedText, // Store encrypted text
          imageUrl : data.imageUrl,
          videoUrl : data.videoUrl,
          msgByUserId :  data?.msgByUserId,
          hmac_sha256: hmac, // HMAC-SHA-256
          hmac: signature // RSA signature (if still used)
        })
        const saveMessage = await message.save()

        const updateConversation = await ConversationModel.updateOne({ _id : conversation?._id },{
            "$push" : { messages : saveMessage?._id }
        })

        const getConversationMessage = await ConversationModel.findOne({
            "$or" : [
                { sender : data?.sender, receiver : data?.receiver },
                { sender : data?.receiver, receiver :  data?.sender}
            ]
        }).populate('messages').sort({ updatedAt : -1 })

        // Decrypt messages before sending to clients
        const decryptedMessages = getConversationMessage?.messages?.map(msg => {
            let decryptedText;
            try {
                console.log('=== DECRYPTION DEBUG ===');
                console.log('Stored text:', msg.text);
                console.log('Text type:', typeof msg.text);
                console.log('Text length:', msg.text?.length);
                decryptedText = CryptoHelper.decryptMessage(msg.text);
                console.log('Decrypted text:', decryptedText);
                console.log('Decryption working:', decryptedText !== msg.text);
                console.log('========================');
            } catch (error) {
                console.error('Decryption failed:', error);
                decryptedText = '[Message decryption failed]';
            }
            return {
                ...msg.toObject(),
                text: decryptedText // Decrypt for display
            };
        }) || []

        io.to(data?.sender).emit('message', decryptedMessages)
        io.to(data?.receiver).emit('message', decryptedMessages)

        //send conversation
        const conversationSender = await ConversationHelper.getConversation(data?.sender)
        const conversationReceiver = await ConversationHelper.getConversation(data?.receiver)

        io.to(data?.sender).emit('conversation',conversationSender)
        io.to(data?.receiver).emit('conversation',conversationReceiver)
    })

    //sidebar
    socket.on('sidebar',async(currentUserId)=>{
        console.log("current user",currentUserId)
        const conversation = await ConversationHelper.getConversation(currentUserId)
        socket.emit('conversation',conversation)
    })

    socket.on('seen',async(msgByUserId)=>{
        let conversation = await ConversationModel.findOne({
            "$or" : [
                { sender : user?._id, receiver : msgByUserId },
                { sender : msgByUserId, receiver :  user?._id}
            ]
        })
        const conversationMessageId = conversation?.messages || []
        const updateMessages  = await MessageModel.updateMany(
            { _id : { "$in" : conversationMessageId }, msgByUserId : msgByUserId },
            { "$set" : { seen : true }}
        )
        //send conversation
        const conversationSender = await ConversationHelper.getConversation(user?._id?.toString())
        const conversationReceiver = await ConversationHelper.getConversation(msgByUserId)
        io.to(user?._id?.toString()).emit('conversation',conversationSender)
        io.to(msgByUserId).emit('conversation',conversationReceiver)
    })

    // Group chat: join group room
    socket.on('join-group', async (groupId) => {
        socket.join(groupId)
    })

    // Group chat: fetch group messages history
    socket.on('fetch-group-messages', async (groupId) => {
        try {
            const group = await GroupModel.findById(groupId).populate('messages')
            if (group && group.messages) {
                // Decrypt messages before sending to client
                const decryptedMessages = group.messages.map(msg => {
                    let decryptedText;
                    try {
                        decryptedText = CryptoHelper.decryptMessage(msg.text);
                    } catch (error) {
                        console.error('Decryption failed for group message:', msg._id, error);
                        decryptedText = '[Message decryption failed]';
                    }
                    return {
                        ...msg.toObject(),
                        text: decryptedText // Decrypt for display
                    };
                })
                socket.emit('group-messages-history', decryptedMessages)
            }
        } catch (error) {
            console.error('Error fetching group messages:', error)
        }
    })

    // Group chat: add member to group
    socket.on('add-group-member', async (data) => {
        // data: { groupId, userId }
        try {
            const group = await GroupModel.findById(data.groupId)
            if (!group) {
                socket.emit('error', 'Group not found')
                return
            }
            // Check if user is already a member
            if (group.members.includes(data.userId)) {
                socket.emit('error', 'User is already a member')
                return
            }
            // Add user to group
            await GroupModel.updateOne(
                { _id: data.groupId },
                { $push: { members: data.userId } }
            )
            // Notify all group members about the new member
            const updatedGroup = await GroupModel.findById(data.groupId).populate('members')
            io.to(data.groupId).emit('group-member-added', {
                groupId: data.groupId,
                newMember: updatedGroup.members.find(m => m._id.toString() === data.userId)
            })
        } catch (error) {
            console.error('Error adding group member:', error)
            socket.emit('error', 'Failed to add member to group')
        }
    })

    // Edit message
    socket.on('edit-message', async (data) => {
        // data: { messageId, newText, groupId, senderId, receiverId }
        try {
            // Encrypt the new text before storing
            const encryptedText = CryptoHelper.encryptMessage(data.newText)
            const signature = CryptoHelper.signHMAC(encryptedText + (data.imageUrl || '') + (data.videoUrl || ''))
            const updatedMessage = await MessageModel.findByIdAndUpdate(
                data.messageId,
                { 
                    text: encryptedText, // Store encrypted
                    hmac: signature,
                    edited: true,
                    editedAt: new Date()
                },
                { new: true }
            ).populate('msgByUserId')
            if (data.groupId) {
                // Group message - notify all group members with decrypted text
                io.to(data.groupId).emit('message-edited', {
                    messageId: data.messageId,
                    newText: data.newText, // Send decrypted text to client
                    edited: true,
                    editedAt: updatedMessage.editedAt
                })
            } else {
                // Individual message - notify both sender and receiver with decrypted text
                io.to(data.senderId).emit('message-edited', {
                    messageId: data.messageId,
                    newText: data.newText, // Send decrypted text to client
                    edited: true,
                    editedAt: updatedMessage.editedAt
                })
                io.to(data.receiverId).emit('message-edited', {
                    messageId: data.messageId,
                    newText: data.newText, // Send decrypted text to client
                    edited: true,
                    editedAt: updatedMessage.editedAt
                })
            }
        } catch (error) {
            console.error('Error editing message:', error)
            socket.emit('error', 'Failed to edit message')
        }
    })

    // Delete message
    socket.on('delete-message', async (data) => {
        // data: { messageId, groupId, senderId, receiverId }
        try {
            const deletedMessage = await MessageModel.findByIdAndDelete(data.messageId)
            if (data.groupId) {
                // Remove from group messages array
                await GroupModel.updateOne(
                    { _id: data.groupId },
                    { $pull: { messages: data.messageId } }
                )
                // Notify all group members
                io.to(data.groupId).emit('message-deleted', {
                    messageId: data.messageId
                })
            } else {
                // Notify both sender and receiver
                io.to(data.senderId).emit('message-deleted', {
                    messageId: data.messageId
                })
                io.to(data.receiverId).emit('message-deleted', {
                    messageId: data.messageId
                })
            }
        } catch (error) {
            console.error('Error deleting message:', error)
            socket.emit('error', 'Failed to delete message')
        }
    })

    // Group chat: send group message
    socket.on('group-message', async (data) => {
        // data: { groupId, senderId, text, imageUrl, videoUrl, hmac }
        // Encrypt message text before storing
        const encryptedText = CryptoHelper.encryptMessage(data.text)
        const signature = CryptoHelper.signHMAC(encryptedText + (data.imageUrl || '') + (data.videoUrl || ''))
        const message = new MessageModel({
            text: encryptedText, // Store encrypted text
            imageUrl: data.imageUrl,
            videoUrl: data.videoUrl,
            msgByUserId: data.senderId,
            hmac: signature
        })
        await message.save()
        await GroupModel.updateOne({ _id: data.groupId }, { $push: { messages: message._id } })
        // Populate sender and decrypt for broadcast
        const populatedMsg = await MessageModel.findById(message._id).populate('msgByUserId')
        let decryptedText;
        try {
            decryptedText = CryptoHelper.decryptMessage(populatedMsg.text);
        } catch (error) {
            console.error('Decryption failed for group message:', error);
            decryptedText = '[Message decryption failed]';
        }
        const decryptedMsg = {
            ...populatedMsg.toObject(),
            text: decryptedText // Decrypt for display
        }
        io.to(data.groupId).emit('group-message', decryptedMsg)
    })

    //disconnect
    socket.on('disconnect',()=>{
        onlineUser.delete(user?._id?.toString())
        console.log('disconnect user ',socket.id)
    })
})

module.exports = {
    app,
    server
}

