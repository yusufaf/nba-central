<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLogto } from '@logto/vue';
import { Download, ExternalLink, LogOut, Trash2 } from 'lucide-vue-next';
import SectionHeading from '@/components/layout/SectionHeading.vue';
import SettingRow from '@/components/Settings/SettingRow.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentUser } from '@/composables/useCurrentUser';
import {
    DELETE_CONFIRMATION_PHRASE,
    matchesDeleteConfirmation,
    useAccountData,
} from '@/composables/useAccountData';

const { signOut } = useLogto();
const { currentUser } = useCurrentUser();
const { exporting, exportError, exportData, deleting, deleteError, deleteData } = useAccountData();

// Logto owns the sign-in itself. Its Account Center (enabled on
// auth.yusufaf.dev with email and password editable) takes `redirect` as
// the way back here.
const accountCenterLink = (page: 'email' | 'password') => {
    const endpoint = import.meta.env.VITE_LOGTO_ENDPOINT;
    if (!endpoint) return null;
    const back = `${window.location.origin}/settings?tab=account`;
    return `${endpoint.replace(/\/+$/, '')}/account/${page}?redirect=${encodeURIComponent(back)}`;
};
const emailLink = accountCenterLink('email');
const passwordLink = accountCenterLink('password');

const deleteOpen = ref(false);
const typedConfirmation = ref('');
const confirmed = computed(() => matchesDeleteConfirmation(typedConfirmation.value));

const openDeleteDialog = () => {
    typedConfirmation.value = '';
    deleteError.value = null;
    deleteOpen.value = true;
};

const handleSignOut = () => {
    signOut(window.location.origin);
};
</script>

<template>
    <div class="flex flex-col gap-8">
        <section class="flex flex-col gap-3">
            <SectionHeading>Sign-in</SectionHeading>
            <Card class="px-6 py-2">
                <SettingRow
                    :label="currentUser?.username ? `Signed in as ${currentUser.username}` : 'Signed in'"
                    description="Your yusufaf.dev sign-in. Settings here apply to NBA Central only."
                >
                    <Button variant="outline" size="sm" @click="handleSignOut">
                        <LogOut />
                        Logout
                    </Button>
                </SettingRow>
                <SettingRow
                    v-if="emailLink"
                    label="Email"
                    description="Change the email you sign in with, on yusufaf.dev."
                >
                    <Button as="a" :href="emailLink" variant="outline" size="sm">
                        Change email
                        <ExternalLink />
                    </Button>
                </SettingRow>
                <SettingRow
                    v-if="passwordLink"
                    label="Password"
                    description="Change it once for every yusufaf.dev app."
                >
                    <Button as="a" :href="passwordLink" variant="outline" size="sm">
                        Change password
                        <ExternalLink />
                    </Button>
                </SettingRow>
            </Card>
        </section>

        <section class="flex flex-col gap-3">
            <SectionHeading>Your data</SectionHeading>
            <Card class="px-6 py-2">
                <SettingRow
                    label="Export"
                    description="Your teams with their full rosters, your custom coaches, GMs and players, and your settings, as one JSON file. Images are included as links."
                >
                    <div class="flex flex-col items-start gap-2 sm:items-end">
                        <Button variant="outline" size="sm" :disabled="exporting" @click="exportData">
                            <Download />
                            {{ exporting ? 'Preparing...' : 'Download my data' }}
                        </Button>
                        <p
                            v-if="exportError"
                            data-testid="export-error"
                            role="alert"
                            class="max-w-[20rem] text-[0.8125rem] text-destructive-strong sm:text-right"
                        >
                            Couldn't download your data. {{ exportError }}
                        </p>
                    </div>
                </SettingRow>
                <SettingRow
                    label="Delete"
                    description="Permanently deletes your teams, including published ones (their links stop working), your custom coaches, GMs and players, your settings and your avatar. Your yusufaf.dev sign-in stays, here and in other apps."
                >
                    <Button variant="destructive" size="sm" @click="openDeleteDialog">
                        <Trash2 />
                        Delete my data
                    </Button>
                </SettingRow>
            </Card>
        </section>

        <ConfirmDialog
            v-model:open="deleteOpen"
            title="Delete your NBA Central data?"
            description="This can't be undone. Download your data first if you want a copy. You'll be signed out when it's done."
            confirm-text="Delete permanently"
            variant="destructive"
            :loading="deleting"
            :confirm-disabled="!confirmed"
            @confirm="deleteData"
        >
            <div class="flex flex-col gap-2">
                <Label for="delete-data-confirmation" class="text-[0.8125rem] font-normal text-foreground/80">
                    Type <span class="font-semibold text-foreground">{{ DELETE_CONFIRMATION_PHRASE }}</span> to
                    confirm
                </Label>
                <Input
                    id="delete-data-confirmation"
                    v-model="typedConfirmation"
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false"
                    :disabled="deleting"
                />
                <p
                    v-if="deleteError"
                    data-testid="delete-error"
                    role="alert"
                    class="text-[0.8125rem] text-destructive-strong"
                >
                    {{ deleteError }}
                </p>
            </div>
        </ConfirmDialog>
    </div>
</template>
