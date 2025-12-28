<script setup lang="ts">
interface Props {
    checked: boolean;
    id?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'update:checked': [value: boolean];
}>();

const handleChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    emit('update:checked', target.checked);
};
</script>

<template>
    <label class="switch">
        <input
            type="checkbox"
            :id="props.id"
            :checked="props.checked"
            @change="handleChange"
            class="switch-input"
        />
        <span class="switch-slider"></span>
    </label>
</template>

<style scoped>
.switch {
    position: relative;
    display: inline-block;
    width: 2.75rem;
    height: 1.5rem;
    cursor: pointer;
}

.switch-input {
    opacity: 0;
    width: 0;
    height: 0;
}

.switch-slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: hsl(0 0% 35%);
    border-radius: 1.5rem;
    transition: background-color 0.2s ease;
}

.switch-slider::before {
    position: absolute;
    content: "";
    height: 1.25rem;
    width: 1.25rem;
    left: 0.125rem;
    bottom: 0.125rem;
    background-color: white;
    border-radius: 50%;
    transition: transform 0.2s ease;
    box-shadow: 0 0.0625rem 0.1875rem 0 rgb(0 0 0 / 0.3);
}

.switch-input:checked + .switch-slider {
    background-color: hsl(var(--primary));
}

.switch-input:checked + .switch-slider::before {
    transform: translateX(1.25rem);
}

.switch-input:focus-visible + .switch-slider {
    outline: 0.125rem solid hsl(var(--ring));
    outline-offset: 0.125rem;
}

.switch-input:disabled + .switch-slider {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
