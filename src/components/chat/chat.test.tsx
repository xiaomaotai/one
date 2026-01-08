/**
 * Chat Components UI Tests
 * 
 * Tests for message display, input, and streaming animation.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import type { Message } from '../../types';

// ============================================
// MessageBubble Tests
// ============================================

describe('MessageBubble', () => {
  const userMessage: Message = {
    id: 'msg-1',
    sessionId: 'session-1',
    role: 'user',
    content: '你好，这是一条测试消息',
    timestamp: new Date('2024-01-07T10:00:00Z')
  };

  const assistantMessage: Message = {
    id: 'msg-2',
    sessionId: 'session-1',
    role: 'assistant',
    content: '你好！我是AI助手，很高兴为你服务。',
    timestamp: new Date('2024-01-07T10:00:05Z')
  };

  it('should render user message', () => {
    render(<MessageBubble message={userMessage} />);
    expect(screen.getByText('你好，这是一条测试消息')).toBeInTheDocument();
  });

  it('should render assistant message', () => {
    render(<MessageBubble message={assistantMessage} />);
    expect(screen.getByText('你好！我是AI助手，很高兴为你服务。')).toBeInTheDocument();
  });

  it('should show streaming cursor when streaming', () => {
    const { container } = render(<MessageBubble message={assistantMessage} isStreaming={true} />);
    expect(container.querySelector('.streaming-cursor')).toBeInTheDocument();
  });

  it('should not show streaming cursor when not streaming', () => {
    const { container } = render(<MessageBubble message={assistantMessage} isStreaming={false} />);
    expect(container.querySelector('.streaming-cursor')).not.toBeInTheDocument();
  });
});

// ============================================
// MessageInput Tests
// ============================================

describe('MessageInput', () => {
  it('should render input field', () => {
    render(<MessageInput onSend={vi.fn()} />);
    expect(screen.getByPlaceholderText('输入消息...')).toBeInTheDocument();
  });

  it('should call onSend when submitting', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    
    const input = screen.getByPlaceholderText('输入消息...');
    fireEvent.change(input, { target: { value: '测试消息' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(onSend).toHaveBeenCalledWith('测试消息', undefined);
  });

  it('should not call onSend with empty message', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    
    const input = screen.getByPlaceholderText('输入消息...');
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(onSend).not.toHaveBeenCalled();
  });

  it('should clear input after sending', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    
    const input = screen.getByPlaceholderText('输入消息...') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '测试消息' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(input.value).toBe('');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<MessageInput onSend={vi.fn()} disabled={true} />);
    
    const input = screen.getByPlaceholderText('输入消息...');
    expect(input).toBeDisabled();
  });

  it('should use custom placeholder', () => {
    render(<MessageInput onSend={vi.fn()} placeholder="自定义占位符" />);
    expect(screen.getByPlaceholderText('自定义占位符')).toBeInTheDocument();
  });

  it('should allow newline with Shift+Enter', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    
    const input = screen.getByPlaceholderText('输入消息...');
    fireEvent.change(input, { target: { value: '第一行' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    
    expect(onSend).not.toHaveBeenCalled();
  });
});

// ============================================
// MessageList Tests
// ============================================

describe('MessageList', () => {
  const messages: Message[] = [
    {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'user',
      content: '你好',
      timestamp: new Date('2024-01-07T10:00:00Z')
    },
    {
      id: 'msg-2',
      sessionId: 'session-1',
      role: 'assistant',
      content: '你好！有什么可以帮助你的？',
      timestamp: new Date('2024-01-07T10:00:05Z')
    }
  ];

  it('should render all messages', () => {
    render(<MessageList messages={messages} />);
    
    expect(screen.getByText('你好')).toBeInTheDocument();
    expect(screen.getByText('你好！有什么可以帮助你的？')).toBeInTheDocument();
  });

  it('should show empty state when no messages', () => {
    render(<MessageList messages={[]} />);
    
    expect(screen.getByText('开始新对话')).toBeInTheDocument();
  });

  it('should mark streaming message', () => {
    const { container } = render(
      <MessageList messages={messages} streamingMessageId="msg-2" />
    );
    
    expect(container.querySelector('.streaming-cursor')).toBeInTheDocument();
  });
});
