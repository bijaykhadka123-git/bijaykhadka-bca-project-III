const UserModel = require('../models/UserModel')

class UserTokenHelper {
    static async getUserDetailsFromToken(token) {
        if(!token){
            return {
                message : "session out",
                logout : true,
            }
        }

        // Simple token verification without JWT
        // For now, we'll assume the token is the user ID directly
        try {
            const user = await UserModel.findById(token).select('-password')
            return user
        } catch (error) {
            return {
                message : "session out",
                logout : true,
            }
        }
    }
}

module.exports = UserTokenHelper;