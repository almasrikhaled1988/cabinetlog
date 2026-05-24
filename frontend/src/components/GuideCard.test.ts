import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import GuideCard from './GuideCard.vue';
import type { Guide } from './GuideCard.vue';

function createGuide(overrides: Partial<Guide> = {}): Guide {
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

describe('GuideCard', () => {
  it('renders guide title', () => {
    const guide = createGuide();
    const wrapper = mount(GuideCard, { props: { guide } });
    expect(wrapper.text()).toContain('ATV630 VSD Cabinet Assembly');
  });

  it('renders cabinet type and drive model', () => {
    const guide = createGuide();
    const wrapper = mount(GuideCard, { props: { guide } });
    expect(wrapper.text()).toContain('VSD');
    expect(wrapper.text()).toContain('ATV630');
  });

  it('renders status badge with correct text', () => {
    const guide = createGuide({ status: 'draft' });
    const wrapper = mount(GuideCard, { props: { guide } });
    expect(wrapper.text()).toContain('draft');
  });

  it('renders published status badge', () => {
    const guide = createGuide({ status: 'published' });
    const wrapper = mount(GuideCard, { props: { guide } });
    const badge = wrapper.find('span.rounded-full');
    expect(badge.text()).toBe('published');
    expect(badge.classes()).toContain('bg-green-100');
  });

  it('renders tags when provided', () => {
    const guide = createGuide({
      tags: [
        { _id: 't1', name: 'water-cooling' },
        { _id: 't2', name: 'vsd' },
      ],
    });
    const wrapper = mount(GuideCard, { props: { guide } });
    expect(wrapper.text()).toContain('water-cooling');
    expect(wrapper.text()).toContain('vsd');
  });

  it('shows +N indicator when more than 3 tags', () => {
    const guide = createGuide({
      tags: [
        { _id: 't1', name: 'tag1' },
        { _id: 't2', name: 'tag2' },
        { _id: 't3', name: 'tag3' },
        { _id: 't4', name: 'tag4' },
      ],
    });
    const wrapper = mount(GuideCard, { props: { guide } });
    expect(wrapper.text()).toContain('+1');
  });

  it('emits click event when card is clicked', async () => {
    const guide = createGuide();
    const wrapper = mount(GuideCard, { props: { guide } });
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeTruthy();
    expect(wrapper.emitted('click')![0]).toEqual([guide]);
  });

  it('shows placeholder when no thumbnail', () => {
    const guide = createGuide({ thumbnail_image: undefined });
    const wrapper = mount(GuideCard, { props: { guide } });
    expect(wrapper.text()).toContain('No thumbnail');
  });

  it('renders thumbnail image when provided', () => {
    const guide = createGuide({ thumbnail_image: '/uploads/images/thumb.jpg' });
    const wrapper = mount(GuideCard, { props: { guide } });
    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('/uploads/images/thumb.jpg');
  });

  it('has accessible article role and aria-label', () => {
    const guide = createGuide({ title: 'Test Guide' });
    const wrapper = mount(GuideCard, { props: { guide } });
    const article = wrapper.find('[role="article"]');
    expect(article.exists()).toBe(true);
    expect(article.attributes('aria-label')).toBe('Guide: Test Guide');
  });
});
