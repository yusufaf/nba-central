<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useLogto } from '@logto/vue';
import { DAILY_GAMES, ROUTES } from '@/constants/constants';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronDown, LogOut, Menu, Monitor, Moon, Settings, Sun } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useThemeControl } from '@/composables/useThemeControl';
import { IS_PREVIEW } from '@/utils/preview';

const { isAuthenticated, signOut } = useLogto();
const { currentUser } = useCurrentUser();
const { theme, disabled: themeDisabled, setTheme, options: themeOptions } = useThemeControl();
// A stale stored value is treated as System, as index.html does.
const themeIcon = computed(() => ({ light: Sun, dark: Moon })[theme.value as 'light' | 'dark'] ?? Monitor);

// The username comes from the access token's claims, which resolve a
// moment after isAuthenticated flips.
const displayName = computed(() => currentUser.value?.username ?? 'Account');

// Login is rendered separately below so it can swap for Logout once
// isAuthenticated flips — the plain route loop has no notion of auth state.
const navRoutes = computed(() => ROUTES.filter((route) => route.path !== '/login'));

// The Daily trigger is a button, not a link, so it can't get RouterLink's
// active class: it's underlined by hand while one of its games is open.
// The matched record's path, so /daily/ and /Cap-Five count too.
const currentRoute = useRoute();
const onDailyGame = computed(() => DAILY_GAMES.some((game) => game.path === currentRoute.matched[0]?.path));

// A full load, not a RouterLink, so the logo still resets the app as it
// always has; BASE_URL keeps a PR preview's logo inside that preview.
const homeHref = import.meta.env.BASE_URL;

function handleSignOut() {
    signOut(window.location.origin);
}
</script>

<template>
    <!-- The nav switches to the menu button on the header's width in rem, not a
         viewport breakpoint: a media query's rem ignores the Text size setting,
         and the full nav needs ~71rem at any size (signed in, with a username
         at its 10rem truncation). Below that its links wrap onto two lines. -->
    <header class="@container bg-primary text-black shadow-lg sticky top-0 z-50">
        <div class="flex items-center px-4 h-16">
            <div class="shrink-0">
                <a :href="homeHref">
                    <img
                        src="@/assets/TeamBuilderLogo1_Transparent2.png"
                        alt="NBA Team Builder Logo"
                        class="h-12"
                    />
                </a>
            </div>

            <!-- Desktop Nav -->
            <nav class="desktop-nav hidden @min-[72rem]:flex flex-1 ml-8">
                <ul>
                    <template v-for="route in navRoutes" :key="route.id">
                        <RouterLink :class="route?.class" :to="route.path">
                            {{ route.name }}
                        </RouterLink>
                    </template>
                    <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                            <button
                                type="button"
                                :class="['daily-trigger', { active: onDailyGame }]"
                                data-testid="daily-trigger"
                            >
                                Daily
                                <ChevronDown class="size-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" class="min-w-60">
                            <DropdownMenuItem v-for="game in DAILY_GAMES" :key="game.path" as-child>
                                <RouterLink :to="game.path" class="flex flex-col items-start gap-0.5">
                                    <span class="font-semibold">{{ game.name }}</span>
                                    <span class="text-xs text-foreground/60">{{ game.blurb }}</span>
                                </RouterLink>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu v-if="!isAuthenticated">
                        <DropdownMenuTrigger as-child>
                            <button
                                type="button"
                                class="theme-trigger"
                                aria-label="Theme"
                                data-testid="theme-trigger"
                            >
                                <component :is="themeIcon" class="size-5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="min-w-40">
                            <DropdownMenuLabel>Theme</DropdownMenuLabel>
                            <DropdownMenuRadioGroup
                                :model-value="theme"
                                @update:model-value="setTheme"
                            >
                                <DropdownMenuRadioItem
                                    v-for="option in themeOptions"
                                    :key="option.value"
                                    :value="option.value"
                                    :disabled="themeDisabled"
                                >
                                    {{ option.label }}
                                </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <RouterLink v-if="!isAuthenticated && !IS_PREVIEW" class="login" to="/login">
                        Login
                    </RouterLink>
                    <DropdownMenu v-else-if="isAuthenticated">
                        <DropdownMenuTrigger as-child>
                            <button
                                type="button"
                                class="login user-menu-trigger"
                                data-testid="user-menu-trigger"
                            >
                                <UserAvatar class="size-6 text-inherit" />
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
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Theme</DropdownMenuLabel>
                            <DropdownMenuRadioGroup
                                :model-value="theme"
                                @update:model-value="setTheme"
                            >
                                <DropdownMenuRadioItem
                                    v-for="option in themeOptions"
                                    :key="option.value"
                                    :value="option.value"
                                    :disabled="themeDisabled"
                                >
                                    {{ option.label }}
                                </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                            <DropdownMenuSeparator />
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
                <SheetTrigger as-child class="@min-[72rem]:hidden ml-auto">
                    <Button variant="ghost" size="icon" aria-label="Menu" data-testid="mobile-menu-trigger">
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
                        <span class="text-[0.6875rem] font-bold uppercase tracking-[0.06em] opacity-60">
                            Daily
                        </span>
                        <template v-for="game in DAILY_GAMES" :key="game.path">
                            <RouterLink class="text-lg font-semibold" :to="game.path">
                                {{ game.name }}
                            </RouterLink>
                            <Separator />
                        </template>
                        <RouterLink
                            v-if="!isAuthenticated && !IS_PREVIEW"
                            class="text-lg font-semibold login"
                            to="/login"
                        >
                            Login
                        </RouterLink>
                        <template v-else-if="isAuthenticated">
                            <div class="flex min-w-0 items-center gap-3">
                                <UserAvatar class="size-10 text-inherit" />
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
                    <!-- Outside .mobile-nav so its link/button colour rule
                         doesn't override the toggle's selected state. -->
                    <div class="mt-6 flex flex-col gap-2" data-testid="mobile-theme">
                        <span class="text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-foreground/60">
                            Theme
                        </span>
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            size="sm"
                            class="flex-wrap justify-start"
                            aria-label="Theme"
                            :model-value="theme"
                            :disabled="themeDisabled"
                            @update:model-value="setTheme"
                        >
                            <ToggleGroupItem
                                v-for="option in themeOptions"
                                :key="option.value"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
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

.desktop-nav .daily-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
}

.desktop-nav .daily-trigger.active {
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
    color: hsl(var(--primary-strong));
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

/* Signed out, the theme button takes the free space so it and Login sit
   together at the right. */
.desktop-nav .theme-trigger {
    display: inline-flex;
    align-items: center;
    margin-left: auto;
    margin-right: -1rem;
}

.desktop-nav .theme-trigger + .login {
    margin-left: 0;
}
</style>
