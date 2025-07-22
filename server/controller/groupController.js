const GroupModel = require('../models/GroupModel')
const { MessageModel } = require('../models/ConversationModel')
const CryptoHelper = require('../../shared/crypto');
const HmacHelper = require('../helpers/hmac')

class GroupController {
    static async createGroup(req, res) {
        try {
            const { name, members, groupAvatar } = req.body
            if (!name || !members || members.length < 1) {
                return res.status(400).json({ message: 'Group name and at least 1 member required', error: true })
            }
            const creator = members.find(member => member === req.body.creatorId) || members[0]
            const group = new GroupModel({ name, members, creator, groupAvatar })
            await group.save()
            res.status(201).json({ message: 'Group created', group, success: true })
        } catch (error) {
            res.status(500).json({ message: error.message, error: true })
        }
    }

    static async getGroupsForUser(req, res) {
        try {
            const { userId } = req.params
            const groups = await GroupModel.find({ members: userId })
                .populate('members creator messages')
            res.json({ message: 'Groups fetched', groups, success: true })
        } catch (error) {
            res.status(500).json({ message: error.message, error: true })
        }
    }

    static async getGroupDetails(req, res) {
        try {
            const { groupId } = req.params
            const group = await GroupModel.findById(groupId)
                .populate('members creator messages')
            if (!group) {
                return res.status(404).json({ message: 'Group not found', error: true })
            }
            res.json({ message: 'Group details fetched', group, success: true })
        } catch (error) {
            res.status(500).json({ message: error.message, error: true })
        }
    }

    static async sendGroupMessage(req, res) {
        try {
            const { groupId, senderId, text, imageUrl, videoUrl, fileUrl, fileName, fileType } = req.body;
            const encryptedText = CryptoHelper.encryptMessage(text);
            // HMAC input must match socket server and frontend
            const hmacInput = encryptedText + (imageUrl || '') + (videoUrl || '') + (fileUrl || '') + (fileName || '') + (fileType || '');
            const hmac = HmacHelper.generateHmac(hmacInput);
            const message = new MessageModel({
                text: encryptedText,
                imageUrl,
                videoUrl,
                fileUrl,
                fileName,
                fileType,
                msgByUserId: senderId,
                hmac
            });
            await message.save();
            await GroupModel.updateOne({ _id: groupId }, { $push: { messages: message._id } });
            res.json({ message: 'Message sent', success: true });
        } catch (error) {
            res.status(500).json({ message: error.message, error: true });
        }
    }

    static async addMemberToGroup(req, res) {
        try {
            const { groupId, userId } = req.body
            if (!groupId || !userId) {
                return res.status(400).json({ message: 'Group ID and User ID are required', error: true })
            }
            const group = await GroupModel.findById(groupId)
            if (!group) {
                return res.status(404).json({ message: 'Group not found', error: true })
            }
            if (group.members.includes(userId)) {
                return res.status(400).json({ message: 'User is already a member of this group', error: true })
            }
            await GroupModel.updateOne(
                { _id: groupId },
                { $push: { members: userId } }
            )
            res.json({ message: 'User added to group successfully', success: true })
        } catch (error) {
            res.status(500).json({ message: error.message, error: true })
        }
    }

    static async removeMemberFromGroup(req, res) {
        try {
            const { groupId, userId, creatorId } = req.body
            if (!groupId || !userId || !creatorId) {
                return res.status(400).json({ message: 'Group ID, User ID, and Creator ID are required', error: true })
            }
            const group = await GroupModel.findById(groupId)
            if (!group) {
                return res.status(404).json({ message: 'Group not found', error: true })
            }
            if (userId === creatorId && group.creator.toString() === creatorId) {
                return res.status(400).json({ message: 'Creator cannot leave the group. Delete the group instead.', error: true })
            }
            if (userId !== creatorId && group.creator.toString() !== creatorId) {
                return res.status(403).json({ message: 'Only the group creator can remove other members', error: true })
            }
            if (!group.members.includes(userId)) {
                return res.status(400).json({ message: 'User is not a member of this group', error: true })
            }
            await GroupModel.updateOne(
                { _id: groupId },
                { $pull: { members: userId } }
            )
            res.json({ message: 'User removed from group successfully', success: true })
        } catch (error) {
            res.status(500).json({ message: error.message, error: true })
        }
    }

    static async deleteGroup(req, res) {
        try {
            const { groupId, userId } = req.body
            if (!groupId || !userId) {
                return res.status(400).json({ message: 'Group ID and User ID are required', error: true })
            }
            const group = await GroupModel.findById(groupId)
            if (!group) {
                return res.status(404).json({ message: 'Group not found', error: true })
            }
            if (group.creator.toString() !== userId) {
                return res.status(403).json({ message: 'Only the group creator can delete the group', error: true })
            }
            await MessageModel.deleteMany({ _id: { $in: group.messages } })
            await GroupModel.findByIdAndDelete(groupId)
            res.json({ message: 'Group deleted successfully', success: true })
        } catch (error) {
            res.status(500).json({ message: error.message, error: true })
        }
    }
}

module.exports = GroupController; 