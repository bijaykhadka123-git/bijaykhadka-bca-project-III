import React, { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useParams } from 'react-router-dom'
import Avatar from './Avatar'
import { HiDotsVertical } from "react-icons/hi";
import { FaAngleLeft } from "react-icons/fa6";
import { FaPlus } from "react-icons/fa6";
import { FaImage } from "react-icons/fa6";
import { FaVideo } from "react-icons/fa6";
import { FaSmile } from "react-icons/fa";
import uploadFile from '../helpers/uploadFile';
import { IoClose } from "react-icons/io5";
import Loading from './Loading';
import backgroundImage from '../assets/wallapaper.jpeg'
import { IoMdSend } from "react-icons/io";
import moment from 'moment'
import axios from 'axios'
import { toast } from 'react-hot-toast';
import MessageActions from './MessageActions';
import GroupManagement from './GroupManagement';
import EmojiPicker from 'emoji-picker-react';
import Crypto from '../shared/crypto';
import { FaFile } from "react-icons/fa6";

let tamperedToastActive = false;

const GroupMessagePage = () => {
  const socketConnection = useSelector(state => state?.user?.socketConnection)
  const user = useSelector(state => state?.user)
  const [openImageVideoUpload, setOpenImageVideoUpload] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [message, setMessage] = useState({
    text: "",
    imageUrl: "",
    videoUrl: "",
    fileUrl: "",
    fileName: "",
    fileType: ""
  })
  const [loading, setLoading] = useState(false)
  const [allMessage, setAllMessage] = useState([])
  const currentMessage = useRef(null)
  const { groupId } = useParams()
  const [groupData, setGroupData] = useState(null)
  const [showGroupManagement, setShowGroupManagement] = useState(false)

  useEffect(() => {
    if (currentMessage.current) {
      currentMessage.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [allMessage])

  useEffect(() => {
    if (socketConnection && groupId) {
      socketConnection.emit('join-group', groupId)
      socketConnection.emit('fetch-group-messages', groupId)
      socketConnection.on('group-message', async (msg) => {
        setAllMessage(prev => {
          const updated = [...prev, msg];
          // Check for tampered messages after new message
          checkTamperedWarning([...prev, msg]);
          return updated;
        });
      })
      socketConnection.on('group-messages-history', async (messages) => {
        // First, check for any tampered messages in the original array
        let tampered = false;
        for (const msg of messages) {
          const hmacInput =
            (msg.encryptedText || msg.text) +
            (msg.imageUrl || '') +
            (msg.videoUrl || '') +
            (msg.fileUrl || '') +
            (msg.fileName || '') +
            (msg.fileType || '');
          if (msg.hmac) {
            const valid = await Crypto.verifyHMAC(hmacInput, msg.hmac);
            if (!valid) {
              tampered = true;
              break;
            }
          }
        }
        // Show only one warning at a time
        if (tampered && !tamperedToastActive) {
          tamperedToastActive = true;
          toast.error('A message was tampered with and has been hidden for your security!', {
            duration: 5000,
            onClose: () => { tamperedToastActive = false; }
          });
        }
        // Now filter out tampered messages for display
        const verifiedMessages = [];
        for (const msg of messages) {
          const hmacInput =
            (msg.encryptedText || msg.text) +
            (msg.imageUrl || '') +
            (msg.videoUrl || '') +
            (msg.fileUrl || '') +
            (msg.fileName || '') +
            (msg.fileType || '');
          if (msg.hmac) {
            const valid = await Crypto.verifyHMAC(hmacInput, msg.hmac);
            if (valid) {
              verifiedMessages.push(msg);
            }
          } else {
            verifiedMessages.push(msg);
          }
        }
        setAllMessage(verifiedMessages);
      })
      socketConnection.on('group-member-added', (data) => {
        if (data.groupId === groupId) {
          toast.success(`${data.newMember.name} joined the group!`)
          fetchGroupData()
        }
      })
      socketConnection.on('message-edited', (data) => {
        setAllMessage(prev => {
          const updated = prev.map(msg => 
            msg._id === data.messageId 
              ? { ...msg, text: data.newText, edited: true, editedAt: data.editedAt }
              : msg
          );
          checkTamperedWarning(updated);
          return updated;
        })
      })
      socketConnection.on('message-deleted', (data) => {
        setAllMessage(prev => {
          const updated = prev.filter(msg => msg._id !== data.messageId);
          checkTamperedWarning(updated);
          return updated;
        })
      })
    }
    return () => {
      if (socketConnection) {
        socketConnection.off('group-message')
        socketConnection.off('group-messages-history')
        socketConnection.off('group-member-added')
        socketConnection.off('message-edited')
        socketConnection.off('message-deleted')
      }
    }
  }, [socketConnection, groupId])

  // Helper to check and show tampered warning only once per session
  const checkTamperedWarning = async (messages, forceTampered) => {
    const warningKey = `tamperedWarningShown_group_${groupId}`;
    let tampered = typeof forceTampered === 'boolean' ? forceTampered : false;
    if (typeof forceTampered !== 'boolean') {
      for (const msg of messages) {
        const hmacInput =
          (msg.encryptedText || msg.text) +
          (msg.imageUrl || '') +
          (msg.videoUrl || '') +
          (msg.fileUrl || '') +
          (msg.fileName || '') +
          (msg.fileType || '');
        if (msg.hmac) {
          const valid = await Crypto.verifyHMAC(hmacInput, msg.hmac);
          if (!valid) {
            tampered = true;
            break;
          }
        }
      }
    }
    if (tampered && !sessionStorage.getItem(warningKey)) {
      toast.error('A message was tampered with and has been hidden for your security!', { duration: 5000 });
      sessionStorage.setItem(warningKey, 'true');
    }
    // Only clear the warning if there are NO tampered messages at all and the key is set
    if (!tampered && sessionStorage.getItem(warningKey)) {
      sessionStorage.removeItem(warningKey);
    }
  };

  useEffect(() => {
    if (user._id && groupId) {
      fetchGroupData();
    }
  }, [user._id, groupId]);

  const fetchGroupData = async () => {
    try {
      const URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api/groups/${user._id}`
      const response = await axios({
        url: URL,
        method: 'GET',
        withCredentials: true
      })
      const group = response.data.groups.find(g => g._id === groupId)
      setGroupData(group)
    } catch (error) {
      console.error('Failed to fetch group data:', error)
    }
  }

  const handleUploadImageVideoOpen = () => {
    setOpenImageVideoUpload(prev => !prev)
  }

  const handleUploadImage = async (e) => {
    const file = e.target.files[0]
    setLoading(true)
    const uploadPhoto = await uploadFile(file)
    setLoading(false)
    setOpenImageVideoUpload(false)
    setMessage(prev => ({
      ...prev,
      imageUrl: uploadPhoto.url
    }))
  }

  const handleClearUploadImage = () => {
    setMessage(prev => ({
      ...prev,
      imageUrl: ""
    }))
  }

  const handleUploadVideo = async (e) => {
    const file = e.target.files[0]
    setLoading(true)
    const uploadPhoto = await uploadFile(file)
    setLoading(false)
    setOpenImageVideoUpload(false)
    setMessage(prev => ({
      ...prev,
      videoUrl: uploadPhoto.url
    }))
  }

  const handleClearUploadVideo = () => {
    setMessage(prev => ({
      ...prev,
      videoUrl: ""
    }))
  }

  const handleUploadFile = async (e) => {
    const file = e.target.files[0];
    setLoading(true);
    const uploadRes = await uploadFile(file);
    setLoading(false);
    setOpenImageVideoUpload(false);
    setMessage(prev => ({
      ...prev,
      fileUrl: uploadRes.url,
      fileName: file.name,
      fileType: file.type
    }));
  };

  const handleEmojiClick = (emojiObject) => {
    setMessage(prev => ({
      ...prev,
      text: prev.text + emojiObject.emoji
    }))
  }

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(prev => !prev)
    setOpenImageVideoUpload(false)
  }

  const handleOnChange = (e) => {
    setMessage(prev => ({
      ...prev,
      text: e.target.value
    }))
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (message.text || message.imageUrl || message.videoUrl || message.fileUrl) {
      if (socketConnection) {
        console.log('DEBUG: Emitting group-message:', {
          groupId: groupId,
          senderId: user._id,
          text: message.text,
          imageUrl: message.imageUrl || '',
          videoUrl: message.videoUrl || '',
          fileUrl: message.fileUrl || '',
          fileName: message.fileName || '',
          fileType: message.fileType || ''
        });
        socketConnection.emit('group-message', {
          groupId: groupId,
          senderId: user._id,
          text: message.text,
          imageUrl: message.imageUrl || '',
          videoUrl: message.videoUrl || '',
          fileUrl: message.fileUrl || '',
          fileName: message.fileName || '',
          fileType: message.fileType || ''
        })
        
        setMessage({
          text: "",
          imageUrl: "",
          videoUrl: "",
          fileUrl: "",
          fileName: "",
          fileType: ""
        })
      }
    }
  }

  const handleEditMessage = (messageId, newText) => {
    if (socketConnection) {
      socketConnection.emit('edit-message', {
        messageId,
        newText,
        groupId: groupId,
        senderId: user._id
      })
      toast.success('Message edited successfully!')
    }
  }

  const handleDeleteMessage = (messageId) => {
    if (socketConnection) {
      socketConnection.emit('delete-message', {
        messageId,
        groupId: groupId,
        senderId: user._id
      });
      toast.success('Message deleted successfully!');
    }
  };

  const handleGroupDeleted = () => {
    // Group was deleted, redirect to home
    window.location.href = '/'
  }

  return (
    <div style={{ backgroundImage: `url(${backgroundImage})` }} className='bg-no-repeat bg-cover'>
      <header className='sticky top-0 h-16 bg-white flex justify-between items-center px-4'>
        <div className='flex items-center gap-4'>
          <Link to={"/"} className='lg:hidden'>
            <FaAngleLeft size={25} />
          </Link>
          <div>
            <Avatar
              width={50}
              height={50}
              imageUrl={groupData?.groupAvatar}
              name={groupData?.name}
            />
          </div>
          <div>
            <h3 className='font-semibold text-lg my-0 text-ellipsis line-clamp-1'>{groupData?.name}</h3>
            <p className='-my-2 text-sm text-slate-400'>
              {groupData?.members?.length || 0} members
            </p>
          </div>
        </div>

        <div>
          <button 
            onClick={() => setShowGroupManagement(true)} 
            className='cursor-pointer hover:text-primary'
            title='Group Management'
          >
            <HiDotsVertical size={20}/>
          </button>
        </div>
      </header>

      <section className='h-[calc(100vh-128px)] overflow-x-hidden overflow-y-scroll scrollbar relative bg-slate-200 bg-opacity-50'>
        <div className='flex flex-col gap-2 py-2 mx-2' ref={currentMessage}>
          {allMessage.map((msg, index) => {
            const isOwnMessage = user._id === (msg?.msgByUserId?._id || msg?.msgByUserId);
            // Allow messages with any content (text, image, video, or file)
            const hasContent =
              (msg.text && msg.text.trim() !== '') ||
              (msg.imageUrl && msg.imageUrl.trim() !== '') ||
              (msg.videoUrl && msg.videoUrl.trim() !== '') ||
              (msg.fileUrl && msg.fileUrl.trim() !== '');
            let fileUrl = '';
            if (msg?.fileUrl) {
              const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
              fileUrl = msg.fileUrl.startsWith('http') ? msg.fileUrl : backendUrl + msg.fileUrl;
            }
            let imageUrl = '';
            if (msg?.imageUrl) {
              const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
              imageUrl = msg.imageUrl.startsWith('http') ? msg.imageUrl : backendUrl + msg.imageUrl;
            }
            let videoUrl = '';
            if (msg?.videoUrl) {
              const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
              videoUrl = msg.videoUrl.startsWith('http') ? msg.videoUrl : backendUrl + msg.videoUrl;
            }
            return (
              <div key={msg._id || index} className={`p-1 py-1 rounded w-fit max-w-[280px] md:max-w-sm lg:max-w-md ${isOwnMessage ? "ml-auto bg-teal-100" : "bg-white"}`}>
                <div className='w-full relative'>
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      className='message-image'
                    />
                  )}
                  {videoUrl && (
                    <video
                      src={videoUrl}
                      className='w-full h-full object-scale-down'
                      controls
                    />
                  )}
                  {fileUrl && (
                    <a href={fileUrl} download={msg.fileName} className='flex items-center gap-2 text-blue-600 hover:underline'>
                      <FaFile size={18}/>
                      <span>{msg.fileName || 'Download file'}</span>
                    </a>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className='px-2'>{msg.text}</p>
                    {msg.edited && (
                      <p className='text-xs text-gray-500 px-2 italic'>edited</p>
                    )}
                    <p className='text-xs ml-auto w-fit'>{moment(msg.createdAt).format('hh:mm')}</p>
                  </div>
                  <MessageActions
                    message={msg}
                    onEdit={(newText) => handleEditMessage(msg._id, newText)}
                    onDelete={() => handleDeleteMessage(msg._id)}
                    isGroup={true}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {message.imageUrl && (
          <div className='w-full h-full sticky bottom-0 bg-slate-700 bg-opacity-30 flex justify-center items-center rounded overflow-hidden'>
            <div className='w-fit p-2 absolute top-0 right-0 cursor-pointer hover:text-red-600' onClick={handleClearUploadImage}>
              <IoClose size={30} />
            </div>
            <div className='bg-white p-3'>
              <img
                src={message.imageUrl}
                alt='uploadImage'
                className='message-image m-2'
              />
            </div>
          </div>
        )}

        {message.videoUrl && (
          <div className='w-full h-full sticky bottom-0 bg-slate-700 bg-opacity-30 flex justify-center items-center rounded overflow-hidden'>
            <div className='w-fit p-2 absolute top-0 right-0 cursor-pointer hover:text-red-600' onClick={handleClearUploadVideo}>
              <IoClose size={30} />
            </div>
            <div className='bg-white p-3'>
              <video
                src={message.videoUrl}
                className='aspect-square w-full h-full max-w-sm m-2 object-scale-down'
                controls
                muted
                autoPlay
              />
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-blue-500 mt-2">
            <span>Uploading file...</span>
          </div>
        )}
      </section>

      <section className='h-16 bg-white flex items-center px-4'>
        <div className='relative'>
          <button onClick={handleUploadImageVideoOpen} className='flex justify-center items-center w-11 h-11 rounded-full hover:bg-primary hover:text-white'>
            <FaPlus size={20} />
          </button>

          {openImageVideoUpload && (
            <div className='bg-white shadow rounded absolute bottom-14 w-36 p-2'>
              <form>
                <label htmlFor='uploadImage' className='flex items-center p-2 px-3 gap-3 hover:bg-slate-200 cursor-pointer'>
                  <div className='text-primary'>
                    <FaImage size={18} />
                  </div>
                  <p>Image</p>
                </label>
                <label htmlFor='uploadVideo' className='flex items-center p-2 px-3 gap-3 hover:bg-slate-200 cursor-pointer'>
                  <div className='text-purple-500'>
                    <FaVideo size={18} />
                  </div>
                  <p>Video</p>
                </label>
                <label htmlFor='uploadFile' className='flex items-center p-2 px-3 gap-3 hover:bg-slate-200 cursor-pointer'>
                  <div className='text-blue-500'>
                    <FaFile size={18}/>
                  </div>
                  <p>File</p>
                </label>

                <input
                  type='file'
                  id='uploadImage'
                  onChange={handleUploadImage}
                  className='hidden'
                />

                <input
                  type='file'
                  id='uploadVideo'
                  onChange={handleUploadVideo}
                  className='hidden'
                />
                <input
                  type='file'
                  id='uploadFile'
                  onChange={handleUploadFile}
                  className='hidden'
                />
              </form>
            </div>
          )}
        </div>

        {/**emoji picker button */}
        <div className='relative'>
          <button onClick={toggleEmojiPicker} className='flex justify-center items-center w-11 h-11 rounded-full hover:bg-primary hover:text-white'>
            <FaSmile size={20}/>
          </button>
          
          {showEmojiPicker && (
            <div className='absolute bottom-14 right-0 z-50'>
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
          )}
        </div>

        <form className='h-full w-full flex gap-2' onSubmit={handleSendMessage}>
          <input
            type='text'
            placeholder='Type here message...'
            className='py-1 px-4 outline-none w-full h-full'
            value={message.text}
            onChange={handleOnChange}
          />
          {message.fileUrl && !loading && (
            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded mt-2">
              <FaFile size={18} className="text-blue-500" />
              <span className="truncate max-w-xs">{message.fileName}</span>
              <button
                onClick={() => setMessage(prev => ({ ...prev, fileUrl: '', fileName: '', fileType: '' }))}
                className="text-red-500 hover:text-red-700"
                title="Remove file"
              >
                <IoClose size={18} />
              </button>
            </div>
          )}
          <button className='text-primary hover:text-secondary'>
            <IoMdSend size={28} />
          </button>
        </form>
      </section>

      {showGroupManagement && (
        <GroupManagement
          groupId={groupId}
          onClose={() => setShowGroupManagement(false)}
          onGroupDeleted={handleGroupDeleted}
        />
      )}
    </div>
  )
}

export default GroupMessagePage 