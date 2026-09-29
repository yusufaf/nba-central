<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useLogto } from '@logto/vue';
import { ROUTES } from '@/constants/constants';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, CircleUser, LogOut, Menu, Settings } from 'lucide-vue-next';
import { useCurrentUser } from '@/composables/useCurrentUser';

const { isAuthenticated, signOut } = useLogto();
const { currentUser } = useCurrentUser();

// The username comes from the access token's claims, which resolve a
// moment after isAuthenticated flips.
const displayName = computed(() => currentUser.value?.username ?? 'Account');

// Login is rendered separately below so it can swap for Logout once
// isAuthenticated flips — the plain route loop has no notion of auth state.
const navRoutes = computed(() => ROUTES.filter((route) => route.path !== '/login'));

function handleSignOut() {
    signOut(window.location.origin);
}
</script>

<template>
    <header class="bg-primary text-black shadow-lg sticky top-0 z-50">
        <div class="flex items-center px-4 h-16">
            <div class="shrink-0">
                <a href="/">
                    <img
                        src="@/assets/TeamBuilderLogo1_Transparent2.png"
                        alt="NBA Team Builder Logo"
                        class="h-12"
                    />
                </a>
            </div>

            <!-- Desktop Nav -->
            <nav class="md:flex flex-1 ml-8">
                <ul>
                    <template v-for="route in navRoutes" :key="route.id">
                        <RouterLink :class="route?.class" :to="route.path">
                            {{ route.name }}
                        </RouterLink>
                    </template>
                    <RouterLink v-if="!isAuthenticated" class="login" to="/login">
                        Login
                    </RouterLink>
                    <DropdownMenu v-else>
                        <DropdownMenuTrigger as-child>
                            <button
                                type="button"
                                class="login user-menu-trigger"
                                data-testid="user-menu-trigger"
                            >
                                <CircleUser class="size-5" />
                                <span class="max-w-40 truncate">{{ displayName }}</span>
                                <ChevronDown class="size-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="min-w-52">
                            <DropdownMenuLabel class="flex flex-col gap-0.5">
                                <span class="text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-foreground/50">
                                    Signed in as
                                </span>
                                <span class="truncate">{{ displayName }}</span>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem as-child>
                                <RouterLink to="/settings">
                                    <Settings class="size-4" />
                                    Settings
                                </RouterLink>
                            </DropdownMenuItem>
                            <DropdownMenuItem @select="handleSignOut">
                                <LogOut class="size-4" />
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </ul>
            </nav>

            <!-- Mobile Menu -->
            <Sheet>
                <SheetTrigger as-child class="md:hidden ml-auto">
                    <Button variant="ghost" size="icon">
                        <Menu class="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent>
                    <nav class="flex flex-col gap-4 mt-8">
                        <template v-for="route in navRoutes" :key="route.id">
                            <RouterLink
                                :class="['text-lg font-semibold', route?.class]"
                                :to="route.path"
                            >
                                {{ route.name }}
                            </RouterLink>
                            <Separator />
                        </template>
                        <RouterLink
                            v-if="!isAuthenticated"
                            class="text-lg font-semibold login"
                            to="/login"
                        >
                            Login
                        </RouterLink>
                        <template v-else>
                            <div class="flex min-w-0 flex-col gap-0.5">
                                <span class="text-[0.6875rem] font-bold uppercase tracking-[0.06em] opacity-60">
                                    Signed in as
                                </span>
                                <span class="truncate text-lg font-semibold">{{ displayName }}</span>
                            </div>
                            <RouterLink class="text-lg font-semibold" to="/settings">
                                Settings
                            </RouterLink>
                            <Separator />
                            <button class="text-lg font-semibold login text-left" @click="handleSignOut">
                                Logout
                            </button>
                        </template>
                    </nav>
                </SheetContent>
            </Sheet>
        </div>
    </header>
</template>

<style scoped>
nav {
    width: calc(100vw - 18rem);
}

nav a.router-link-exact-active {
    border-bottom: 0.2rem solid hsl(var(--primary-foreground));
}

nav a.router-link-exact-active:hover {
    background-color: transparent;
}

ul {
    display: flex;
    flex-direction: row;
    gap: 2rem;
}

nav a,
nav button {
    font-weight: 600;
    text-decoration: none;
    font-size: 1.15rem;
    color: hsl(var(--primary-foreground));
    padding: 0.5rem 0;
    background: none;
    border: none;
    cursor: pointer;
}

nav a:hover,
nav button:hover {
    opacity: 0.8;
}

.user-menu-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
}

.login {
    margin-left: auto;
    margin-right: 1rem;
}
</style>
