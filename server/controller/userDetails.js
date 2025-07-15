const UserTokenHelper = require("../helpers/getUserDetailsFromToken")

class UserDetailsController {
    static async userDetails(request, response) {
        try {
            const token = request.cookies.token || ""
            const user = await UserTokenHelper.getUserDetailsFromToken(token)
            return response.status(200).json({
                message: "user details",
                data: user
            })
        } catch (error) {
            return response.status(500).json({
                message: error.message || error,
                error: true
            })
        }
    }
}

module.exports = UserDetailsController;