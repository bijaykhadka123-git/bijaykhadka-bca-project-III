const express = require('express')
const { Server } = require('socket.io')
const http  = require('http')
const UserTokenHelper = require('../helpers/getUserDetailsFromToken')
const UserModel = require('../models/UserModel')
const { ConversationModel,MessageModel } = require('../models/ConversationModel')
const ConversationHelper = require('../helpers/getConversation')
const GroupModel = require('../models/GroupModel')
const CryptoHelper = require('../../shared/crypto');
const HmacHelper = require('../helpers/hmac')
const HMAC_SECRET = 'hardcoded-hmac-secret-key' // Hardcoded for demo, use env var in production

class SocketServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true
      }
    });
    this.onlineUser = new Set();
    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.io.on('connection', async (socket) => {
      console.log("connect User ", socket.id);
      const token = socket.handshake.auth.token;
      const user = await UserTokenHelper.getUserDetailsFromToken(token);
      if (user && user._id) {
        socket.join(user._id.toString());
        this.onlineUser.add(user._id.toString());
      } else {
        console.log('User not found or invalid token:', token);
        socket.disconnect(true);
        return;
      }
      this.io.emit('onlineUser', Array.from(this.onlineUser));
      this.handleMessagePage(socket, user);
      this.handleNewMessage(socket, user);
      this.handleSidebar(socket, user);
      this.handleSeen(socket, user);
      this.handleGroupEvents(socket, user);
      this.handleEditMessage(socket);
      this.handleDeleteMessage(socket);
      this.handleGroupMessage(socket);
      socket.on('disconnect', () => {
        this.onlineUser.delete(user?._id?.toString());
        console.log('disconnect user ', socket.id);
      });
    });
  }

  handleMessagePage(socket, user) {
    socket.on('message-page', async (userId) => {
      const userDetails = await UserModel.findById(userId).select("-password");
      const payload = {
        _id: userDetails?._id,
        name: userDetails?.name,
        email: userDetails?.email,
        profile_pic: userDetails?.profile_pic,
        online: this.onlineUser.has(userId)
      };
      socket.emit('message-user', payload);
      const getConversationMessage = await ConversationModel.findOne({
        "$or": [
          { sender: user?._id, receiver: userId },
          { sender: userId, receiver: user?._id }
        ]
      }).populate('messages').sort({ updatedAt: -1 });
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
          text: decryptedText,
          encryptedText: msg.text,
          imageUrl: msg.imageUrl || '',
          videoUrl: msg.videoUrl || '',
          fileUrl: msg.fileUrl || '',
          fileName: msg.fileName || '',
          fileType: msg.fileType || ''
        };
      }) || [];
      socket.emit('message', decryptedMessages);
    });
  }

  handleNewMessage(socket, user) {
    socket.on('new message', async (data) => {
      try {
        console.log('Received new message data:', data);
        if (
          !data?.sender ||
          !data?.receiver ||
          !data?.msgByUserId ||
          (
            (!data?.text || String(data.text).trim() === '') &&
            (!data?.imageUrl || String(data.imageUrl).trim() === '') &&
            (!data?.videoUrl || String(data.videoUrl).trim() === '') &&
            (!data?.fileUrl || String(data.fileUrl).trim() === '')
          )
        ) {
          console.error('Missing required fields in new message data:', data);
          return;
        }
        let conversation = await ConversationModel.findOne({
          "$or": [
            { sender: data?.sender, receiver: data?.receiver },
            { sender: data?.receiver, receiver: data?.sender }
          ]
        });
        if (!conversation) {
          const createConversation = await ConversationModel({
            sender: data?.sender,
            receiver: data?.receiver
          });
          conversation = await createConversation.save();
        }
        const imageUrl = data.imageUrl || '';
        const videoUrl = data.videoUrl || '';
        const fileUrl = data.fileUrl || '';
        const fileName = data.fileName || '';
        const fileType = data.fileType || '';
        const encryptedText = CryptoHelper.encryptMessage(data.text);
        const hmacInput = encryptedText + imageUrl + videoUrl + fileUrl + fileName + fileType;
        const hmac = HmacHelper.generateHmac(hmacInput);
        const message = new MessageModel({
          text: encryptedText,
          imageUrl: imageUrl,
          videoUrl: videoUrl,
          fileUrl: fileUrl,
          fileName: fileName,
          fileType: fileType,
          msgByUserId: data?.msgByUserId,
          hmac: hmac
        });
        const saveMessage = await message.save();
        if (!saveMessage) {
          console.error('Failed to save message:', message);
          return;
        }
        const updateConversation = await ConversationModel.updateOne({ _id: conversation?._id }, {
          "$push": { messages: saveMessage?._id }
        });
        if (!updateConversation) {
          console.error('Failed to update conversation:', conversation?._id);
        }
        const getConversationMessage = await ConversationModel.findOne({
          "$or": [
            { sender: data?.sender, receiver: data?.receiver },
            { sender: data?.receiver, receiver: data?.sender }
          ]
        }).populate('messages').sort({ updatedAt: -1 });
        const decryptedMessages = getConversationMessage?.messages?.map(msg => {
          let decryptedText;
          try {
            decryptedText = CryptoHelper.decryptMessage(msg.text);
          } catch (error) {
            decryptedText = '[Message decryption failed]';
          }
          const emitHmacInput = (msg.text || '') + (msg.imageUrl || '') + (msg.videoUrl || '') + (msg.fileUrl || '') + (msg.fileName || '') + (msg.fileType || '');
          return {
            ...msg.toObject(),
            text: decryptedText,
            encryptedText: msg.text,
            imageUrl: msg.imageUrl || '',
            videoUrl: msg.videoUrl || '',
            fileUrl: msg.fileUrl || '',
            fileName: msg.fileName || '',
            fileType: msg.fileType || ''
          };
        }) || [];
        this.io.to(data?.sender).emit('message', decryptedMessages);
        this.io.to(data?.receiver).emit('message', decryptedMessages);
        const conversationSender = await ConversationHelper.getConversation(data?.sender);
        const conversationReceiver = await ConversationHelper.getConversation(data?.receiver);
        this.io.to(data?.sender).emit('conversation', conversationSender);
        this.io.to(data?.receiver).emit('conversation', conversationReceiver);
      } catch (error) {
        console.error('Error in new message handler:', error);
      }
    });
  }

  handleSidebar(socket, user) {
    socket.on('sidebar', async (currentUserId) => {
      const conversation = await ConversationHelper.getConversation(currentUserId);
      socket.emit('conversation', conversation);
    });
  }

  handleSeen(socket, user) {
    socket.on('seen', async (msgByUserId) => {
      let conversation = await ConversationModel.findOne({
        "$or": [
          { sender: user?._id, receiver: msgByUserId },
          { sender: msgByUserId, receiver: user?._id }
        ]
      });
      const conversationMessageId = conversation?.messages || [];
      await MessageModel.updateMany(
        { _id: { "$in": conversationMessageId }, msgByUserId: msgByUserId },
        { "$set": { seen: true } }
      );
      const conversationSender = await ConversationHelper.getConversation(user?._id?.toString());
      const conversationReceiver = await ConversationHelper.getConversation(msgByUserId);
      this.io.to(user?._id?.toString()).emit('conversation', conversationSender);
      this.io.to(msgByUserId).emit('conversation', conversationReceiver);
    });
  }

  handleGroupEvents(socket, user) {
    socket.on('join-group', async (groupId) => {
      socket.join(groupId);
    });
    socket.on('fetch-group-messages', async (groupId) => {
      try {
        const group = await GroupModel.findById(groupId).populate('messages');
        if (group && group.messages) {
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
              text: decryptedText,
              fileUrl: msg.fileUrl || '',
              fileName: msg.fileName || '',
              fileType: msg.fileType || '',
              hmac: msg.hmac || ''
            };
          });
          socket.emit('group-messages-history', decryptedMessages);
        }
      } catch (error) {
        console.error('Error fetching group messages:', error);
      }
    });
    socket.on('add-group-member', async (data) => {
      try {
        const group = await GroupModel.findById(data.groupId);
        if (!group) {
          socket.emit('error', 'Group not found');
          return;
        }
        if (group.members.includes(data.userId)) {
          socket.emit('error', 'User is already a member');
          return;
        }
        await GroupModel.updateOne(
          { _id: data.groupId },
          { $push: { members: data.userId } }
        );
        const updatedGroup = await GroupModel.findById(data.groupId).populate('members');
        this.io.to(data.groupId).emit('group-member-added', {
          groupId: data.groupId,
          newMember: updatedGroup.members.find(m => m._id.toString() === data.userId)
        });
      } catch (error) {
        console.error('Error adding group member:', error);
        socket.emit('error', 'Failed to add member to group');
      }
    });
  }

  handleEditMessage(socket) {
    socket.on('edit-message', async (data) => {
      try {
        const encryptedText = CryptoHelper.encryptMessage(data.newText);
        const signature = HmacHelper.generateHmac(encryptedText + (data.imageUrl || '') + (data.videoUrl || '') + (data.fileUrl || '') + (data.fileName || '') + (data.fileType || ''));
        const updatedMessage = await MessageModel.findByIdAndUpdate(
          data.messageId,
          {
            text: encryptedText,
            hmac: signature,
            edited: true,
            editedAt: new Date()
          },
          { new: true }
        ).populate('msgByUserId');
        if (data.groupId) {
          this.io.to(data.groupId).emit('message-edited', {
            messageId: data.messageId,
            newText: data.newText,
            edited: true,
            editedAt: updatedMessage.editedAt
          });
        } else {
          this.io.to(data.senderId).emit('message-edited', {
            messageId: data.messageId,
            newText: data.newText,
            edited: true,
            editedAt: updatedMessage.editedAt
          });
          this.io.to(data.receiverId).emit('message-edited', {
            messageId: data.messageId,
            newText: data.newText,
            edited: true,
            editedAt: updatedMessage.editedAt
          });
        }
      } catch (error) {
        console.error('Error editing message:', error);
        socket.emit('error', 'Failed to edit message');
      }
    });
  }

  handleDeleteMessage(socket) {
    socket.on('delete-message', async (data) => {
      try {
        const deletedMessage = await MessageModel.findByIdAndDelete(data.messageId);
        if (data.groupId) {
          await GroupModel.updateOne(
            { _id: data.groupId },
            { $pull: { messages: data.messageId } }
          );
          this.io.to(data.groupId).emit('message-deleted', {
            messageId: data.messageId
          });
        } else {
          this.io.to(data.senderId).emit('message-deleted', {
            messageId: data.messageId
          });
          this.io.to(data.receiverId).emit('message-deleted', {
            messageId: data.messageId
          });
        }
      } catch (error) {
        console.error('Error deleting message:', error);
        socket.emit('error', 'Failed to delete message');
      }
    });
  }

  handleGroupMessage(socket) {
    socket.on('group-message', async (data) => {
      // Debug: log only if text is non-empty and not just emoji
      if (data.text && /[a-zA-Z0-9]/.test(data.text)) {
        console.log('DEBUG: Received PLAINTEXT group-message:', { text: data.text, groupId: data.groupId });
      }
      const encryptedText = CryptoHelper.encryptMessage(data.text);
      const signature = HmacHelper.generateHmac(encryptedText + (data.imageUrl || '') + (data.videoUrl || '') + (data.fileUrl || '') + (data.fileName || '') + (data.fileType || ''));
      const message = new MessageModel({
        text: encryptedText,
        imageUrl: data.imageUrl,
        videoUrl: data.videoUrl,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        msgByUserId: data.senderId,
        hmac: signature
      });
      await message.save();
      if (data.text && /[a-zA-Z0-9]/.test(data.text)) {
        console.log('DEBUG: Saved PLAINTEXT group-message:', { id: message._id, text: data.text });
      }
      await GroupModel.updateOne({ _id: data.groupId }, { $push: { messages: message._id } });
      const populatedMsg = await MessageModel.findById(message._id).populate('msgByUserId');
      let decryptedText;
      try {
        decryptedText = CryptoHelper.decryptMessage(populatedMsg.text);
      } catch (error) {
        console.error('Decryption failed for group message:', error);
        decryptedText = '[Message decryption failed]';
      }
      const decryptedMsg = {
        ...populatedMsg.toObject(),
        text: decryptedText,
        fileUrl: populatedMsg.fileUrl || '',
        fileName: populatedMsg.fileName || '',
        fileType: populatedMsg.fileType || '',
        hmac: populatedMsg.hmac || ''
      };
      if (decryptedText && /[a-zA-Z0-9]/.test(decryptedText)) {
        console.log('DEBUG: Emitting PLAINTEXT group-message:', { id: decryptedMsg._id, text: decryptedText });
      }
      this.io.to(data.groupId).emit('group-message', decryptedMsg);
    });
  }
}

const socketServer = new SocketServer();

module.exports = {
  app: socketServer.app,
  server: socketServer.server
};

