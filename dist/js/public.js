import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const root = new URL('../', import.meta.url);
const endpoint = `${SUPABASE_URL}/rest/v1`;
const headers = { apikey: SUPABASE_PUBLISHABLE_KEY };

function dateLabel(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function publicImage(path) {
  if (!path) return '';
  return `${SUPABASE_URL}/storage/v1/object/public/fashion-media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function getRows(table, parameters) {
  const url = new URL(`${endpoint}/${table}`);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Falha ao carregar conteúdo (${response.status})`);
  return response.json();
}

function card(story, media) {
  const link = document.createElement('a');
  link.className = 'story-card';
  link.href = new URL(`${story.kind === 'event' ? 'events' : 'journal'}/${story.slug}/`, root);
  const cover = media.get(story.cover_media_id);
  const image = document.createElement('img');
  image.loading = 'lazy';
  image.alt = story.image_alt || cover?.alt_text || story.title;
  if (story.demoImage) image.src = new URL(`images/${story.demoImage}`, root);
  else if (cover) image.src = publicImage(cover.thumbnail_path || cover.path);
  link.append(image);
  const meta = document.createElement('p');
  meta.className = 'story-card-meta';
  meta.textContent = story.demoImage ? `EXEMPLO · ${story.category}` : `${story.kind === 'event' ? 'EVENTOS' : story.category} — ${dateLabel(story.story_date)}`;
  link.append(meta);
  const title = document.createElement('h3');
  title.textContent = story.title;
  link.append(title);
  return link;
}

async function load() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) throw new Error('Conteúdo temporariamente indisponível.');
  const stories = await getRows('fashion_stories', { select: 'id,kind,slug,title,category,story_date,cover_media_id', status: 'eq.published', order: 'story_date.desc,created_at.desc', limit: '120' });
  const ids = [...new Set(stories.map(row => row.cover_media_id).filter(Boolean))];
  const mediaRows = ids.length ? await getRows('fashion_media', { select: 'id,path,thumbnail_path,alt_text', id: `in.(${ids.join(',')})` }) : [];
  return { stories, media: new Map(mediaRows.map(row => [row.id, row])) };
}

function empty(status, message) { status.textContent = message; status.hidden = false; }

async function render() {
  const latest = document.getElementById('latest');
  const journal = document.getElementById('journal-grid');
  const events = document.getElementById('events-grid');
  try {
    const { stories, media } = await load();
    if (latest && stories.length) {
      document.getElementById('latest-grid').replaceChildren(...stories.slice(0, 3).map(row => card(row, media)));
      latest.hidden = false;
    }
    if (journal) {
      const publishedPosts = stories.filter(row => row.kind === 'post');
      const demoRows = publishedPosts.length ? [] : (await (await fetch(new URL('data/demo-posts.json', root))).json()).map(row => ({ ...row, kind:'post', demoImage:row.cover_image }));
      const journalStories = [...stories, ...demoRows];
      const demoNote = document.getElementById('journal-demo-note');
      if (demoNote) demoNote.hidden = demoRows.length === 0;
      const status = document.getElementById('journal-status');
      const draw = filter => {
        const chosen = filter === 'TODOS' ? journalStories : journalStories.filter(row => filter === 'EVENTOS' ? row.kind === 'event' || row.category === 'EVENTOS' : row.kind === 'post' && row.category === filter);
        journal.replaceChildren(...chosen.map(row => card(row, media)));
        if (chosen.length) status.hidden = true;
        else empty(status, 'Ainda não há histórias nesta categoria. Volte em breve.');
      };
      document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(item => { item.classList.remove('is-active'); item.setAttribute('aria-pressed', 'false'); });
        button.classList.add('is-active'); button.setAttribute('aria-pressed', 'true'); draw(button.dataset.filter);
      }));
      draw('TODOS');
    }
    if (events) {
      const rows = stories.filter(row => row.kind === 'event');
      events.replaceChildren(...rows.map(row => card(row, media)));
      const status = document.getElementById('events-status');
      if (rows.length) status.hidden = true;
      else empty(status, 'Os registros dos próximos encontros aparecerão aqui.');
    }
  } catch (error) {
    for (const id of ['journal-status', 'events-status']) {
      const status = document.getElementById(id);
      if (status) empty(status, 'Não foi possível carregar as histórias agora. Tente novamente em instantes.');
    }
    console.error(error);
  }
}

render();

