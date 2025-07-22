const express = require('express')
const RegisterUserController = require('../controller/registerUser')
const CheckEmailController = require('../controller/checkEmail')
const CheckPasswordController = require('../controller/checkPassword')
const UserDetailsController = require('../controller/userDetails')
const LogoutController = require('../controller/logout')
const UpdateUserDetailsController = require('../controller/updateUserDetails')
const SearchUserController = require('../controller/searchUser')
const { upload, uploadFileController } = require('../controller/uploadFileController')
const GroupController = require('../controller/groupController')
const MessageController = require('../controller/messageController')

const router = express.Router()

//create user api
router.post('/register', RegisterUserController.registerUser)
//check user email
router.post('/email', CheckEmailController.checkEmail)
//check user password
router.post('/password', CheckPasswordController.checkPassword)
//login user details
router.get('/user-details', UserDetailsController.userDetails)
//logout user
router.get('/logout', LogoutController.logout)
//update user details
router.post('/update-user', UpdateUserDetailsController.updateUserDetails)
//search user
router.post('/search-user', SearchUserController.searchUser)
//upload file - using multer for temp storage then Cloudinary
router.post('/upload', upload.single('file'), uploadFileController);
// Group chat APIs
router.post('/group', GroupController.createGroup)
router.get('/groups/:userId', GroupController.getGroupsForUser)
router.get('/group/:groupId', GroupController.getGroupDetails)
router.post('/group/message', GroupController.sendGroupMessage)
router.post('/group/add-member', GroupController.addMemberToGroup)
router.post('/group/remove-member', GroupController.removeMemberFromGroup)
router.post('/group/delete', GroupController.deleteGroup)
// Message operations
router.put('/message/edit', MessageController.editMessage)
router.delete('/message/delete', MessageController.deleteMessage)
router.post('/conversation/soft-delete', MessageController.softDeleteConversation)
router.get('/conversations/find/:userId1/:userId2', MessageController.findConversationByUserIds);

module.exports = router