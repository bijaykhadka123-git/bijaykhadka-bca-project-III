import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import Avatar from './Avatar'
import { IoClose } from "react-icons/io5"
import { FaTrash, FaUserPlus, FaUserMinus, FaCrown } from "react-icons/fa"
import Loading from './Loading'

const GroupManagement = ({ groupId, onClose, onGroupDeleted }) => {
  const user = useSelector(state => state?.user)
  const navigate = useNavigate()
  const [groupData, setGroupData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    fetchGroupData()
  }, [groupId])

  const fetchGroupData = async () => {
    try {
      setLoading(true)
      const URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api/group/${groupId}`
      const response = await axios({
        url: URL,
        method: 'GET',
        withCredentials: true
      })
      setGroupData(response.data.group)
    } catch (error) {
      console.error('Failed to fetch group data:', error)
      toast.error('Failed to load group data')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return
    }

    try {
      setLoading(true)
      const URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api/group/delete`
      await axios({
        url: URL,
        method: 'POST',
        data: { groupId, userId: user._id },
        withCredentials: true
      })
      toast.success('Group deleted successfully!')
      onGroupDeleted?.()
      navigate('/')
    } catch (error) {
      console.error('Failed to delete group:', error)
      toast.error(error.response?.data?.message || 'Failed to delete group')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member from the group?')) {
      return
    }

    try {
      const URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api/group/remove-member`
      await axios({
        url: URL,
        method: 'POST',
        data: { 
          groupId, 
          userId: memberId, 
          creatorId: user._id 
        },
        withCredentials: true
      })
      toast.success('Member removed successfully!')
      fetchGroupData()
    } catch (error) {
      console.error('Failed to remove member:', error)
      toast.error(error.response?.data?.message || 'Failed to remove member')
    }
  }

  const handleSearchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      setSearchLoading(true)
      const URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api/search-user`
      const response = await axios({
        url: URL,
        method: 'POST',
        data: { search: query },
        withCredentials: true
      })
      
      // Filter out users who are already members
      const existingMemberIds = groupData?.members?.map(member => member._id) || []
      const filteredResults = response.data.data.filter(user => 
        !existingMemberIds.includes(user._id)
      )
      setSearchResults(filteredResults)
    } catch (error) {
      console.error('Failed to search users:', error)
      toast.error('Failed to search users')
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAddMember = async (userId) => {
    try {
      const URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api/group/add-member`
      await axios({
        url: URL,
        method: 'POST',
        data: { groupId, userId },
        withCredentials: true
      })
      toast.success('User added to group!')
      fetchGroupData()
      setShowAddMember(false)
      setSearchQuery('')
      setSearchResults([])
    } catch (error) {
      console.error('Failed to add user to group:', error)
      toast.error(error.response?.data?.message || 'Failed to add user to group')
    }
  }

  const handleLeaveGroup = async () => {
    if (!groupData || !groupData.creator || !groupId || !user._id) {
      toast.error('Group data not loaded. Please try again.');
      return;
    }
    if (!window.confirm('Are you sure you want to leave this group?')) {
      return;
    }
    try {
      setLoading(true);
      const URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api/group/remove-member`;
      await axios({
        url: URL,
        method: 'POST',
        data: {
          groupId,
          userId: user._id,
          creatorId: groupData.creator._id
        },
        withCredentials: true
      });
      toast.success('You have left the group.');
      onClose();
      navigate('/');
    } catch (error) {
      console.error('Failed to leave group:', error);
      toast.error(error.response?.data?.message || 'Failed to leave group');
    } finally {
      setLoading(false);
    }
  }

  const isCreator = groupData?.creator?._id === user._id

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <Loading />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Group Management</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <IoClose size={20} />
          </button>
        </div>

        {/* Group Info */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3 mb-3">
            <Avatar
              width={50}
              height={50}
              imageUrl={groupData?.groupAvatar}
              name={groupData?.name}
            />
            <div>
              <h3 className="font-semibold text-lg">{groupData?.name}</h3>
              <p className="text-sm text-gray-500">
                {groupData?.members?.length || 0} members
              </p>
            </div>
          </div>
          
          {groupData?.creator && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FaCrown className="text-yellow-500" />
              <span>Created by: {groupData.creator.name}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-b">
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddMember(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <FaUserPlus size={16} />
              Add Member
            </button>
            {isCreator && (
              <button
                onClick={handleDeleteGroup}
                className="flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                title="Delete Group"
              >
                <FaTrash size={16} />
              </button>
            )}
            {!isCreator && (
              <button
                onClick={handleLeaveGroup}
                className="flex items-center justify-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
                title="Leave Group"
                disabled={!groupData || !groupData.creator || loading}
              >
                Leave Group
              </button>
            )}
          </div>
        </div>

        {/* Add Member Section */}
        {showAddMember && (
          <div className="p-4 border-b">
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search users to add..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  handleSearchUsers(e.target.value)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {searchLoading && (
              <div className="flex justify-center py-2">
                <Loading />
              </div>
            )}
            
            {searchResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto">
                {searchResults.map((user) => (
                  <div
                    key={user._id}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar
                        width={32}
                        height={32}
                        imageUrl={user.profilePic}
                        name={user.name}
                      />
                      <span className="text-sm font-medium">{user.name}</span>
                    </div>
                    <button
                      onClick={() => handleAddMember(user._id)}
                      className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={() => {
                setShowAddMember(false)
                setSearchQuery('')
                setSearchResults([])
              }}
              className="mt-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Members List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h4 className="font-semibold mb-3">Members ({groupData?.members?.length || 0})</h4>
            <div className="space-y-2">
              {groupData?.members?.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Avatar
                      width={32}
                      height={32}
                      imageUrl={member.profilePic}
                      name={member.name}
                    />
                    <div>
                      <span className="text-sm font-medium">{member.name}</span>
                      {groupData?.creator?._id === member._id && (
                        <div className="flex items-center gap-1">
                          <FaCrown className="text-yellow-500" size={12} />
                          <span className="text-xs text-gray-500">Creator</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isCreator && groupData?.creator?._id !== member._id && (
                    <button
                      onClick={() => handleRemoveMember(member._id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Remove member"
                    >
                      <FaUserMinus size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GroupManagement 