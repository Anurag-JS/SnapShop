// Importing utilities for creating slices and asynchronous thunks from Redux Toolkit
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

// Importing Firestore database instance and relevant functions for data operations
import { db } from "../../firebaseInit";
import { collection, addDoc, onSnapshot } from "firebase/firestore"; 

// Importing toast notifications for user feedback
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Defining the initial state to manage user data, including the list of users,
// authentication status, and the currently logged-in user's information
const initialState = { userList: [], isLoggedIn: false, userLoggedIn: null };

// Async thunk for fetching the list of all users from the Firebase Firestore database
export const getInitialUserList = createAsyncThunk(
    "auth/userList",
    (args, thunkAPI) => {
        
        // Establishing a real-time listener on the 'buybusy-redux' collection in Firestore
        const unsub = onSnapshot(collection(db, "buybusy-redux"), (snapShot) => {
            const users = snapShot.docs.map((doc) => {
                return {
                    id: doc.id,
                    ...doc.data()
                }
            });
            // Dispatching an action to update the user list in the state
            thunkAPI.dispatch(setUserList(users));
        });
    }
);

// Async thunk for creating a new user document in the Firestore database
export const createUserThunk = createAsyncThunk(
    "auth/createUser",
    async (data, thunkAPI) => {

        // Extracting user list from the current state
        const { authReducer } = thunkAPI.getState();
        const { userList } = authReducer;

        // Checking if the user's email already exists in the database
        const index = userList.findIndex((user) => user.email === data.email);
        
        // Displaying an error notification if the email address is already registered
        if (index !== -1) {
            toast.error('Email address already in use !!');
            return;
        }

        // If the email is not found, create a new user document in Firestore
        const docRef = await addDoc(collection(db, "buybusy-redux"), {
            name: data.name,
            email: data.email,
            password: data.password,
            cart: [],
            orders: []
        });
        // Displaying a success notification after user creation
        toast.success("New user created, please log in to continue!!");
    }
)

// Async thunk for authenticating a user and creating a session
export const createSessionThunk = createAsyncThunk(
    "auth/createSession",
    async (data, thunkAPI) => {

        // Extracting the user list from the current state
        const { authReducer } = thunkAPI.getState();
        const { userList } = authReducer;

        // Searching for the user's email in the user list
        const index = userList.findIndex((user) => user.email === data.email);

        // Displaying an error notification if the user is not found
        if (index === -1) {
            toast.error("Email does not exist, try again or sign up instead!!!");
            return false;
        }
        
        // If the email is found, check if the provided password matches
        if (userList[index].password === data.password) {

            toast.success("Sign-in successful!!!");
            
            // Dispatching actions to update authentication state and store user data
            thunkAPI.dispatch(setLoggedIn(true));
            thunkAPI.dispatch(setUserLoggedIn(userList[index]));
            
            // Storing the session token and user data in localStorage
            window.localStorage.setItem("token", true);
            window.localStorage.setItem("index", JSON.stringify(userList[index]));
            return true;
        } else {
            // Displaying an error notification if the password does not match
            toast.error("Incorrect username or password, try again");
            return false;
        }
    }
);

// Async thunk for signing out a user and ending the session
export const removeSessionThunk = createAsyncThunk(
    "auth/removeSession",
    () => {

        // Removing the session token and user data from localStorage
        window.localStorage.removeItem("token");
        window.localStorage.removeItem("index");
    }
)

// Creating the authentication slice with state and reducers for user management
const authSlice = createSlice({
    name: 'authentication',
    initialState,
    reducers: {
        // Reducer to update the user list in the state
        setUserList: (state, action) => {
            state.userList = action.payload;
        },
        // Reducer to update the user's login status
        setLoggedIn: (state, action) => {
            state.isLoggedIn = action.payload;
        },
        // Reducer to store the logged-in user's data
        setUserLoggedIn: (state, action) => {
            state.userLoggedIn = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder.addCase(removeSessionThunk.fulfilled, (state, action) => {
            // Resetting authentication state after signing out
            state.isLoggedIn = false;
            state.userLoggedIn = null;
            toast.success("Signed out successfully!!!!");
        })
    }
});

// Exporting the authentication reducer
export const authReducer = authSlice.reducer;
// Exporting actions from the authentication slice
export const { setLoggedIn, setUserLoggedIn, setUserList } = authSlice.actions;

// Exporting a selector to access the authentication state
export const authSelector = (state) => state.authReducer;
