<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { ROUTES } from '@/constants/constants';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Menu } from 'lucide-vue-next';
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
                    <template v-for="route in ROUTES" :key="route.id">
                        <RouterLink :class="route?.class" :to="route.path">
                            {{ route.name }}
                        </RouterLink>
                    </template>
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
                        <template v-for="route in ROUTES" :key="route.id">
                            <RouterLink
                                :class="['text-lg font-semibold', route?.class]"
                                :to="route.path"
                            >
                                {{ route.name }}
                            </RouterLink>
                            <Separator />
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
    border-bottom: 0.2rem solid var(--vt-c-black-soft);
}

nav a.router-link-exact-active:hover {
    background-color: transparent;
}

ul {
    display: flex;
    flex-direction: row;
    gap: 2rem;
}

nav a {
    font-weight: 600;
    text-decoration: none;
    font-size: 1.15rem;
    color: var(--vt-c-black-soft);
    padding: 0.5rem 0;
}

nav a:hover {
    opacity: 0.8;
}

.login {
    margin-left: auto;
    margin-right: 1rem;
}
</style>
