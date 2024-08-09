// Importing Redux Toolkit utilities for creating slices and async thunks
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

// Importing Firestore functions for database interactions
import { db } from "../../firebaseInit";
import { updateDoc, doc, arrayUnion, onSnapshot, arrayRemove } from "firebase/firestore";

// Importing toast notifications for user feedback
import { toast } from "react-toastify";

// Utility function to return the current date in 'yyyy-mm-dd' format
function getDate(){
    const date = new Date();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    return(`${year}-${month}-${day}`);
}

// Async thunk to fetch initial cart items and orders placed by the user from the Firestore database
export const getInitialCartOrdersThunk = createAsyncThunk(
    'product/getCartOrders',
    (args, thunkAPI) => {
        const { authReducer, productReducer } = thunkAPI.getState();
        const { isLoggedIn, userLoggedIn } = authReducer;
        
        // Check if the user is logged in
        if(isLoggedIn){
            // Setting up a real-time listener for changes in user's cart and orders data
            const unsub = onSnapshot(doc(db, "buybusy-redux", userLoggedIn.id), (doc) => {
                const data = doc.data();
                thunkAPI.dispatch(setCart(data.cart));
                thunkAPI.dispatch(setMyOrders(data.orders));
            });
            
            // Returning the current cart state for use in extraReducers
            return productReducer.cart;
        }
    }
)

// Async thunk to update the cart in the Firestore database
const updateCartInDatabase = createAsyncThunk(
    'product/updateCartInDatabase',
    async(args, thunkAPI) => {
        const { authReducer, productReducer } = thunkAPI.getState();
        const { userLoggedIn } = authReducer;

        // Updating the cart data for the logged-in user in Firestore
        const userRef = doc(db, "buybusy-redux", userLoggedIn.id);
        await updateDoc(userRef, {
            cart: productReducer.cart
        });
    }
)

// Async thunk to increase the quantity of a product in the cart and update the database
export const increaseQuantThunk = createAsyncThunk(
    "product/increaseProductQuantity",
    async (product, thunkAPI) => {
        const { productReducer } = thunkAPI.getState();

        // Finding the product index in the cart
        const index = productReducer.cart.findIndex((item) => item.name === product.name);
        
        // Increasing the product quantity in the cart state
        thunkAPI.dispatch(increaseProductQuantity(index));      
        
        // Updating the total cart amount in the state
        thunkAPI.dispatch(increaseTotalAmount(product.price));

        // Syncing the updated cart with the Firestore database
        thunkAPI.dispatch(updateCartInDatabase());
    }
)

// Async thunk to decrease the quantity of a product in the cart and update the database
export const decreaseQuantThunk = createAsyncThunk(
    "product/decreaseProductQuantity",
    async(product, thunkAPI) => {
        const { productReducer } = thunkAPI.getState();
        
        // Finding the product index in the cart
        const index = productReducer.cart.findIndex((item) => item.name === product.name);
        
        // If the product quantity is 1, remove it from the cart
        if(productReducer.cart[index].quantity === 1){
            thunkAPI.dispatch(removeFromCartThunk(product));
            return;
        }

        // Decreasing the product quantity in the cart state
        thunkAPI.dispatch(decreaseProductQuantity(index));

        // Reducing the total cart amount in the state
        thunkAPI.dispatch(reduceTotalAmount(productReducer.cart[index].price));

        // Syncing the updated cart with the Firestore database
        thunkAPI.dispatch(updateCartInDatabase());
    }
)

// Async thunk to add a new product to the cart and update the database
export const addToCartThunk = createAsyncThunk(
    "product/addToCart",
    async (product, thunkAPI) => {
        const { authReducer, productReducer } = thunkAPI.getState();
        const { isLoggedIn, userLoggedIn } = authReducer;
        
        // Check if the user is logged in
        if(!isLoggedIn){
            toast.error("Please log in first!!!");
            return;
        }

        // Check if the product is already in the cart
        const index = productReducer.cart.findIndex((item) => item.name === product.name);
        if(index !== -1){
            // If the product is already in the cart, increase its quantity
            thunkAPI.dispatch(increaseQuantThunk(productReducer.cart[index]));
            toast.success("Product quantity increased!!");
            return;
        }

        // Adding the new product to the user's cart in Firestore
        const userRef = doc(db, "buybusy-redux", userLoggedIn.id);
        await updateDoc(userRef, {
            cart: arrayUnion({quantity:1, ...product})
        });
        
        // Updating the total cart amount and item count in the state
        thunkAPI.dispatch(increaseTotalAmount(product.price));
        thunkAPI.dispatch(increaseTotalItem());

        // Notification for successful addition
        toast.success("Added to your cart!!");
    }
);

