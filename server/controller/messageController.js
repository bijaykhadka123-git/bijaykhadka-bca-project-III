const { MessageModel, ConversationModel } = require('../models/ConversationModel')
const GroupModel = require('../models/GroupModel')
const CryptoHelper = require('../../shared/crypto');
const HmacHelper = require('../helpers/hmac');
const mongoose = require('mongoose'); // Ensure this is at the top

class MessageController {
    static async editMessage(req, res) {
        try {
            const { messageId, newText, groupId } = req.body
            if (!messageId || !newText) {
                return res.status(400).json({ message: 'Message ID and new text are required', error: true })
            }
            const encryptedText = CryptoHelper.encryptMessage(newText)
            const signature = HmacHelper.generateHmac(encryptedText)
            const updatedMessage = await MessageModel.findByIdAndUpdate(
                messageId,
                { 
                    text: encryptedText, // Store encrypted
                    hmac: signature, // Store RSA signature
                    edited: true,
                    editedAt: new Date()
                },
                { new: true }
            )
            if (!updatedMessage) {
                return res.status(404).json({ message: 'Message not found', error: true })
            }
            const responseMessage = {
                ...updatedMessage.toObject(),
                text: newText // Return original decrypted text
            }
            res.json({ 
                message: 'Message updated successfully', 
                updatedMessage: responseMessage,
                success: true 
            })
        } catch (error) {
            res.status(500).json({ message: error.message, error: true })
        }
    }

    static async deleteMessage(req, res) {
        try {
            const { messageId, groupId, conversationId } = req.body
            if (!messageId) {
                return res.status(400).json({ message: 'Message ID is required', error: true })
            }
            const deletedMessage = await MessageModel.findByIdAndDelete(messageId)
            if (!deletedMessage) {
                return res.status(404).json({ message: 'Message not found', error: true })
            }
            if (groupId) {
                await GroupModel.updateOne(
                    { _id: groupId },
                    { $pull: { messages: mongoose.Types.ObjectId(messageId) } }
                )
            }
            if (conversationId) {
                await ConversationModel.updateOne(
                    { _id: conversationId },
                    { $pull: { messages: mongoose.Types.ObjectId(messageId) } }
                )
            }
            res.json({ 
                message: 'Message deleted successfully', 
                success: true 
            })
        } catch (error) {
            res.status(500).json({ message: error.message, error: true })
        }
    }

    static async softDeleteConversation(req, res) {
        try {
            const { conversationId, userId } = req.body;
            if (!conversationId || !userId) {
                return res.status(400).json({ message: 'Conversation ID and User ID are required', error: true });
            }
            await ConversationModel.updateOne(
                { _id: conversationId },
                { $addToSet: { deletedFor: mongoose.Types.ObjectId(userId) } }
            );
            res.json({ message: 'Conversation hidden for user', success: true });
        } catch (error) {
            res.status(500).json({ message: error.message, error: true });
        }
    }

    static async findConversationByUserIds(req, res) {
      try {
        const { userId1, userId2 } = req.params;
        const id1 = mongoose.Types.ObjectId(userId1);
        const id2 = mongoose.Types.ObjectId(userId2);
        const conversation = await ConversationModel.findOne({
          $or: [
            { sender: id1, receiver: id2 },
            { sender: id2, receiver: id1 }
          ]
        });
        if (!conversation) {
          return res.status(404).json({ message: 'Conversation not found', error: true });
        }
        res.json(conversation);
      } catch (error) {
        res.status(500).json({ message: error.message, error: true });
      }
    }
}

module.exports = MessageController; 