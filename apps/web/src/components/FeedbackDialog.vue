<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useLogto } from '@logto/vue';
import { toast } from 'vue-sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { feedbackApi } from '@/network/api';
import { getApiErrorMessage } from '@/composables/useApiErrorMessage';
import type { SendFeedbackPayload } from '@/models/api';

// Same caps sendFeedback enforces server-side; mirrored here so the counter
// and the disabled state agree with what the API will accept.
const MAX_MESSAGE_LENGTH = 5000;
const MAX_SUBJECT_LENGTH = 200;

const open = defineModel<boolean>('open', { default: false });

const { isAuthenticated } = useLogto();

const subject = ref('');
const message = ref('');
const sending = ref(false);

const trimmedMessage = computed(() => message.value.trim());
const isFormValid = computed(
    () =>
        trimmedMessage.value.length > 0 &&
        trimmedMessage.value.length <= MAX_MESSAGE_LENGTH &&
        subject.value.trim().length <= MAX_SUBJECT_LENGTH,
);

const resetForm = () => {
    subject.value = '';
    message.value = '';
    sending.value = false;
};

watch(open, (isOpen) => {
    if (!isOpen) resetForm();
});

const handleSubmit = async () => {
    if (!isFormValid.value || sending.value) return;

    const payload: SendFeedbackPayload = { message: trimmedMessage.value };
    const trimmedSubject = subject.value.trim();
    if (trimmedSubject) payload.subject = trimmedSubject;

    sending.value = true;
    try {
        const response = await feedbackApi.send(payload);
        if (!response.success) {
            toast.error(response.error || 'Failed to send feedback');
            return;
        }
        toast.success('Thanks, feedback sent');
        open.value = false;
    } catch (err) {
        toast.error(getApiErrorMessage(err, 'Failed to send feedback'));
    } finally {
        sending.value = false;
    }
};
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent size="sm">
            <DialogHeader>
                <DialogTitle>Send feedback</DialogTitle>
                <DialogDescription>
                    Bugs, ideas, missing teams - anything. It lands straight in the maintainer's inbox.
                </DialogDescription>
            </DialogHeader>

            <div v-if="!isAuthenticated" class="grid gap-4 py-4">
                <p class="text-sm text-muted-foreground">
                    Log in to send feedback - that's how we know who to get back to.
                </p>
                <Button as-child class="justify-self-start">
                    <RouterLink to="/login">Log in</RouterLink>
                </Button>
            </div>

            <template v-else>
                <div class="grid gap-4 py-4">
                    <div class="grid gap-2">
                        <Label for="feedback-subject">Subject (Optional)</Label>
                        <Input
                            id="feedback-subject"
                            v-model="subject"
                            placeholder="What is this about?"
                            :maxlength="MAX_SUBJECT_LENGTH"
                            :disabled="sending"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label for="feedback-message">
                            Message <span class="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="feedback-message"
                            v-model="message"
                            placeholder="Tell us what's working, what's broken, or what's missing..."
                            :maxlength="MAX_MESSAGE_LENGTH"
                            :disabled="sending"
                            rows="6"
                        />
                        <p class="text-xs text-muted-foreground">
                            {{ message.length }}/{{ MAX_MESSAGE_LENGTH }} characters
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" :disabled="sending" @click="open = false">
                        Cancel
                    </Button>
                    <Button :disabled="!isFormValid || sending" @click="handleSubmit">
                        {{ sending ? 'Sending...' : 'Send' }}
                    </Button>
                </DialogFooter>
            </template>
        </DialogContent>
    </Dialog>
</template>
