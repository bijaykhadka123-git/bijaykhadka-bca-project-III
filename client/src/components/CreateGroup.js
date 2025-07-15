import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import axios from 'axios'
import { IoClose } from "react-icons/io5";
import Avatar from './Avatar'
import toast from 'react-hot-toast'

const CreateGroup = ({ onClose, onGroupCreated }) => {
  const [groupName, setGroupName] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const user = useSelector(state => state?.user)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api/search-user`
      const response = await axios({
        url: URL,
        method: 'POST',
        data: { search: '' },
        withCredentials: true
      })
      const filteredUsers = response.data.data.filter(u => u._id !== user._id)
      setUsers(filteredUsers)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to fetch users')
    }
  }

  const handleUserSelect = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!groupName.trim() || selectedUsers.length === 0) {
      toast.error('Please enter group name and select at least one member')
      return
    }

    setLoading(true)
    try {
      const URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api/group`
      const response = await axios({
        url: URL,
        method: 'POST',
        data: {
          name: groupName,
          members: [...selectedUsers, user._id],
          creatorId: user._id
        },
        withCredentials: true
      })
      toast.success('Group created successfully!')
      onGroupCreated(response.data.group)
      onClose()
    } catch (error) {
      console.error('Error creating group:', error)
      toast.error(error.response?.data?.message || 'Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Create New Group</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <IoClose size={24} />
          </button>
        </div>

        <form onSubmit={handleCreateGroup}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              placeholder="Enter group name"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Members</label>
            <div className="max-h-40 overflow-y-auto border border-gray-300 rounded">
              {users.map(user => (
                <div
                  key={user._id}
                  onClick={() => handleUserSelect(user._id)}
                  className={`flex items-center p-2 cursor-pointer hover:bg-gray-100 ${
                    selectedUsers.includes(user._id) ? 'bg-blue-100' : ''
                  }`}
                >
                  <Avatar
                    width={32}
                    height={32}
                    imageUrl={user.profile_pic}
                    name={user.name}
                    userId={user._id}
                  />
                  <span className="ml-2">{user.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateGroup 