<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";

</script>

<template>
  <q-layout view="hhh lpR fff">
    <q-header elevated class="bg-primary text-black">
      <q-toolbar>
        <q-toolbar-title shrink> NBA Team Builder
        </q-toolbar-title>
        <nav>
          <ul>
            <RouterLink to="/">Home</RouterLink>
            <RouterLink to="/scores">Scores</RouterLink>
            <RouterLink to="/news">News</RouterLink>
            <RouterLink to="/about">About</RouterLink>
            <RouterLink class="login" to="/login">Sign In</RouterLink>
          </ul>

        </nav>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <RouterView />
    </q-page-container>

    <q-footer elevated class="bg-primary text-black">
      <q-toolbar>
        <q-toolbar-title>
          <div>NBA Team Builder</div>
        </q-toolbar-title>
        <a href="https://github.com/yusufaf/nba-central">
          <img alt="Github logo" class="logo" src="@/assets/github.png" width="32" height="32"
            title="Team Builder GitHub" />
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

nav a.router-link-exact-active {
  color: var(--color-text);

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
  /* display: inline-block; */
}

.login {
  margin-left: auto;
}
</style>
