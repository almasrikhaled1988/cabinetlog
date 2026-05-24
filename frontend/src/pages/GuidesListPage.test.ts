import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import GuidesListPage from './GuidesListPage.vue';

// Mock the API client
vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

import apiClient from '@/api/client';

const mockApiGet = vi.mocked(apiClient.get);

function createMockRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/guides', name: 'guides', component: { template: '<div />' } },
      { path: '/guides/:id', name: 'guide-detail', component: { template: '<div />' } },
      { path: '/guides/:id/edit', name: 'guide-edit', component: { template: '<div />' } },
    ],
  });
}

function createMockGuide(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    title: 'ATV630 VSD Cabinet Assembly',
    slug: 'atv630-vsd-cabinet-assembly',
    cabinet_type: 'VSD',
    drive_model: 'ATV630',
    description: 'Step-by-step assembly guide',
    status: 'published',
    version: 1,
    tags: [],
    created_by: { _id: 'user1', name: 'Admin' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('GuidesListPage', () => {
  let router: ReturnType<typeof createMockRouter>;

  beforeEach(() => {
    setActivePinia(createPinia());
    router = createMockRouter();
    vi.clearAllMocks();
  });

  it('renders the page title', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, totalPages: 1 },
    });

    const wrapper = mount(GuidesListPage, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Assembly Guides');
  });

  it('shows loading state initially', async () => {
    mockApiGet.mockReturnValueOnce(new Promise(() => {})); // never resolves

    const wrapper = mount(GuidesListPage, {
      global: { plugins: [router] },
    });
    await nextTick();

    expect(wrapper.find('.animate-spin').exists()).toBe(true);
  });

  it('renders guide cards when data is loaded', async () => {
    const guides = [
      createMockGuide({ _id: '1', title: 'Guide 1' }),
      createMockGuide({ _id: '2', title: 'Guide 2' }),
    ];

    mockApiGet.mockResolvedValueOnce({
      data: { data: guides, total: 2, page: 1, totalPages: 1 },
    });

    const wrapper = mount(GuidesListPage, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Guide 1');
    expect(wrapper.text()).toContain('Guide 2');
  });

  it('shows empty state when no guides found', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, totalPages: 1 },
    });

    const wrapper = mount(GuidesListPage, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('No guides found');
  });

  it('shows error state on API failure', async () => {
    mockApiGet.mockRejectedValueOnce({
      response: { data: { error: { message: 'Server error' } } },
    });

    const wrapper = mount(GuidesListPage, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Server error');
  });

  it('shows pagination when multiple pages exist', async () => {
    const guides = Array.from({ length: 20 }, (_, i) =>
      createMockGuide({ _id: String(i), title: `Guide ${i}` })
    );

    mockApiGet.mockResolvedValueOnce({
      data: { data: guides, total: 40, page: 1, totalPages: 2 },
    });

    const wrapper = mount(GuidesListPage, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.find('nav[aria-label="Pagination"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('40 total');
  });

  it('hides pagination when only one page', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: { data: [createMockGuide()], total: 1, page: 1, totalPages: 1 },
    });

    const wrapper = mount(GuidesListPage, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.find('nav[aria-label="Pagination"]').exists()).toBe(false);
  });

  it('calls API with correct pagination params', async () => {
    mockApiGet.mockResolvedValue({
      data: { data: [], total: 0, page: 1, totalPages: 1 },
    });

    mount(GuidesListPage, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(mockApiGet).toHaveBeenCalledWith('/guides', {
      params: { page: 1, limit: 20 },
    });
  });

  it('does not show status filter for workers', async () => {
    // Worker user - auth store defaults to no user (not admin)
    mockApiGet.mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, totalPages: 1 },
    });

    const wrapper = mount(GuidesListPage, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.find('#status-filter').exists()).toBe(false);
  });

  it('has search bar component', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, totalPages: 1 },
    });

    const wrapper = mount(GuidesListPage, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.find('#guide-search').exists()).toBe(true);
  });

  it('has cabinet type filter dropdown', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: { data: [], total: 0, page: 1, totalPages: 1 },
    });

    const wrapper = mount(GuidesListPage, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.find('#cabinet-type-filter').exists()).toBe(true);
  });
});
