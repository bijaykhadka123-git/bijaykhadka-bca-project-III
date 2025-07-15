// Helper script to clear existing encrypted messages from database
// Run this if you want to start fresh with the new encryption system

const { MessageModel } = require('../models/ConversationModel');
const CryptoHelper = require('./crypto');

class MessageMaintenanceHelper {
    static async clearEncryptedMessages() {
        try {
            console.log('Clearing all messages from database...');
            // Delete all messages
            const result = await MessageModel.deleteMany({});
            console.log(`Deleted ${result.deletedCount} messages from database`);
            console.log('Database cleared. New messages will use the new encryption system.');
        } catch (error) {
            console.error('Error clearing messages:', error);
        }
    }
}

// Uncomment the line below to run this script
// MessageMaintenanceHelper.clearEncryptedMessages();

module.exports = MessageMaintenanceHelper; 