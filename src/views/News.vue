<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import PageTitle from "@/components/PageTitle.vue";
import { ESPN_NEWS_URL } from "@/constants/constants";
import axios from "axios";
import { useQuasar } from "quasar";

const $q = useQuasar();

const isMobile = $q.platform.is.mobile;
const linkProperty = isMobile ? "mobile" : "web";

const espnArticles = ref<any[]>([]);

const fetchNews = async () => {
  const response = await axios.get(ESPN_NEWS_URL);
  console.log(response.data);
  const { articles } = response.data;
  espnArticles.value = articles;
};

const formatDateTime = (dateTimeStr: string) => {
  const dateTime = new Date(dateTimeStr);
  const date = dateTime.toLocaleDateString();
  const time = dateTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
};

onMounted(() => {
  fetchNews();
});
</script>

<template>
  <main class="news-page">
    <PageTitle />
    <div class="news-container">
      <template v-for="(article, index) in espnArticles" :key="index">
        <q-card dark>
          <q-card-section class="main-card-section">
            <div>
              <a class="link" :href="article.links[linkProperty].href" target="_blank">
              {{ article.headline ?? "" }}
              </a>
              <div v-if="article.byline">by {{ article.byline }}</div>
            </div>
            <div class="date-container">
              <q-icon name="calendar_today" />
              <span> {{ formatDateTime(article.published) ?? "" }} </span>
            </div>
          </q-card-section>
          <q-separator />
        </q-card>
      </template>
    </div>
  </main>
</template>

<style scoped>
.news-page {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding: 0 4rem;
}

.main-card-section {
  display: flex;
}

.date-container {
  margin-left: auto;
}

.link {
  color: var(--q-primary)
}

.link:visited {
  color: var(--q-secondary)
}

</style>
