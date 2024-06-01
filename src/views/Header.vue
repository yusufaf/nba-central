<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import { ROUTES } from "@/constants/constants";
</script>

<template>
    <q-header elevated class="bg-primary text-black shadow-8">
        <q-toolbar>
            <q-toolbar-title shrink>
                <a href="/">
                    <img
                        src="@/assets/TeamBuilderLogo1_Transparent2.png"
                        alt="NBA Team Builder Logo"
                    />
                </a>
            </q-toolbar-title>
            <nav class="gt-sm">
                <ul>
                    <template v-for="route in ROUTES" :key="route.id">
                        <RouterLink :class="route?.class" :to="route.path">
                            {{ route.name }}
                        </RouterLink>
                    </template>
                </ul>
                <q-btn
                    class="lt-md"
                    color="black"
                    icon="more_vert"
                    title="More"
                >
                    <q-menu
                        dark
                        transition-show="jump-down"
                        transition-hide="jump-up"
                    >
                        <q-list>
                            <q-item>
                                <q-item-section> </q-item-section>
                            </q-item>
                            <q-item>
                                <q-item-section> </q-item-section>
                            </q-item>
                            <q-separator />
                        </q-list>
                    </q-menu>
                </q-btn>
            </nav>
        </q-toolbar>
    </q-header>
</template>

<style scoped>
nav {
    width: calc(100vw - 15rem);
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
}

.login {
    margin-left: auto;
    margin-right: 1rem;
}
</style>
