/*
 * Configuración pública del cliente.
 * Copia aquí la URL y la clave "publishable/anon" de tu proyecto de Supabase.
 * Nunca uses la clave service_role en este archivo.
 */
window.BIG_BOY_CONFIG = {
  supabaseUrl: "https://nfvggpgeypkkqceivkaq.supabase.co",
  supabasePublishableKey: "sb_publishable_76a6wcA_Ow12tT9r_OlvWQ_MN7ALhfX",
  news: {
    deportesFeeds: [
      "https://news.google.com/rss/search?q=f%C3%BAtbol%20OR%20LaLiga%20OR%20Champions%20OR%20fichajes&hl=es&gl=ES&ceid=ES%3Aes",
      "https://news.google.com/rss/search?q=site%3Amarca.com%20OR%20site%3Aas.com%20OR%20site%3Arelevo.com%20f%C3%BAtbol&hl=es&gl=ES&ceid=ES%3Aes",
      "https://news.google.com/rss/search?q=%22Fabrizio%20Romano%22%20OR%20site%3Amundodeportivo.com%20OR%20site%3Asport.es&hl=es&gl=ES&ceid=ES%3Aes"
    ],
    espanaFeeds: [
      "https://news.google.com/rss/search?q=Espa%C3%B1a&hl=es&gl=ES&ceid=ES%3Aes",
      "https://news.google.com/rss/search?q=site%3Aelpais.com%20OR%20site%3Aelmundo.es%20OR%20site%3Artve.es%20Espa%C3%B1a&hl=es&gl=ES&ceid=ES%3Aes",
      "https://news.google.com/rss/search?q=site%3Alavanguardia.com%20OR%20site%3Aabc.es%20OR%20site%3Aeldiario.es%20Espa%C3%B1a&hl=es&gl=ES&ceid=ES%3Aes"
    ],
    mundoFeeds: [
      "https://news.google.com/rss/search?q=Internacional&hl=es&gl=ES&ceid=ES%3Aes",
      "https://news.google.com/rss/search?q=site%3Abbc.com%2Fmundo%20OR%20site%3Aes.euronews.com%20OR%20site%3Adw.com%2Fes&hl=es&gl=ES&ceid=ES%3Aes",
      "https://news.google.com/rss/search?q=site%3Acnnespanol.cnn.com%20OR%20site%3Afrance24.com%2Fes%20internacional&hl=es&gl=ES&ceid=ES%3Aes"
    ],
    deportesFeed: "https://news.google.com/rss/search?q=f%C3%BAtbol%20OR%20%22Fabrizio%20Romano%22%20OR%20MARCA%20OR%20%22Diario%20AS%22%20OR%20%22Mundo%20Deportivo%22&hl=es&gl=ES&ceid=ES%3Aes",
    deportesFallbackFeed: "https://news.google.com/rss/search?q=f%C3%BAtbol%20OR%20LaLiga%20OR%20Champions%20OR%20fichajes%20OR%20%22selecci%C3%B3n%20espa%C3%B1ola%22&hl=es&gl=ES&ceid=ES%3Aes",
    espanaFeed: "https://news.google.com/rss/search?q=Espa%C3%B1a&hl=es&gl=ES&ceid=ES%3Aes",
    mundoFeed: "https://news.google.com/rss/search?q=Internacional&hl=es&gl=ES&ceid=ES%3Aes"
  }
};