// Async thunk to remove a product from the cart and update the database
export const removeFromCartThunk = createAsyncThunk(
    "product/removeFromCart",
    async(product, thunkAPI) => {
        const { authReducer } = thunkAPI.getState();
        const { userLoggedIn } = authReducer;
        
        // Removing the product from the user's cart in Firestore
        const userRef = doc(db, "buybusy-redux", userLoggedIn.id);
        await updateDoc(userRef, {
            cart: arrayRemove(product)
        });

        // Returning the removed product for use in extraReducers
        return product;
    }
);

// Async thunk to clear all items from the cart and update the database
export const clearCartThunk = createAsyncThunk(
    "product/emptyCart",
    async (args, thunkAPI) => {
        const { authReducer, productReducer } = thunkAPI.getState();
        const { userLoggedIn } = authReducer;
        
        // If there are no items in the cart, display an error message
        if(productReducer.itemInCart === 0){
            toast.error("Nothing to remove in the cart!!");    
            return;
        }

        // Clearing the cart array in Firestore
        const userRef = doc(db, "buybusy-redux", userLoggedIn.id);
        await updateDoc(userRef, {
            cart: []
        });

        // Notification for successful cart clearance
        toast.success("Cart emptied!!");
    }
);

// Async thunk to purchase all items in the cart and update the orders in the database
export const purchaseAllThunk = createAsyncThunk(
    "product/purchaseAllItems",
    async (args, thunkAPI) => {
        const { authReducer, productReducer } = thunkAPI.getState();
        const { userLoggedIn } = authReducer;
        
        // Get the current date using the getDate utility function
        const currentDate = getDate();
        
        // Adding a new order to the user's orders in Firestore with the current cart items and total amount
        const userRef = doc(db, "buybusy-redux", userLoggedIn.id);
        await updateDoc(userRef, {
            orders: arrayUnion({date: currentDate,
                                list: productReducer.cart,
                                amount: productReducer.total})
            }
        );

        // Clearing the cart after successful purchase
        thunkAPI.dispatch(clearCartThunk());
    }
);

// Slice to manage product-related operations including cart and orders
const productSlice = createSlice({
    name: "product",
    // Initial state including the cart, total item count, user's orders, and total cart amount
    initialState: {
        cart: [],
        itemInCart: 0,
        myorders: [],
        total: 0,
    },
    reducers: {
        // Reducer to set the initial orders on first render
        setMyOrders: (state, action) => {
            state.myorders = action.payload;
            return;
        },
        // Reducer to increase the quantity of a product in the cart
        increaseProductQuantity: (state, action) => {
            const index = action.payload;
            state.cart.at(index).quantity++;
            return; 
        },
        // Reducer to decrease the quantity of a product in the cart
        decreaseProductQuantity: (state, action) => {
            const index = action.payload;
            state.cart.at(index).quantity--;
            return;
        },
        // Reducer to set the initial cart on first render
        setCart: (state, action) => {
            state.cart = action.payload;
            return;
        },
        // Reducer to increment the total item count in the cart
        increaseTotalItem: (state, action) => {
            state.itemInCart++;
            return;
        },
        // Reducer to increase the total cart amount
        increaseTotalAmount: (state, action) => {
            state.total += action.payload;
            return;
        },
        // Reducer to decrease the total cart amount
        reduceTotalAmount: (state, action) => {
            state.total -= action.payload;
            return;
        }
    },
    extraReducers: (builder) => {
        // Updating the state after fetching initial cart and order data from the database
        builder.addCase(getInitialCartOrdersThunk.fulfilled, (state, action) => {
            const cart = action.payload;
            if(cart){    
                let sum = 0, len = 0;
                cart.map((item) => {
                    Number(sum += item.price * item.quantity);
                    Number(len += item.quantity);
                });
                state.total = sum;
                state.itemInCart = len;
            }
        })
        // Updating the state after successfully increasing the product quantity
        .addCase(increaseQuantThunk.fulfilled, (state, action) => {
            state.itemInCart++;
        })
        // Updating the state after successfully decreasing the product quantity
        .addCase(decreaseQuantThunk.fulfilled, (state, action) => {
            if(state.itemInCart > 1){
                state.itemInCart--;
            }
        })
        // Updating the state after successfully removing a product from the cart
        .addCase(removeFromCartThunk.fulfilled, (state, action) => {
            const product = action.payload;
            state.total -= product.quantity * product.price;
            state.itemInCart -= product.quantity;
            toast.success("Removed from cart!!");
        })
        // Updating the state after successfully clearing the cart
        .addCase(clearCartThunk.fulfilled, (state, action) => {
            state.itemInCart = 0;
            state.total = 0;
            state.cart = [];
        })
    }
});

// Exporting the product slice reducer
export const productReducer = productSlice.reducer;

// Exporting the actions for use in the app
export const { setMyOrders, 
            increaseProductQuantity, 
            decreaseProductQuantity, 
            setCart, 
            increaseTotalItem,
            increaseTotalAmount, 
            reduceTotalAmount } = productSlice.actions;

// Selector to access the product slice state
export const productSelector = (state) => state.productReducer;
