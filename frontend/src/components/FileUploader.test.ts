import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import FileUploader from './FileUploader.vue';

// Mock apiClient
vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from '@/api/client';

const mockedApiClient = vi.mocked(apiClient);

function createWrapper(props = { buildStepId: 'step-123' }) {
  return mount(FileUploader, {
    props,
    attachTo: document.body,
  });
}

function createFile(name: string, size: number, type: string): File {
  const content = new Uint8Array(Math.min(size, 100)); // Don't allocate huge buffers in tests
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('FileUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiClient.get.mockResolvedValue({ data: [] });
  });

  describe('rendering', () => {
    it('renders the drop zone with instructions', () => {
      const wrapper = createWrapper();
      expect(wrapper.text()).toContain('Click to upload');
      expect(wrapper.text()).toContain('drag and drop');
      expect(wrapper.text()).toContain('JPEG, PNG (max 10 MB) or PDF (max 25 MB)');
    });

    it('renders a hidden file input with correct accept attribute', () => {
      const wrapper = createWrapper();
      const input = wrapper.find('input[type="file"]');
      expect(input.exists()).toBe(true);
      expect(input.attributes('accept')).toBe('.jpg,.jpeg,.png,.pdf');
      expect(input.attributes('multiple')).toBeDefined();
      expect(input.classes()).toContain('hidden');
    });

    it('fetches media on mount', async () => {
      createWrapper();
      await flushPromises();
      expect(mockedApiClient.get).toHaveBeenCalledWith('/upload/step/step-123');
    });

    it('displays media gallery when items exist', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: [
          {
            _id: 'media-1',
            build_step_id: 'step-123',
            file_type: 'image',
            file_path: 'images/2024/test.jpg',
            original_name: 'photo.jpg',
            file_size: 512000,
            caption: 'DIN rail photo',
            sort_order: 0,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.text()).toContain('Uploaded files (1)');
      expect(wrapper.text()).toContain('DIN rail photo');
    });

    it('displays PDF placeholder for PDF files', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: [
          {
            _id: 'media-2',
            build_step_id: 'step-123',
            file_type: 'pdf',
            file_path: 'pdfs/2024/manual.pdf',
            original_name: 'manual.pdf',
            file_size: 2048000,
            sort_order: 0,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.text()).toContain('manual.pdf');
    });
  });

  describe('client-side validation', () => {
    it('rejects files with unsupported MIME types', async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const file = createFile('document.docx', 1000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const input = wrapper.find('input[type="file"]');

      // Simulate file selection
      Object.defineProperty(input.element, 'files', { value: [file], writable: true });
      await input.trigger('change');
      await flushPromises();

      expect(wrapper.text()).toContain('Unsupported file type');
      expect(mockedApiClient.post).not.toHaveBeenCalled();
    });

    it('rejects image files exceeding 10 MB', async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const file = createFile('large.jpg', 11 * 1024 * 1024, 'image/jpeg');
      const input = wrapper.find('input[type="file"]');

      Object.defineProperty(input.element, 'files', { value: [file], writable: true });
      await input.trigger('change');
      await flushPromises();

      expect(wrapper.text()).toContain('exceeds the maximum size of 10 MB');
      expect(mockedApiClient.post).not.toHaveBeenCalled();
    });

    it('rejects PDF files exceeding 25 MB', async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const file = createFile('large.pdf', 26 * 1024 * 1024, 'application/pdf');
      const input = wrapper.find('input[type="file"]');

      Object.defineProperty(input.element, 'files', { value: [file], writable: true });
      await input.trigger('change');
      await flushPromises();

      expect(wrapper.text()).toContain('exceeds the maximum size of 25 MB');
      expect(mockedApiClient.post).not.toHaveBeenCalled();
    });

    it('accepts valid JPEG files within size limit', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          _id: 'media-new',
          build_step_id: 'step-123',
          file_type: 'image',
          file_path: 'images/2024/uuid.jpg',
          original_name: 'photo.jpg',
          file_size: 500000,
          sort_order: 0,
          created_at: '2024-01-01T00:00:00Z',
        },
      });

      const wrapper = createWrapper();
      await flushPromises();

      const file = createFile('photo.jpg', 5 * 1024 * 1024, 'image/jpeg');
      const input = wrapper.find('input[type="file"]');

      Object.defineProperty(input.element, 'files', { value: [file], writable: true });
      await input.trigger('change');
      await flushPromises();

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/upload/image',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      );
    });

    it('accepts valid PNG files within size limit', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          _id: 'media-new',
          build_step_id: 'step-123',
          file_type: 'image',
          file_path: 'images/2024/uuid.png',
          original_name: 'screenshot.png',
          file_size: 300000,
          sort_order: 0,
          created_at: '2024-01-01T00:00:00Z',
        },
      });

      const wrapper = createWrapper();
      await flushPromises();

      const file = createFile('screenshot.png', 3 * 1024 * 1024, 'image/png');
      const input = wrapper.find('input[type="file"]');

      Object.defineProperty(input.element, 'files', { value: [file], writable: true });
      await input.trigger('change');
      await flushPromises();

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/upload/image',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      );
    });

    it('accepts valid PDF files within size limit', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          _id: 'media-new',
          build_step_id: 'step-123',
          file_type: 'pdf',
          file_path: 'pdfs/2024/uuid.pdf',
          original_name: 'manual.pdf',
          file_size: 2000000,
          sort_order: 0,
          created_at: '2024-01-01T00:00:00Z',
        },
      });

      const wrapper = createWrapper();
      await flushPromises();

      const file = createFile('manual.pdf', 20 * 1024 * 1024, 'application/pdf');
      const input = wrapper.find('input[type="file"]');

      Object.defineProperty(input.element, 'files', { value: [file], writable: true });
      await input.trigger('change');
      await flushPromises();

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/upload/pdf',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      );
    });
  });

  describe('upload behavior', () => {
    it('sends file to correct endpoint based on type', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          _id: 'media-new',
          build_step_id: 'step-123',
          file_type: 'image',
          file_path: 'images/2024/uuid.jpg',
          original_name: 'photo.jpg',
          file_size: 500000,
          sort_order: 0,
          created_at: '2024-01-01T00:00:00Z',
        },
      });

      const wrapper = createWrapper();
      await flushPromises();

      const file = createFile('photo.jpg', 1000, 'image/jpeg');
      const input = wrapper.find('input[type="file"]');

      Object.defineProperty(input.element, 'files', { value: [file], writable: true });
      await input.trigger('change');
      await flushPromises();

      const formData = mockedApiClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('buildStepId')).toBe('step-123');
    });

    it('emits uploaded event on successful upload', async () => {
      const mediaResponse = {
        _id: 'media-new',
        build_step_id: 'step-123',
        file_type: 'image' as const,
        file_path: 'images/2024/uuid.jpg',
        original_name: 'photo.jpg',
        file_size: 500000,
        sort_order: 0,
        created_at: '2024-01-01T00:00:00Z',
      };
      mockedApiClient.post.mockResolvedValue({ data: mediaResponse });

      const wrapper = createWrapper();
      await flushPromises();

      const file = createFile('photo.jpg', 1000, 'image/jpeg');
      const input = wrapper.find('input[type="file"]');

      Object.defineProperty(input.element, 'files', { value: [file], writable: true });
      await input.trigger('change');
      await flushPromises();

      expect(wrapper.emitted('uploaded')).toBeTruthy();
      expect(wrapper.emitted('uploaded')![0]).toEqual([mediaResponse]);
    });

    it('shows error message on upload failure', async () => {
      mockedApiClient.post.mockRejectedValue({
        response: { data: { error: { message: 'Storage failure' } } },
      });

      const wrapper = createWrapper();
      await flushPromises();

      const file = createFile('photo.jpg', 1000, 'image/jpeg');
      const input = wrapper.find('input[type="file"]');

      Object.defineProperty(input.element, 'files', { value: [file], writable: true });
      await input.trigger('change');

      // The uploadFile is fire-and-forget async. We need to wait for:
      // 1. The microtask queue (promise rejection)
      // 2. Vue reactivity update
      await flushPromises();
      await flushPromises();
      await nextTick();
      await flushPromises();
      await nextTick();
      await flushPromises();

      expect(wrapper.text()).toContain('Storage failure');
    });
  });

  describe('delete functionality', () => {
    it('shows delete confirmation on button click', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: [
          {
            _id: 'media-1',
            build_step_id: 'step-123',
            file_type: 'image',
            file_path: 'images/2024/test.jpg',
            original_name: 'photo.jpg',
            file_size: 512000,
            sort_order: 0,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const wrapper = createWrapper();
      await flushPromises();

      // Click the delete button (visible on hover via group-hover)
      const deleteBtn = wrapper.find('[aria-label="Delete photo.jpg"]');
      await deleteBtn.trigger('click');

      expect(wrapper.text()).toContain('Delete this file?');
    });

    it('deletes media and emits event on confirm', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: [
          {
            _id: 'media-1',
            build_step_id: 'step-123',
            file_type: 'image',
            file_path: 'images/2024/test.jpg',
            original_name: 'photo.jpg',
            file_size: 512000,
            sort_order: 0,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });
      mockedApiClient.delete.mockResolvedValue({});

      const wrapper = createWrapper();
      await flushPromises();

      // Click delete button
      const deleteBtn = wrapper.find('[aria-label="Delete photo.jpg"]');
      await deleteBtn.trigger('click');
      await flushPromises();

      // Confirm deletion — find the button with text "Delete" inside the overlay
      const allButtons = wrapper.findAll('button');
      const confirmBtn = allButtons.find((btn) => btn.text() === 'Delete');
      expect(confirmBtn).toBeTruthy();
      await confirmBtn!.trigger('click');
      await flushPromises();

      expect(mockedApiClient.delete).toHaveBeenCalledWith('/upload/media-1');
      expect(wrapper.emitted('deleted')).toBeTruthy();
      expect(wrapper.emitted('deleted')![0]).toEqual(['media-1']);
    });

    it('cancels delete on cancel button click', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: [
          {
            _id: 'media-1',
            build_step_id: 'step-123',
            file_type: 'image',
            file_path: 'images/2024/test.jpg',
            original_name: 'photo.jpg',
            file_size: 512000,
            sort_order: 0,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const wrapper = createWrapper();
      await flushPromises();

      // Click delete button
      const deleteBtn = wrapper.find('[aria-label="Delete photo.jpg"]');
      await deleteBtn.trigger('click');

      // Cancel
      const cancelBtn = wrapper.find('button.bg-gray-200');
      await cancelBtn.trigger('click');
      await flushPromises();

      expect(mockedApiClient.delete).not.toHaveBeenCalled();
      expect(wrapper.text()).not.toContain('Delete this file?');
    });
  });

  describe('drag and drop', () => {
    it('applies drag-over styling when dragging over', async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const dropZone = wrapper.find('.border-dashed');
      await dropZone.trigger('dragover');

      expect(dropZone.classes()).toContain('border-blue-400');
      expect(dropZone.classes()).toContain('bg-blue-50');
    });

    it('removes drag-over styling on drag leave', async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const dropZone = wrapper.find('.border-dashed');
      await dropZone.trigger('dragover');
      await dropZone.trigger('dragleave');

      expect(dropZone.classes()).not.toContain('border-blue-400');
    });
  });

  describe('formatFileSize', () => {
    it('displays file sizes correctly in gallery', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: [
          {
            _id: 'media-1',
            build_step_id: 'step-123',
            file_type: 'image',
            file_path: 'images/2024/test.jpg',
            original_name: 'photo.jpg',
            file_size: 512000,
            sort_order: 0,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.text()).toContain('500.0 KB');
    });
  });
});
