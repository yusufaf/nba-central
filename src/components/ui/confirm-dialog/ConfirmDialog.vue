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
    <!-- A confirmation is a short question, so it takes the small dialog rather
         than the default reading width. -->
    <Dialog v-model:open="open">
        <DialogContent size="sm">
            <DialogHeader class="pb-2">
                <!-- Clear of the absolutely positioned close button. -->
                <DialogTitle class="pr-10">{{ title }}</DialogTitle>
                <DialogDescription>{{ description }}</DialogDescription>
            </DialogHeader>
            <DialogFooter class="mt-2 gap-4">
                <Button variant="outline" :disabled="loading" @click="handleCancel">
                    {{ cancelText }}
                </Button>
                <Button :variant="confirmVariant" :disabled="loading" @click="handleConfirm">
                    {{ loading ? 'Please wait...' : confirmText }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
