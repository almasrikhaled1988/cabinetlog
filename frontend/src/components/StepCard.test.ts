import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StepCard from './StepCard.vue';
import type { StepCardProps } from './StepCard.vue';

function createProps(overrides: Partial<StepCardProps> = {}): StepCardProps {
  return {
    stepId: 'step-001',
    stepOrder: 1,
    title: 'Mount DIN Rails',
    description: 'Install 3x DIN rails at positions marked on backplate',
    ...overrides,
  };
}

describe('StepCard', () => {
  it('renders step order number', () => {
    const wrapper = mount(StepCard, { props: createProps({ stepOrder: 3 }) });
    expect(wrapper.text()).toContain('3');
  });

  it('renders step title', () => {
    const wrapper = mount(StepCard, { props: createProps({ title: 'Wire Terminal Blocks' }) });
    expect(wrapper.text()).toContain('Wire Terminal Blocks');
  });

  it('renders step description', () => {
    const wrapper = mount(StepCard, { props: createProps({ description: 'Connect all terminals' }) });
    expect(wrapper.text()).toContain('Connect all terminals');
  });

  it('renders estimated time when provided', () => {
    const wrapper = mount(StepCard, { props: createProps({ estimatedTime: 15 }) });
    expect(wrapper.text()).toContain('15 min');
  });

  it('does not render estimated time when not provided', () => {
    const wrapper = mount(StepCard, { props: createProps({ estimatedTime: undefined }) });
    expect(wrapper.text()).not.toContain('min');
  });

  it('renders warning notes when provided', () => {
    const wrapper = mount(StepCard, { props: createProps({ warningNotes: 'Ensure rails are level' }) });
    expect(wrapper.text()).toContain('Ensure rails are level');
  });

  it('does not render warning section when no warning notes', () => {
    const wrapper = mount(StepCard, { props: createProps({ warningNotes: undefined }) });
    const warningSection = wrapper.find('.bg-amber-50');
    expect(warningSection.exists()).toBe(false);
  });

  it('renders media count when provided', () => {
    const wrapper = mount(StepCard, { props: createProps({ mediaCount: 3 }) });
    expect(wrapper.text()).toContain('3 files');
  });

  it('renders singular file label for 1 media', () => {
    const wrapper = mount(StepCard, { props: createProps({ mediaCount: 1 }) });
    expect(wrapper.text()).toContain('1 file');
  });

  it('does not render media count when zero', () => {
    const wrapper = mount(StepCard, { props: createProps({ mediaCount: 0 }) });
    expect(wrapper.text()).not.toContain('file');
  });
});
