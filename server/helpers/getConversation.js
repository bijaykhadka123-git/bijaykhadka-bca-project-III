const { ConversationModel } = require("../models/ConversationModel")
const CryptoHelper = require('./crypto')

class ConversationHelper {
    static async getConversation(currentUserId) {
        if(currentUserId){
            const currentUserConversation = await ConversationModel.find({
                "$or" : [
                    { sender : currentUserId },
                    { receiver : currentUserId}
                ]
            }).sort({  updatedAt : -1 }).populate('messages').populate('sender').populate('receiver')

            const conversation = currentUserConversation.map((conv)=>{
                const countUnseenMsg = conv?.messages?.reduce((preve,curr) => {
                    const msgByUserId = curr?.msgByUserId?.toString()

                    if(msgByUserId !== currentUserId){
                        return  preve + (curr?.seen ? 0 : 1)
                    }else{
                        return preve
                    }
                },0)
                // Decrypt the last message text for display
                const lastMsg = conv.messages[conv?.messages?.length - 1]
                let decryptedLastMsg = null;
                if (lastMsg) {
                    try {
                        const decryptedText = CryptoHelper.decryptMessage(lastMsg.text);
                        decryptedLastMsg = {
                            ...lastMsg.toObject(),
                            text: decryptedText
                        };
                    } catch (error) {
                        console.error('Decryption failed for last message:', error);
                        decryptedLastMsg = {
                            ...lastMsg.toObject(),
                            text: '[Message decryption failed]'
                        };
                    }
                }
                return{
                    _id : conv?._id,
                    sender : conv?.sender,
                    receiver : conv?.receiver,
                    unseenMsg : countUnseenMsg,
                    lastMsg : decryptedLastMsg
                }
            })
            return conversation
        }else{
            return []
        }
    }
}

module.exports = ConversationHelper