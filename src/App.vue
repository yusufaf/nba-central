<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";

</script>

<template>
  <q-layout view="hhh lpR fff">

    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-toolbar-title> NBA Team Builder </q-toolbar-title>
        <nav>
          <RouterLink to="/">Home</RouterLink>
          <RouterLink to="/scores">Scores</RouterLink>
          <RouterLink to="/news">News</RouterLink>
          <RouterLink to="/about">About</RouterLink>
        </nav>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <RouterView />
    </q-page-container>

    <q-footer elevated>
      <q-toolbar>
        <q-toolbar-title>
          <div>NBA Team Builder</div>
        </q-toolbar-title>
        <a href="https://github.com/yusufaf/nba-central">
          <img 
            alt="Github logo" 
            class="logo" src="@/assets/github.png" 
            width="32" 
            height="32" 
            title="Team Builder GitHub"
          />
        </a>
      </q-toolbar>
    </q-footer>
  </q-layout>

  <!-- <img
      alt="Vue logo"
      class="logo"
      src="@/assets/logo.svg"
      width="125"
      height="125"
    /> -->
</template>

<style scoped>
/* .logo {
  display: block;
  margin: 0 auto 2rem;
} */

/* nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
} */

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}
</style>
