import React, { useEffect, useState } from 'react'
import { IoSearchOutline } from "react-icons/io5";
import Loading from './Loading';
import UserSearchCard from './UserSearchCard';
import toast from 'react-hot-toast'
import axios from 'axios';
import { IoClose } from "react-icons/io5";

const SearchUser = ({onClose, onUserSelect, excludeUsers = [], title = "Search Users"}) => {
    const [searchUser,setSearchUser] = useState([])
    const [loading,setLoading] = useState(false)
    const [search,setSearch] = useState("")

    const handleSearchUser = async()=>{
        const URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api/search-user`
        try {
            setLoading(true)
            const response = await axios({
                url: URL,
                method: 'POST',
                data: { search: search },
                withCredentials: true
            })
            setLoading(false)

            // Filter out excluded users (like existing group members)
            const filteredUsers = response.data.data.filter(user => 
                !excludeUsers.some(excludedUser => 
                    excludedUser._id === user._id || excludedUser === user._id
                )
            )
            setSearchUser(filteredUsers)

        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to search users')
        }
    }

    useEffect(()=>{
        handleSearchUser()
    },[search])

    const handleUserSelect = (user) => {
        if (onUserSelect) {
            onUserSelect(user._id)
        } else {
            // Default behavior - navigate to user chat
            onClose()
        }
    }

  return (
    <div className='fixed top-0 bottom-0 left-0 right-0 bg-slate-700 bg-opacity-40 p-2 z-10'>
        <div className='w-full max-w-lg mx-auto mt-10'>
            {/**header */}
            <div className='bg-white rounded-t p-4 border-b'>
                <h2 className='text-lg font-semibold'>{title}</h2>
            </div>

            {/**input search user */}
            <div className='bg-white h-14 overflow-hidden flex '>
                <input 
                    type='text'
                    placeholder='Search user by name, email....'
                    className='w-full outline-none py-1 h-full px-4'
                    onChange={(e)=>setSearch(e.target.value)}
                    value={search}
                />
                <div className='h-14 w-14 flex justify-center items-center'>
                    <IoSearchOutline size={25}/>
                </div>
            </div>

            {/**display search user */}
            <div className='bg-white w-full p-4 rounded-b h-full max-h-[70vh] overflow-scroll'>
                {/**no user found */}
                {
                    searchUser.length === 0 && !loading && (
                        <p className='text-center text-slate-500'>No users found!</p>
                    )
                } 

                {
                    loading && (
                        <p><Loading/></p>
                    )
                }

                {
                    searchUser.length !==0 && !loading && (
                        searchUser.map((user,index)=>{
                            return(
                                <div 
                                    key={user._id} 
                                    className='cursor-pointer hover:bg-gray-50 p-2 rounded'
                                    onClick={() => handleUserSelect(user)}
                                >
                                    <UserSearchCard user={user} onClose={onClose}/>
                                </div>
                            )
                        })
                    )
                } 
            </div>
        </div>

        <div className='absolute top-0 right-0 text-2xl p-2 lg:text-4xl hover:text-white' onClick={onClose}>
            <button>
                <IoClose/>
            </button>
        </div>
    </div>
  )
}

export default SearchUser
