<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import AppLayout from '@/layouts/AppLayout.vue';

// Ensure auth state is restored on app load
const authStore = useAuthStore();
authStore.restore();

const route = useRoute();

// Pages with layout: 'none' (login, register) don't get the AppLayout wrapper
const showLayout = computed(() => {
  return route.meta?.layout !== 'none';
});
</script>

<template>
  <AppLayout v-if="showLayout">
    <router-view />
  </AppLayout>
  <router-view v-else />
</template>
