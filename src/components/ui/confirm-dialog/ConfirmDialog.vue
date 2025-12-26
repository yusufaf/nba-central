<script setup lang="ts">
import { computed } from 'vue';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
    loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
    loading: false,
});

const emit = defineEmits<{
    confirm: [];
    cancel: [];
}>();

const open = defineModel<boolean>('open', { default: false });

const handleConfirm = () => {
    if (!props.loading) {
        emit('confirm');
    }
};

const handleCancel = () => {
    if (!props.loading) {
        open.value = false;
        emit('cancel');
    }
};

const confirmVariant = computed(() => props.variant);
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="confirm-dialog">
            <DialogHeader class="dialog-header-custom">
                <DialogTitle class="dialog-title-custom">{{ title }}</DialogTitle>
                <DialogDescription class="dialog-description-custom">
                    {{ description }}
                </DialogDescription>
            </DialogHeader>
            <DialogFooter class="dialog-footer-custom">
                <Button
                    variant="outline"
                    @click="handleCancel"
                    :disabled="loading"
                    class="cancel-button"
                >
                    {{ cancelText }}
                </Button>
                <Button
                    :variant="confirmVariant"
                    @click="handleConfirm"
                    :disabled="loading"
                    class="confirm-button"
                    :class="{ 'destructive-variant': variant === 'destructive' }"
                >
                    {{ loading ? 'Please wait...' : confirmText }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<style scoped>
.dialog-header-custom {
    padding-bottom: 0.5rem;
}

.dialog-title-custom {
    padding-right: 2.5rem;
}

.dialog-footer-custom {
    gap: 1rem;
    margin-top: 0.5rem;
}

.cancel-button {
    font-weight: 600 !important;
    background-color: rgba(255, 255, 255, 0.08) !important;
    border: 1.5px solid rgba(255, 255, 255, 0.2) !important;
    color: rgb(255, 255, 255) !important;
}

.cancel-button:hover {
    background-color: rgba(255, 255, 255, 0.12) !important;
    border-color: rgba(255, 255, 255, 0.3) !important;
    transform: translateY(-1px);
}

.confirm-button {
    font-weight: 600 !important;
    box-shadow: 0 2px 8px -1px rgba(0, 0, 0, 0.3);
    position: relative;
    overflow: hidden;
}

.confirm-button:hover {
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.4);
    transform: translateY(-1px);
}

.confirm-button:active {
    transform: translateY(0);
}

/* Destructive variant styling - Bright red/orange */
.confirm-button.destructive-variant {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
    color: white !important;
    border: none !important;
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4) !important;
}

.confirm-button.destructive-variant:hover {
    background: linear-gradient(135deg, #f87171 0%, #ef4444 100%) !important;
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6) !important;
}
</style>
