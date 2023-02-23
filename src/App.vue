<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <q-layout view="hhh lpR fff">
    <q-header elevated class="bg-primary text-black shadow-8">
      <q-toolbar>
        <q-toolbar-title> NBA Team Builder </q-toolbar-title>
        <nav class="gt-sm">
          <ul>
            <RouterLink to="/">Home</RouterLink>
            <RouterLink to="/teams">My Teams</RouterLink>
            <RouterLink to="/teambuilder">Team Builder</RouterLink>
            <RouterLink to="/scores">Scores</RouterLink>
            <RouterLink to="/news">News</RouterLink>
            <RouterLink class="login" to="/login">Sign In</RouterLink>
          </ul>
          <q-btn class="lt-md" color="black" icon="more_vert" title="More">
            <q-menu dark transition-show="jump-down" transition-hide="jump-up">
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

    <q-page-container>
      <RouterView />
    </q-page-container>

    <q-footer elevated class="bg-primary text-black">
      <q-toolbar>
        <q-toolbar-title>
          <div>NBA Team Builder</div>
        </q-toolbar-title>
        <a href="https://github.com/yusufaf/nba-central">
          <img
            alt="Github logo"
            class="logo"
            src="@/assets/github.png"
            width="32"
            height="32"
            title="Team Builder GitHub"
          />
        </a>
      </q-toolbar>
    </q-footer>
  </q-layout>
</template>

<style scoped>
/* TODO: Styling for the nav bar pages */
nav {
  width: calc(100vw - 13rem);
}

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
ul a:nth-child(5) {
  flex: 1;
}
.login {
  margin-left: auto;
  margin-right: 1rem;
}
</style>
