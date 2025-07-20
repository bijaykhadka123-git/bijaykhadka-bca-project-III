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
import MessageActions from './MessageActions';
import toast from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import { decryptMessage, verifyHMAC } from '../shared/crypto';
import axios from 'axios';
import { FaTrash } from "react-icons/fa6";

const MessagePage = () => {
  const params = useParams()
  const socketConnection = useSelector(state => state?.user?.socketConnection)
  const user = useSelector(state => state?.user)
  const [dataUser,setDataUser] = useState({
    name : "",
    email : "",
    profile_pic : "",
    online : false,
    _id : ""
  })
  const [openImageVideoUpload,setOpenImageVideoUpload] = useState(false)
  const [showEmojiPicker,setShowEmojiPicker] = useState(false)
  const [message,setMessage] = useState({
    text : "",
    imageUrl : "",
    videoUrl : ""
  })
  const [loading,setLoading] = useState(false)
  const [allMessage,setAllMessage] = useState([])
  const currentMessage = useRef(null)
  const [tamperedDetected, setTamperedDetected] = useState(false);
  const tamperedToastShown = useRef(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  useEffect(()=>{
      if(currentMessage.current){
          currentMessage.current.scrollIntoView({behavior : 'smooth', block : 'end'})
      }
  },[allMessage])

  useEffect(() => {
    // Fetch the conversation ID when the component mounts
    const fetchConversationId = async () => {
      try {
        if (user?._id && params.userId) {
          console.log('Fetching conversation for:', user._id, params.userId);
          const response = await axios.get(`/api/conversations/find/${user._id}/${params.userId}`, { withCredentials: true });
          console.log('API response:', response.data);
          if (response.data && response.data._id) {
            setConversationId(response.data._id);
            console.log('Set conversationId:', response.data._id);
          } else {
            setConversationId(null);
            console.log('No conversation found.');
          }
        }
      } catch (error) {
        setConversationId(null);
        console.log('Error fetching conversation:', error);
      }
    };
    fetchConversationId();
  }, [user?._id, params.userId]);

  const handleUploadImageVideoOpen = ()=>{
    setOpenImageVideoUpload(preve => !preve)
  }

  const handleUploadImage = async(e)=>{
    const file = e.target.files[0]

    setLoading(true)
    const uploadPhoto = await uploadFile(file)
    setLoading(false)
    setOpenImageVideoUpload(false)

    setMessage(preve => {
      return{
        ...preve,
        imageUrl : uploadPhoto.url
      }
    })
  }
  const handleClearUploadImage = ()=>{
    setMessage(preve => {
      return{
        ...preve,
        imageUrl : ""
      }
    })
  }

  const handleUploadVideo = async(e)=>{
    const file = e.target.files[0]

    setLoading(true)
    const uploadPhoto = await uploadFile(file)
    setLoading(false)
    setOpenImageVideoUpload(false)

    setMessage(preve => {
      return{
        ...preve,
        videoUrl : uploadPhoto.url
      }
    })
  }
  const handleClearUploadVideo = ()=>{
    setMessage(preve => {
      return{
        ...preve,
        videoUrl : ""
      }
    })
  }

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

  useEffect(()=>{
      if(socketConnection){
        socketConnection.emit('message-page',params.userId)
        socketConnection.emit('seen',params.userId)
        socketConnection.on('message-user',(data)=>{
          setDataUser(data)
        }) 
        
        socketConnection.on('message', async (data) => {
          // Debug: log all messages received from the server
          console.log('ALL MESSAGES FROM SERVER:', data);
          // HMAC verification for each message
          const verifiedMessages = [];
          let tampered = false;
          for (const msg of data) {
            // If message has hmac field, verify it
            const hmacInput = (msg.encryptedText || msg.text) + (msg.imageUrl || '') + (msg.videoUrl || '');
            console.log('CLIENT HMAC INPUT:', hmacInput, 'HMAC:', msg.hmac, 'ENCRYPTED:', msg.encryptedText, 'TEXT:', msg.text);
            if (msg.hmac) {
              const valid = await verifyHMAC(hmacInput, msg.hmac);
              if (valid) {
                verifiedMessages.push(msg);
              } else {
                tampered = true;
              }
            } else {
              // If no hmac, just show (legacy or system message)
              verifiedMessages.push(msg);
            }
          }
          // Debug: log verified messages that will be shown in the UI
          console.log('VERIFIED MESSAGES FOR UI:', verifiedMessages);
          setAllMessage(verifiedMessages);
          setTamperedDetected(tampered);
          if (tampered && !tamperedToastShown.current) {
            toast.error('A message was tampered with and has been hidden for your security!', { duration: 5000 });
            tamperedToastShown.current = true;
          }
        })

        // Listen for message edit events
        socketConnection.on('message-edited', (data) => {
          setAllMessage(prev => prev.map(msg => 
            msg._id === data.messageId 
              ? { ...msg, text: data.newText, edited: true, editedAt: data.editedAt }
              : msg
          ))
        })

        // Listen for message delete events
        socketConnection.on('message-deleted', (data) => {
          setAllMessage(prev => prev.filter(msg => msg._id !== data.messageId))
        })
      }
  },[socketConnection,params?.userId,user])

  const handleOnChange = (e)=>{
    const { name, value} = e.target

    setMessage(preve => {
      return{
        ...preve,
        text : value
      }
    })
  }

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.text || message.imageUrl || message.videoUrl) {
      if (socketConnection) {
        socketConnection.emit('new message', {
          sender: user._id,
          receiver: params.userId,
          text: message.text,
          imageUrl: message.imageUrl,
          videoUrl: message.videoUrl,
          msgByUserId: user._id
        });

        // If you optimistically add the message to the UI, do it like this:
        setAllMessage(prev => [
          ...prev,
          {
            text: message.text,
            imageUrl: message.imageUrl,
            videoUrl: message.videoUrl,
            msgByUserId: user._id, // <-- THIS LINE IS ALSO IMPORTANT
            createdAt: new Date(),
            // add any other fields you need for display
          }
        ]);

        setMessage({
          text: "",
          imageUrl: "",
          videoUrl: ""
        });
      }
    }
  };

  const handleEditMessage = (messageId, newText) => {
    if (socketConnection) {
      socketConnection.emit('edit-message', {
        messageId,
        newText,
        senderId: user._id,
        receiverId: params.userId
      })
      toast.success('Message edited successfully!')
    }
  }

  const handleDeleteMessage = (messageId) => {
    if (socketConnection) {
      socketConnection.emit('delete-message', {
        messageId,
        senderId: user._id,
        receiverId: params.userId
      })
      toast.success('Message deleted successfully!')
    }
  }

  return (
    <div style={{ backgroundImage : `url(${backgroundImage})`}} className='bg-no-repeat bg-cover'>
          <header className='sticky top-0 h-16 bg-white flex justify-between items-center px-4 z-50'>
              <div className='flex items-center gap-4'>
                  <Link to={"/"} className='lg:hidden'>
                      <FaAngleLeft size={25}/>
                  </Link>
                  <div>
                      <Avatar
                        width={50}
                        height={50}
                        imageUrl={dataUser?.profile_pic}
                        name={dataUser?.name}
                        userId={dataUser?._id}
                      />
                  </div>
                  <div>
                     <h3 className='font-semibold text-lg my-0 text-ellipsis line-clamp-1'>{dataUser?.name}</h3>
                     <p className='-my-2 text-sm'>
                      {
                        dataUser.online ? <span className='text-primary'>online</span> : <span className='text-slate-400'>offline</span>
                      }
                     </p>
                  </div>
              </div>

              <div className='relative'>
                    <button className='cursor-pointer hover:text-primary' onClick={() => setShowHeaderMenu(v => !v)}>
                      <HiDotsVertical/>
                    </button>
                    {showHeaderMenu && (
                      <div className='absolute right-0 top-8 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[140px]'>
                        <button
                          onClick={() => {
                            setShowHeaderMenu(false);
                          }}
                          className='w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 text-sm text-red-700 border-t border-gray-200'
                        >
                          <FaTrash size={12} />
                          Delete Conversation
                        </button>
                      </div>
                    )}
              </div>
          </header>

          {/***show all message */}
          <section className='h-[calc(100vh-128px)] overflow-x-hidden overflow-y-scroll scrollbar relative bg-slate-200 bg-opacity-50'>
                  
                
                  {/**all message show here */}
                  <div className='flex flex-col gap-2 py-2 mx-2' ref={currentMessage}>
                    {
                      allMessage.map((msg,index)=>{
                        return(
                          <div key={msg._id || index} className={`p-1 py-1 rounded w-fit max-w-[280px] md:max-w-sm lg:max-w-md ${user._id === msg?.msgByUserId ? "ml-auto bg-teal-100" : "bg-white"}`}>
                            <div className='w-full relative'>
                              {
                                msg?.imageUrl && (
                                  <img 
                                    src={msg?.imageUrl}
                                    className='w-full h-full object-scale-down'
                                  />
                                )
                              }
                              {
                                msg?.videoUrl && (
                                  <video
                                    src={msg.videoUrl}
                                    className='w-full h-full object-scale-down'
                                    controls
                                  />
                                )
                              }
                            </div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className='px-2'>{decryptMessage(msg.text)}</p>
                                {msg.edited && (
                                  <p className='text-xs text-gray-500 px-2 italic'>edited</p>
                                )}
                                <p className='text-xs ml-auto w-fit'>{moment(msg.createdAt).format('hh:mm')}</p>
                              </div>
                              <MessageActions
                                message={msg}
                                onEdit={(newText) => handleEditMessage(msg._id, newText)}
                                onDelete={() => handleDeleteMessage(msg._id)}
                              />
                            </div>
                          </div>
                        )
                      })
                    }
                  </div>


                  {/**upload Image display */}
                  {
                    message.imageUrl && (
                      <div className='w-full h-full sticky bottom-0 bg-slate-700 bg-opacity-30 flex justify-center items-center rounded overflow-hidden'>
                        <div className='w-fit p-2 absolute top-0 right-0 cursor-pointer hover:text-red-600' onClick={handleClearUploadImage}>
                            <IoClose size={30}/>
                        </div>
                        <div className='bg-white p-3'>
                            <img
                              src={message.imageUrl}
                              alt='uploadImage'
                              className='aspect-square w-full h-full max-w-sm m-2 object-scale-down'
                            />
                        </div>
                      </div>
                    )
                  }

                  {/**upload video display */}
                  {
                    message.videoUrl && (
                      <div className='w-full h-full sticky bottom-0 bg-slate-700 bg-opacity-30 flex justify-center items-center rounded overflow-hidden'>
                        <div className='w-fit p-2 absolute top-0 right-0 cursor-pointer hover:text-red-600' onClick={handleClearUploadVideo}>
                            <IoClose size={30}/>
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
                    )
                  }

                  {
                    loading && (
                      <div className='w-full h-full flex sticky bottom-0 justify-center items-center'>
                        <Loading/>
                      </div>
                    )
                  }
          </section>

          {/**send message */}
          <section className='h-16 bg-white flex items-center px-4'>
              <div className='relative '>
                  <button onClick={handleUploadImageVideoOpen} className='flex justify-center items-center w-11 h-11 rounded-full hover:bg-primary hover:text-white'>
                    <FaPlus size={20}/>
                  </button>

                  {/**video and image */}
                  {
                    openImageVideoUpload && (
                      <div className='bg-white shadow rounded absolute bottom-14 w-36 p-2'>
                      <form>
                          <label htmlFor='uploadImage' className='flex items-center p-2 px-3 gap-3 hover:bg-slate-200 cursor-pointer'>
                              <div className='text-primary'>
                                  <FaImage size={18}/>
                              </div>
                              <p>Image</p>
                          </label>
                          <label htmlFor='uploadVideo' className='flex items-center p-2 px-3 gap-3 hover:bg-slate-200 cursor-pointer'>
                              <div className='text-purple-500'>
                                  <FaVideo size={18}/>
                              </div>
                              <p>Video</p>
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
                      </form>
                      </div>
                    )
                  }
                  
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

              {/**input box */}
              <form className='h-full w-full flex gap-2' onSubmit={handleSendMessage}>
                  <input
                    type='text'
                    placeholder='Type here message...'
                    className='py-1 px-4 outline-none w-full h-full'
                    value={message.text}
                    onChange={handleOnChange}
                  />
                  <button className='text-primary hover:text-secondary'>
                      <IoMdSend size={28}/>
                  </button>
              </form>
              
          </section>



    </div>
  )
}

export default MessagePage
