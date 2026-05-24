import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import StepEditor from './StepEditor.vue';

// Mock apiClient
vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from '@/api/client';

const mockSteps = [
  {
    _id: 'step-1',
    cabinet_guide_id: 'guide-1',
    title: 'Mount DIN Rails',
    description: 'Install DIN rails on backplate',
    step_order: 1,
    estimated_time: 15,
    warning_notes: 'Ensure rails are level',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    _id: 'step-2',
    cabinet_guide_id: 'guide-1',
    title: 'Wire Terminal Blocks',
    description: 'Connect terminal blocks',
    step_order: 2,
    estimated_time: 30,
    warning_notes: '',
    created_at: '2024-01-01T00:00:00Z',
  },
];

describe('StepEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockSteps.map((s) => ({ ...s })),
    });
  });

  it('loads and displays steps on mount', async () => {
    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    expect(apiClient.get).toHaveBeenCalledWith('/guides/guide-1/steps');
    expect(wrapper.text()).toContain('Mount DIN Rails');
    expect(wrapper.text()).toContain('Wire Terminal Blocks');
  });

  it('displays step order numbers', async () => {
    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    expect(wrapper.text()).toContain('1');
    expect(wrapper.text()).toContain('2');
  });

  it('displays estimated time for steps', async () => {
    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    expect(wrapper.text()).toContain('15 min');
    expect(wrapper.text()).toContain('30 min');
  });

  it('displays warning notes when present', async () => {
    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    expect(wrapper.text()).toContain('Ensure rails are level');
  });

  it('shows empty state when no steps exist', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    expect(wrapper.text()).toContain('No build steps yet');
  });

  it('shows add step form when Add Step button is clicked', async () => {
    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    await wrapper.find('button[type="button"]').trigger('click');
    expect(wrapper.find('#new-step-title').exists()).toBe(true);
  });

  it('validates title is required when adding a step', async () => {
    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    // Open add form
    await wrapper.find('button[type="button"]').trigger('click');

    // Try to add without title
    const addButton = wrapper.findAll('button').find((b) => b.text() === 'Add Step');
    await addButton!.trigger('click');

    expect(wrapper.text()).toContain('Title is required');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('validates title minimum length', async () => {
    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    await wrapper.find('button[type="button"]').trigger('click');

    const titleInput = wrapper.find('#new-step-title');
    await titleInput.setValue('AB');

    const addButton = wrapper.findAll('button').find((b) => b.text() === 'Add Step');
    await addButton!.trigger('click');

    expect(wrapper.text()).toContain('Title must be at least 3 characters');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('calls POST API when adding a valid step', async () => {
    const newStep = {
      _id: 'step-3',
      cabinet_guide_id: 'guide-1',
      title: 'Install Breakers',
      description: 'Mount circuit breakers',
      step_order: 3,
      estimated_time: 20,
      warning_notes: '',
      created_at: '2024-01-01T00:00:00Z',
    };
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: newStep });

    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    await wrapper.find('button[type="button"]').trigger('click');

    await wrapper.find('#new-step-title').setValue('Install Breakers');
    await wrapper.find('#new-step-desc').setValue('Mount circuit breakers');
    await wrapper.find('#new-step-time').setValue(20);

    const addButton = wrapper.findAll('button').find((b) => b.text() === 'Add Step');
    await addButton!.trigger('click');
    await flushPromises();

    expect(apiClient.post).toHaveBeenCalledWith('/guides/guide-1/steps', {
      title: 'Install Breakers',
      description: 'Mount circuit breakers',
      estimated_time: 20,
    });
  });

  it('calls reorder API when moving a step up', async () => {
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });

    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    // Find the move-up button for the second step
    const moveUpButtons = wrapper.findAll('button[aria-label*="Move step"]');
    // The second step's move-up button (index 2 = second step's up button)
    const secondStepUpBtn = moveUpButtons.find(
      (b) => b.attributes('aria-label') === 'Move step 2 up'
    );
    await secondStepUpBtn!.trigger('click');
    await flushPromises();

    expect(apiClient.put).toHaveBeenCalledWith('/guides/guide-1/steps/reorder', {
      stepIds: ['step-2', 'step-1'],
    });
  });

  it('disables move-up button for first step', async () => {
    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    const firstUpBtn = wrapper.find('button[aria-label="Move step 1 up"]');
    expect((firstUpBtn.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables move-down button for last step', async () => {
    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    const lastDownBtn = wrapper.find('button[aria-label="Move step 2 down"]');
    expect((lastDownBtn.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls DELETE API when deleting a step', async () => {
    (apiClient.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
    // Mock confirm dialog
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    // Find the delete button for step-1 (first step, aria-label "Delete step 1")
    const deleteBtn = wrapper.find('button[aria-label="Delete step 1"]');
    await deleteBtn.trigger('click');
    await flushPromises();

    expect(apiClient.delete).toHaveBeenCalledWith('/steps/step-1');
  });

  it('does not delete when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    const deleteBtn = wrapper.find('button[aria-label="Delete step 1"]');
    await deleteBtn.trigger('click');
    await flushPromises();

    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it('shows edit form when edit button is clicked', async () => {
    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    const editBtn = wrapper.find('button[aria-label="Edit step 1"]');
    await editBtn.trigger('click');

    const editTitleInput = wrapper.find(`#edit-title-step-1`);
    expect(editTitleInput.exists()).toBe(true);
    expect((editTitleInput.element as HTMLInputElement).value).toBe('Mount DIN Rails');
  });

  it('calls PUT API when saving an edited step', async () => {
    const updatedStep = { ...mockSteps[0], title: 'Updated Title' };
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: updatedStep });

    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    const editBtn = wrapper.find('button[aria-label="Edit step 1"]');
    await editBtn.trigger('click');

    const editTitleInput = wrapper.find(`#edit-title-step-1`);
    await editTitleInput.setValue('Updated Title');

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'Save');
    await saveBtn!.trigger('click');
    await flushPromises();

    expect(apiClient.put).toHaveBeenCalledWith('/steps/step-1', expect.objectContaining({
      title: 'Updated Title',
    }));
  });

  it('shows error message when API call fails', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const wrapper = mount(StepEditor, { props: { guideId: 'guide-1' } });
    await flushPromises();

    expect(wrapper.text()).toContain('Failed to load steps');
  });
});
