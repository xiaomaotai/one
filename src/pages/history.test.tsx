/**
 * History Page UI Tests
 * 
 * Tests for session list display, loading, and deletion.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HistoryPage } from './HistoryPage';
import { useChatStore } from '../store/chat-store';
import type { ChatSession } from '../types';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock chatManager
vi.mock('../lib/chat', () => ({
  chatManager: {
    getAllSessions: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

import { chatManager } from '../lib/chat';

const mockSessions: ChatSession[] = [
  {
    id: 'session-1',
    title: '测试对话1',
    configId: 'config-1',
    messages: [
      {
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'user',
        content: '你好，这是第一条消息',
        timestamp: new Date('2024-01-07T10:00:00Z'),
      },
      {
        id: 'msg-2',
        sessionId: 'session-1',
        role: 'assistant',
        content: '你好！有什么可以帮助你的？',
        timestamp: new Date('2024-01-07T10:00:05Z'),
      },
    ],
    createdAt: new Date('2024-01-07T10:00:00Z'),
    updatedAt: new Date('2024-01-07T10:00:05Z'),
  },
  {
    id: 'session-2',
    title: '',
    configId: 'config-1',
    messages: [
      {
        id: 'msg-3',
        sessionId: 'session-2',
        role: 'user',
        content: '这是另一个对话的内容，用于测试标题生成',
        timestamp: new Date('2024-01-06T09:00:00Z'),
      },
    ],
    createdAt: new Date('2024-01-06T09:00:00Z'),
    updatedAt: new Date('2024-01-06T09:00:00Z'),
  },
];

const renderHistoryPage = () => {
  return render(
    <BrowserRouter>
      <HistoryPage />
    </BrowserRouter>
  );
};

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store
    useChatStore.setState({
      sessions: [],
      currentSessionId: null,
    });
  });

  it('should show loading state initially', () => {
    vi.mocked(chatManager.getAllSessions).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    
    renderHistoryPage();
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('should show empty state when no sessions', async () => {
    vi.mocked(chatManager.getAllSessions).mockResolvedValue([]);
    
    renderHistoryPage();
    
    await waitFor(() => {
      expect(screen.getByText('暂无聊天记录')).toBeInTheDocument();
    });
  });

  it('should display all sessions', async () => {
    vi.mocked(chatManager.getAllSessions).mockResolvedValue(mockSessions);
    
    renderHistoryPage();
    
    await waitFor(() => {
      expect(screen.getByText('测试对话1')).toBeInTheDocument();
      // Use getAllByText since the title and preview may be the same
      expect(screen.getAllByText('这是另一个对话的内容，用于测试标题生成').length).toBeGreaterThan(0);
    });
  });

  it('should show session count', async () => {
    vi.mocked(chatManager.getAllSessions).mockResolvedValue(mockSessions);
    
    renderHistoryPage();
    
    await waitFor(() => {
      expect(screen.getByText('共 2 个对话')).toBeInTheDocument();
    });
  });

  it('should navigate to chat when clicking session', async () => {
    vi.mocked(chatManager.getAllSessions).mockResolvedValue(mockSessions);
    
    renderHistoryPage();
    
    await waitFor(() => {
      expect(screen.getByText('测试对话1')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('测试对话1'));
    
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(useChatStore.getState().currentSessionId).toBe('session-1');
  });

  it('should show delete confirmation on delete click', async () => {
    vi.mocked(chatManager.getAllSessions).mockResolvedValue(mockSessions);
    
    renderHistoryPage();
    
    await waitFor(() => {
      expect(screen.getByText('测试对话1')).toBeInTheDocument();
    });
    
    // Find and click delete button (first one)
    const deleteButtons = screen.getAllByTitle('删除对话');
    fireEvent.click(deleteButtons[0]);
    
    expect(screen.getByText('确认')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('should cancel delete when clicking cancel', async () => {
    vi.mocked(chatManager.getAllSessions).mockResolvedValue(mockSessions);
    
    renderHistoryPage();
    
    await waitFor(() => {
      expect(screen.getByText('测试对话1')).toBeInTheDocument();
    });
    
    const deleteButtons = screen.getAllByTitle('删除对话');
    fireEvent.click(deleteButtons[0]);
    
    fireEvent.click(screen.getByText('取消'));
    
    expect(screen.queryByText('确认')).not.toBeInTheDocument();
  });

  it('should delete session when confirming', async () => {
    vi.mocked(chatManager.getAllSessions).mockResolvedValue(mockSessions);
    vi.mocked(chatManager.deleteSession).mockResolvedValue(undefined);
    
    // Set initial sessions in store
    useChatStore.setState({ sessions: mockSessions });
    
    renderHistoryPage();
    
    await waitFor(() => {
      expect(screen.getByText('测试对话1')).toBeInTheDocument();
    });
    
    const deleteButtons = screen.getAllByTitle('删除对话');
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('确认'));
    
    await waitFor(() => {
      expect(chatManager.deleteSession).toHaveBeenCalledWith('session-1');
    });
  });

  it('should navigate to chat from empty state', async () => {
    vi.mocked(chatManager.getAllSessions).mockResolvedValue([]);
    
    renderHistoryPage();
    
    await waitFor(() => {
      expect(screen.getByText('开始聊天')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('开始聊天'));
    
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
