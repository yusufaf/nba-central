<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { CircleUser } from 'lucide-vue-next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAvatar } from '@/composables/useAvatar';

const props = defineProps<{
    class?: HTMLAttributes['class'];
}>();

const { src } = useAvatar();
</script>

<template>
    <!-- The icon shows until the image has loaded, when there's no avatar,
         and if the image fails to load. Decorative: the username is always
         next to it. -->
    <Avatar :class="['bg-transparent', props.class]" data-testid="user-avatar">
        <AvatarImage v-if="src" :src="src" alt="" />
        <AvatarFallback as-child>
            <CircleUser class="size-full" aria-hidden="true" />
        </AvatarFallback>
    </Avatar>
</template>
