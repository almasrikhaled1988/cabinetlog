import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SearchBar from './SearchBar.vue';

describe('SearchBar', () => {
  it('renders with default placeholder', () => {
    const wrapper = mount(SearchBar);
    const input = wrapper.find('input');
    expect(input.attributes('placeholder')).toBe('Search guides...');
  });

  it('renders with custom placeholder', () => {
    const wrapper = mount(SearchBar, {
      props: { placeholder: 'Find something...' },
    });
    const input = wrapper.find('input');
    expect(input.attributes('placeholder')).toBe('Find something...');
  });

  it('displays the modelValue', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: 'ATV630' },
    });
    const input = wrapper.find('input');
    expect((input.element as HTMLInputElement).value).toBe('ATV630');
  });

  it('shows clear button when input has value', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: 'test' },
    });
    const clearBtn = wrapper.find('button[aria-label="Clear search"]');
    expect(clearBtn.exists()).toBe(true);
  });

  it('hides clear button when input is empty', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '' },
    });
    const clearBtn = wrapper.find('button[aria-label="Clear search"]');
    expect(clearBtn.exists()).toBe(false);
  });

  it('emits search and update:modelValue on clear', async () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: 'test' },
    });
    const clearBtn = wrapper.find('button[aria-label="Clear search"]');
    await clearBtn.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['']);
    expect(wrapper.emitted('search')).toBeTruthy();
    expect(wrapper.emitted('search')![0]).toEqual(['']);
  });

  it('has accessible label for the input', () => {
    const wrapper = mount(SearchBar);
    const label = wrapper.find('label[for="guide-search"]');
    expect(label.exists()).toBe(true);
    expect(label.classes()).toContain('sr-only');
  });

  it('debounces input events', async () => {
    vi.useFakeTimers();
    const wrapper = mount(SearchBar, {
      props: { modelValue: '', debounceMs: 300 },
    });
    const input = wrapper.find('input');

    await input.setValue('A');
    await input.trigger('input');

    // Should not emit immediately
    expect(wrapper.emitted('search')).toBeFalsy();

    // Advance timers
    vi.advanceTimersByTime(300);

    expect(wrapper.emitted('search')).toBeTruthy();
    vi.useRealTimers();
  });
});
