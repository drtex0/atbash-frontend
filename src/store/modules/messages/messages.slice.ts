import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { MessagesState, Message, NotificationMessage } from './messages.types';

const initialState: MessagesState = {
    notifications: [],
};

export const createNotification = ({ payload }: PayloadAction<Message>): NotificationMessage => {
    if (!['success', 'error', 'info', 'warning'].some(x => x === payload.severity)) {
        throw new Error('Not handled');
    }

    return { ...payload, display: true, id: Math.random().toString(36).substring(2, 15) };
};

const messagesSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        addNotification(state, action: PayloadAction<Message>) {
            const notification = createNotification(action);
            state.notifications.push(notification);
        },
        closeNotification(state, action) {
            const notificationIdx = state.notifications.find(e => e.id === action.payload.id);

            if (notificationIdx) notificationIdx.display = false;
        },
    },
});

export const { addNotification, closeNotification } = messagesSlice.actions;

export default messagesSlice.reducer;
