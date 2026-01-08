/**
 * Settings Page UI Tests
 * 
 * Tests for configuration display, form, and actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
import { useConfigStore } from '../store/config-store';
import type { ModelConfig } from '../types';

// Mock configManager
vi.mock('../lib/config', () => ({
  configManager: {
    getAllConfigs: vi.fn(),
    createConfig: vi.fn(),
    updateConfig: vi.fn(),
    deleteConfig: vi.fn(),
    testConfig: vi.fn(),
  },
}));

import { configManager } from '../lib/config';

const mockConfigs: ModelConfig[] = [
  {
    id: 'config-1',
    name: '我的 GPT-4',
    provider: 'openai',
    apiUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o',
    apiKey: 'sk-test-key-1',
    isDefault: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'config-2',
    name: 'Claude 配置',
    provider: 'anthropic',
    apiUrl: 'https://api.anthropic.com',
    modelName: 'claude-3-5-sonnet-20241022',
    apiKey: 'sk-ant-test-key',
    isDefault: false,
    createdAt: new Date('2024-01-02'),
  },
];

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({
      configs: [],
      currentConfigId: null,
    });
  });

  it('should show loading state initially', () => {
    vi.mocked(configManager.getAllConfigs).mockImplementation(
      () => new Promise(() => {})
    );
    
    render(<SettingsPage />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('should show empty state when no configs', async () => {
    vi.mocked(configManager.getAllConfigs).mockResolvedValue([]);
    
    render(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('暂无配置')).toBeInTheDocument();
    });
  });

  it('should display all configurations', async () => {
    vi.mocked(configManager.getAllConfigs).mockResolvedValue(mockConfigs);
    
    render(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('我的 GPT-4')).toBeInTheDocument();
      expect(screen.getByText('Claude 配置')).toBeInTheDocument();
    });
  });

  it('should show default badge on default config', async () => {
    vi.mocked(configManager.getAllConfigs).mockResolvedValue(mockConfigs);
    
    render(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('默认')).toBeInTheDocument();
    });
  });

  it('should show provider and model info', async () => {
    vi.mocked(configManager.getAllConfigs).mockResolvedValue(mockConfigs);
    
    render(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/OpenAI.*gpt-4o/)).toBeInTheDocument();
      expect(screen.getByText(/Anthropic.*claude-3-5-sonnet/)).toBeInTheDocument();
    });
  });

  it('should open create form when clicking add button', async () => {
    vi.mocked(configManager.getAllConfigs).mockResolvedValue([]);
    
    render(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('添加配置')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('添加配置'));
    
    expect(screen.getByText('配置名称')).toBeInTheDocument();
    expect(screen.getByText('AI 提供商')).toBeInTheDocument();
  });

  it('should show delete confirmation', async () => {
    vi.mocked(configManager.getAllConfigs).mockResolvedValue(mockConfigs);
    
    render(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('我的 GPT-4')).toBeInTheDocument();
    });
    
    const deleteButtons = screen.getAllByTitle('删除');
    fireEvent.click(deleteButtons[0]);
    
    expect(screen.getByText('确认')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('should delete config when confirming', async () => {
    vi.mocked(configManager.getAllConfigs).mockResolvedValue(mockConfigs);
    vi.mocked(configManager.deleteConfig).mockResolvedValue(undefined);
    
    useConfigStore.setState({ configs: mockConfigs });
    
    render(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('我的 GPT-4')).toBeInTheDocument();
    });
    
    const deleteButtons = screen.getAllByTitle('删除');
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('确认'));
    
    await waitFor(() => {
      expect(configManager.deleteConfig).toHaveBeenCalledWith('config-1');
    });
  });

  it('should test config connection', async () => {
    vi.mocked(configManager.getAllConfigs).mockResolvedValue(mockConfigs);
    vi.mocked(configManager.testConfig).mockResolvedValue({ success: true, message: '配置验证成功' });
    
    render(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('我的 GPT-4')).toBeInTheDocument();
    });
    
    const testButtons = screen.getAllByTitle('测试连接');
    fireEvent.click(testButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('连接成功！')).toBeInTheDocument();
    });
  });

  it('should show test failure message', async () => {
    vi.mocked(configManager.getAllConfigs).mockResolvedValue(mockConfigs);
    vi.mocked(configManager.testConfig).mockResolvedValue({ success: false, message: 'API密钥无效' });
    
    render(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('我的 GPT-4')).toBeInTheDocument();
    });
    
    const testButtons = screen.getAllByTitle('测试连接');
    fireEvent.click(testButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('API密钥无效')).toBeInTheDocument();
    });
  });

  it('should open edit form when clicking edit', async () => {
    vi.mocked(configManager.getAllConfigs).mockResolvedValue(mockConfigs);
    
    render(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('我的 GPT-4')).toBeInTheDocument();
    });
    
    const editButtons = screen.getAllByTitle('编辑');
    fireEvent.click(editButtons[0]);
    
    expect(screen.getByText('编辑配置')).toBeInTheDocument();
  });

  it('should cancel delete when clicking cancel', async () => {
    vi.mocked(configManager.getAllConfigs).mockResolvedValue(mockConfigs);
    
    render(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('我的 GPT-4')).toBeInTheDocument();
    });
    
    const deleteButtons = screen.getAllByTitle('删除');
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('取消'));
    
    expect(screen.queryByText('确认')).not.toBeInTheDocument();
  });
});
