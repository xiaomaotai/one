// Chat store - manages chat sessions and messages
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatSession, Message } from '../types';

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isStreaming: boolean;
  streamingContent: string;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setSessions: (sessions: ChatSession[]) => void;
  addSession: (session: ChatSession) => void;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteSession: (id: string) => void;
  setCurrentSession: (id: string | null) => void;
  
  // Message actions
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  deleteMessagesAfter: (sessionId: string, messageId: string) => void;
  setSessionMessages: (sessionId: string, messages: Message[]) => void;
  
  // Streaming actions
  setStreaming: (isStreaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  
  // UI state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessions: [],
      currentSessionId: null,
      isStreaming: false,
      streamingContent: '',
      isLoading: false,
      error: null,

      setSessions: (sessions) => set({ sessions }),
      
      addSession: (session) => set((state) => ({
        sessions: [session, ...state.sessions]
      })),
      
      updateSession: (id, updates) => set((state) => ({
        sessions: state.sessions.map((s) => 
          s.id === id ? { ...s, ...updates } : s
        )
      })),
      
      deleteSession: (id) => set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
        currentSessionId: state.currentSessionId === id ? null : state.currentSessionId
      })),
      
      setCurrentSession: (id) => set({ currentSessionId: id }),
      
      addMessage: (sessionId, message) => set((state) => ({
        sessions: state.sessions.map((s) => 
          s.id === sessionId 
            ? { ...s, messages: [...s.messages, message], updatedAt: new Date() }
            : s
        )
      })),
      
      updateMessage: (sessionId, messageId, updates) => set((state) => ({
        sessions: state.sessions.map((s) => 
          s.id === sessionId 
            ? {
                ...s,
                messages: s.messages.map((m) => 
                  m.id === messageId ? { ...m, ...updates } : m
                )
              }
            : s
        )
      })),
      
      deleteMessagesAfter: (sessionId, messageId) => set((state) => ({
        sessions: state.sessions.map((s) => {
          if (s.id !== sessionId) return s;
          const messageIndex = s.messages.findIndex(m => m.id === messageId);
          if (messageIndex === -1) return s;
          // Keep messages up to and including the specified message
          return {
            ...s,
            messages: s.messages.slice(0, messageIndex + 1),
            updatedAt: new Date()
          };
        })
      })),
      
      setSessionMessages: (sessionId, messages) => set((state) => ({
        sessions: state.sessions.map((s) => 
          s.id === sessionId 
            ? { ...s, messages, updatedAt: new Date() }
            : s
        )
      })),
      
      setStreaming: (isStreaming) => set({ isStreaming }),
      setStreamingContent: (streamingContent) => set({ streamingContent }),
      appendStreamingContent: (chunk) => set((state) => ({
        streamingContent: state.streamingContent + chunk
      })),
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'multi-ai-chat-store',
      // Only persist currentSessionId for session restoration
      partialize: (state) => ({ currentSessionId: state.currentSessionId }),
    }
  )
);

// Selector helpers
export const getCurrentSession = (state: ChatState): ChatSession | undefined => {
  return state.sessions.find((s) => s.id === state.currentSessionId);
};

export const getSessionMessages = (state: ChatState, sessionId: string): Message[] => {
  const session = state.sessions.find((s) => s.id === sessionId);
  return session?.messages ?? [];
};
