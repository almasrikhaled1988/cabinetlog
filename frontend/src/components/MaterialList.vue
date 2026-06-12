<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from '@/api/client';
import { useAuthStore } from '@/stores/auth';

interface Material {
  _id: string;
  name: string;
  quantity: number;
  unit: string;
  category: 'tool' | 'consumable' | 'component';
  part_number?: string;
  sort_order: number;
}

const props = defineProps<{ guideId: string }>();
const authStore = useAuthStore();

const materials = ref<Material[]>([]);
const loading = ref(false);
const showAddForm = ref(false);
const saving = ref(false);

const newItem = ref({
  name: '',
  quantity: 1,
  unit: 'pcs',
  category: 'component' as Material['category'],
  part_number: '',
});

const categoryLabels = { tool: 'Tools', consumable: 'Consumables', component: 'Components' };
const categoryIcons = { tool: '🔧', consumable: '📦', component: '⚡' };

async function fetchMaterials() {
  loading.value = true;
  try {
    const res = await apiClient.get(`/guides/${props.guideId}/materials`);
    materials.value = res.data;
  } catch {
    // silent
  } finally {
    loading.value = false;
  }
}

async function addMaterial() {
  saving.value = true;
  try {
    await apiClient.post(`/guides/${props.guideId}/materials`, newItem.value);
    showAddForm.value = false;
    newItem.value = { name: '', quantity: 1, unit: 'pcs', category: 'component', part_number: '' };
    await fetchMaterials();
  } catch {
    // silent
  } finally {
    saving.value = false;
  }
}

async function deleteMaterial(id: string) {
  try {
    await apiClient.delete(`/materials/${id}`);
    await fetchMaterials();
  } catch {
    // silent
  }
}

function groupedMaterials(category: Material['category']) {
  return materials.value.filter((m) => m.category === category);
}

onMounted(fetchMaterials);
</script>

<template>
  <div class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Tools & Materials</h3>
      <button
        v-if="authStore.isAdmin"
        @click="showAddForm = !showAddForm"
        class="text-xs text-se-green hover:text-se-green-dark"
      >
        {{ showAddForm ? 'Cancel' : '+ Add' }}
      </button>
    </div>

    <!-- Add form -->
    <form v-if="showAddForm" @submit.prevent="addMaterial" class="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
      <input v-model="newItem.name" placeholder="Name" required class="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white" />
      <div class="grid grid-cols-3 gap-2">
        <input v-model.number="newItem.quantity" type="number" min="0" step="0.1" class="px-2 py-1.5 text-sm border dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white" />
        <input v-model="newItem.unit" placeholder="Unit" class="px-2 py-1.5 text-sm border dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white" />
        <select v-model="newItem.category" class="px-2 py-1.5 text-sm border dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white">
          <option value="tool">Tool</option>
          <option value="component">Component</option>
          <option value="consumable">Consumable</option>
        </select>
      </div>
      <input v-model="newItem.part_number" placeholder="Part number (optional)" class="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white" />
      <button type="submit" :disabled="saving" class="px-3 py-1.5 bg-se-green text-white text-xs rounded hover:bg-se-green-dark disabled:opacity-50">
        {{ saving ? 'Adding...' : 'Add Material' }}
      </button>
    </form>

    <!-- Material list -->
    <div v-if="loading" class="text-center py-4">
      <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-se-green mx-auto"></div>
    </div>
    <div v-else-if="materials.length === 0" class="text-sm text-gray-500 dark:text-gray-400 text-center py-3">
      No materials listed yet.
    </div>
    <div v-else class="space-y-3">
      <div v-for="cat in (['tool', 'component', 'consumable'] as const)" :key="cat">
        <template v-if="groupedMaterials(cat).length > 0">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {{ categoryIcons[cat] }} {{ categoryLabels[cat] }}
          </p>
          <ul class="space-y-1">
            <li
              v-for="m in groupedMaterials(cat)"
              :key="m._id"
              class="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300"
            >
              <span>
                {{ m.name }}
                <span class="text-gray-400 dark:text-gray-500">× {{ m.quantity }} {{ m.unit }}</span>
                <span v-if="m.part_number" class="text-gray-400 dark:text-gray-500 text-xs ml-1">({{ m.part_number }})</span>
              </span>
              <button
                v-if="authStore.isAdmin"
                @click="deleteMaterial(m._id)"
                class="text-red-400 hover:text-red-600 text-xs"
              >
                ×
              </button>
            </li>
          </ul>
        </template>
      </div>
    </div>
  </div>
</template>
