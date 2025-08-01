const UserModel = require("../models/UserModel")
const bcryptjs = require('bcryptjs')

class CheckPasswordController {
    static async checkPassword(request, response) {
        try {
            const { password, userId } = request.body
            const user = await UserModel.findById(userId)
            const verifyPassword = await bcryptjs.compare(password, user.password)
            if (!verifyPassword) {
                return response.status(400).json({
                    message: "Please check password",
                    error: true
                })
            }
            // Simple token approach - just use user ID as token
            const token = user._id.toString()
            const cookieOptions = {
                http: true,
                secure: true,
                sameSite: 'None'
            }
            return response.cookie('token', token, cookieOptions).status(200).json({
                message: "Login successfully",
                token: token,
                success: true
            })
        } catch (error) {
            return response.status(500).json({
                message: error.message || error,
                error: true
            })
        }
    }
}

module.exports = CheckPasswordController;