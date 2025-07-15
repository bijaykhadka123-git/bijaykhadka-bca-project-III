import React, { useState, useRef, useEffect } from 'react'
import { HiDotsVertical } from "react-icons/hi";
import { FaEdit, FaTrash } from "react-icons/fa";
import { useSelector } from 'react-redux'

const MessageActions = ({ message, onEdit, onDelete, isGroup = false, onDeleteChat, showDeleteChat = false }) => {
  const [showActions, setShowActions] = useState(false)
  const [showEditInput, setShowEditInput] = useState(false)
  const [editText, setEditText] = useState(message.text || '')
  const actionsRef = useRef(null)
  const user = useSelector(state => state?.user)

  // Close actions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target)) {
        setShowActions(false)
        setShowEditInput(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Only show actions for user's own messages
  if ((message.msgByUserId?._id || message.msgByUserId)?.toString() !== user._id?.toString()) {
    return null
  }

  const handleEdit = () => {
    setShowEditInput(true)
    setShowActions(false)
  }

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== message.text) {
      onEdit(editText)
    }
    setShowEditInput(false)
  }

  const handleCancelEdit = () => {
    setEditText(message.text || '')
    setShowEditInput(false)
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      onDelete()
    }
    setShowActions(false)
  }

  if (showEditInput) {
    return (
      <div className="flex items-center gap-2 p-2 bg-white rounded shadow">
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="flex-1 p-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          autoFocus
        />
        <button
          onClick={handleSaveEdit}
          className="px-2 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          Save
        </button>
        <button
          onClick={handleCancelEdit}
          className="px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={actionsRef}>
      <button
        onClick={() => setShowActions(!showActions)}
        className="p-1 hover:bg-gray-100 rounded"
      >
        <HiDotsVertical size={16} />
      </button>
      
      {showActions && (
        <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-[120px]">
          <button
            onClick={handleEdit}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 text-sm"
          >
            <FaEdit size={12} />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 text-sm text-red-600"
          >
            <FaTrash size={12} />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default MessageActions 