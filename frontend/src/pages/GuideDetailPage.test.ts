import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import GuideDetailPage from './GuideDetailPage.vue';

// Mock vue-router
const mockPush = vi.fn();
const mockRouteParams = { id: 'guide-123' };

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: mockRouteParams }),
  useRouter: () => ({ push: mockPush }),
}));

// Mock API client
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/api/client', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

const sampleGuide = {
  _id: 'guide-123',
  title: 'ATV630 VSD Cabinet Assembly',
  slug: 'atv630-vsd-cabinet-assembly',
  cabinet_type: 'VSD',
  drive_model: 'ATV630',
  description: 'Step-by-step assembly guide for VSD cabinets',
  status: 'published' as const,
  version: 2,
  tags: [{ _id: 't1', name: 'water-cooling' }],
  created_by: { _id: 'user1', name: 'Admin User' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
};

const sampleSteps = [
  {
    _id: 'step-1',
    cabinet_guide_id: 'guide-123',
    title: 'Mount DIN Rails',
    description: 'Install DIN rails on backplate',
    step_order: 1,
    estimated_time: 15,
    warning_notes: 'Ensure rails are level',
  },
  {
    _id: 'step-2',
    cabinet_guide_id: 'guide-123',
    title: 'Wire Terminal Blocks',
    description: 'Connect terminal blocks to rails',
    step_order: 2,
    estimated_time: 30,
  },
];

describe('GuideDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());

    // Default: worker user
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ _id: 'u1', name: 'Worker', email: 'w@test.com', role: 'worker' }));

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/steps')) {
        return Promise.resolve({ data: sampleSteps });
      }
      return Promise.resolve({ data: sampleGuide });
    });
  });

  it('shows loading state initially', () => {
    mockGet.mockImplementation(() => new Promise(() => {})); // never resolves
    const wrapper = mount(GuideDetailPage);
    expect(wrapper.text()).toContain('Loading guide...');
  });

  it('renders guide title after loading', async () => {
    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).toContain('ATV630 VSD Cabinet Assembly');
  });

  it('renders guide status badge', async () => {
    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).toContain('published');
  });

  it('renders cabinet type and drive model', async () => {
    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).toContain('VSD');
    expect(wrapper.text()).toContain('ATV630');
  });

  it('renders version number', async () => {
    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).toContain('v2');
  });

  it('renders tags', async () => {
    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).toContain('water-cooling');
  });

  it('renders guide description', async () => {
    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).toContain('Step-by-step assembly guide for VSD cabinets');
  });

  it('renders build steps', async () => {
    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).toContain('Mount DIN Rails');
    expect(wrapper.text()).toContain('Wire Terminal Blocks');
  });

  it('shows step count', async () => {
    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).toContain('(2)');
  });

  it('shows "Start Following" button for workers when steps exist', async () => {
    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).toContain('Start Following');
  });

  it('navigates to step-follow page when worker clicks Start Following', async () => {
    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    const startBtn = wrapper.findAll('button').find((b) => b.text() === 'Start Following');
    expect(startBtn).toBeDefined();
    await startBtn!.trigger('click');
    expect(mockPush).toHaveBeenCalledWith({
      name: 'step-follow',
      params: { id: 'guide-123', stepId: 'step-1' },
    });
  });

  it('shows admin controls for admin users', async () => {
    localStorage.setItem('user', JSON.stringify({ _id: 'u1', name: 'Admin', email: 'a@test.com', role: 'admin' }));
    setActivePinia(createPinia());

    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).toContain('Edit');
    expect(wrapper.text()).toContain('Archive');
    expect(wrapper.text()).toContain('Delete');
  });

  it('does not show admin controls for workers', async () => {
    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).not.toContain('Edit');
    expect(wrapper.text()).not.toContain('Delete');
  });

  it('shows error state when guide not found', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/steps')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject({ response: { status: 404 } });
    });

    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).toContain('Guide not found.');
  });

  it('shows empty state when no steps', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/steps')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: sampleGuide });
    });

    const wrapper = mount(GuideDetailPage);
    await flushPromises();
    expect(wrapper.text()).toContain('No build steps yet.');
  });
});
