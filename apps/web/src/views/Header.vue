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
import { ChevronDown, LogOut, Menu, Settings } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
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
    <!-- The nav switches to the menu button on the header's width in rem, not a
         viewport breakpoint: a media query's rem ignores the Text size setting,
         and the full nav needs ~54rem at any size (signed in, with a username). -->
    <header class="@container bg-primary text-black shadow-lg sticky top-0 z-50">
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
            <nav class="desktop-nav hidden @min-[56rem]:flex flex-1 ml-8">
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
                                <UserAvatar class="size-6" />
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
                <SheetTrigger as-child class="@min-[56rem]:hidden ml-auto">
                    <Button variant="ghost" size="icon">
                        <Menu class="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent>
                    <nav class="mobile-nav flex flex-col gap-4 mt-8">
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
                            <div class="flex min-w-0 items-center gap-3">
                                <UserAvatar class="size-10" />
                                <div class="flex min-w-0 flex-col gap-0.5">
                                    <span class="text-[0.6875rem] font-bold uppercase tracking-[0.06em] opacity-60">
                                        Signed in as
                                    </span>
                                    <span class="truncate text-lg font-semibold">{{ displayName }}</span>
                                </div>
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
/* These used to target every <nav>, including the one in the mobile Sheet,
   which drew its links in the header's dark text on the Sheet's dark
   background and squeezed it to 100vw - 18rem. */
.desktop-nav {
    width: calc(100vw - 18rem);
}

.desktop-nav a.router-link-exact-active {
    border-bottom: 0.2rem solid hsl(var(--primary-foreground));
}

.desktop-nav a.router-link-exact-active:hover {
    background-color: transparent;
}

/* flex: 1 so the list spans the nav; without it the list is only as wide as
   its links and .login's margin-left: auto has no free space to push into. */
ul {
    display: flex;
    flex: 1;
    flex-direction: row;
    gap: 2rem;
}

.desktop-nav a,
.desktop-nav button {
    font-weight: 600;
    text-decoration: none;
    font-size: 1.15rem;
    color: hsl(var(--primary-foreground));
    padding: 0.5rem 0;
    background: none;
    border: none;
    cursor: pointer;
}

.desktop-nav a:hover,
.desktop-nav button:hover {
    opacity: 0.8;
}

.mobile-nav a,
.mobile-nav button {
    color: hsl(var(--foreground));
}

.mobile-nav a.router-link-exact-active {
    color: hsl(var(--primary));
}

.user-menu-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
}

.desktop-nav .login {
    margin-left: auto;
    margin-right: 1rem;
}
</style>
