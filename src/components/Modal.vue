<script setup>
defineProps({ title: String, size: { type: String, default: 'max-w-4xl' } })
defineEmits(['close'])
</script>

<template>
  <div class="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-3 md:p-4" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <div :class="['max-h-[94vh] w-full overflow-hidden rounded-[30px] bg-white shadow-2xl', size]" role="dialog" aria-modal="true">
      <div class="flex items-start justify-between border-b px-5 py-4 md:px-7">
        <h3 class="text-2xl font-black">{{ title }}</h3>
        <button @click="$emit('close')" aria-label="Close" class="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-lg">×</button>
      </div>
      <div class="max-h-[calc(94vh-82px)] overflow-y-auto p-5 md:p-7"><slot /></div>
    </div>
  </div>
</template>
