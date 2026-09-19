import './mobile-menu.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const ADMIN_EMAIL = 'rua5produtora@gmail.com';
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = selector => document.querySelector(selector);
const notify = (message, error = false) => { const element = $('#admin-message'); element.textContent = message; element.classList.toggle('is-error', error); };
const urlFor = path => db.storage.from('fashion-media').getPublicUrl(path).data.publicUrl;
const thumb = media => urlFor(media.thumbnail_path || media.path);
const state = { tab:'post', stories:[], media:[], editing:null, cover:null, gallery:[] };
let busy = false;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const slugify = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const form = $('#story-form');

async function verify() {
  const { data, error } = await db.auth.getUser();
  const allowed = !error && data.user?.email?.toLowerCase() === ADMIN_EMAIL;
  $('#login-panel').hidden = allowed;
  $('#dashboard').hidden = !allowed;
  if (allowed) await load();
  else if (data.user) { await db.auth.signOut(); notify('Esta conta não tem acesso ao painel.', true); }
}

async function load() {
  const [{ data: stories, error: storyError }, { data: media, error: mediaError }] = await Promise.all([
    db.from('fashion_stories').select('*').order('created_at', { ascending:false }),
    db.from('fashion_media').select('*').order('created_at', { ascending:false })
  ]);
  if (storyError || mediaError) throw storyError || mediaError;
  state.stories = stories;
  state.media = media;
  renderList();
  renderLibrary();
  if (state.editing) renderPickers();
}

function renderList() {
  const rows = state.stories.filter(row => row.kind === state.tab);
  $('#list-title').textContent = state.tab === 'event' ? 'Eventos' : 'Publicações';
  $('#new-story').textContent = state.tab === 'event' ? '+ Novo evento' : '+ Nova publicação';
  $('#story-list').innerHTML = rows.length ? rows.map(row => {
    const cover = state.media.find(item => item.id === row.cover_media_id);
    return `<article class="admin-story-row"><div class="admin-story-thumb">${cover ? `<img src="${escapeHtml(thumb(cover))}" alt="">` : ''}</div><div class="admin-story-details"><span class="admin-status ${row.status}">${row.status === 'published' ? 'Publicado' : 'Rascunho'}</span><h3>${escapeHtml(row.title)}</h3><small>${escapeHtml(row.story_date)} · ${escapeHtml(row.category)}</small></div><div class="admin-row-actions"><button type="button" data-edit="${row.id}">Editar</button><button type="button" data-toggle="${row.id}">${row.status === 'published' ? 'Despublicar' : 'Publicar'}</button><button type="button" data-delete="${row.id}">Excluir</button></div></article>`;
  }).join('') : '<p class="admin-empty">Nenhum conteúdo ainda. Comece criando uma história.</p>';
}

function renderLibrary() {
  $('#media-library').innerHTML = state.media.length ? state.media.map(item => `<article class="admin-media-item"><img src="${escapeHtml(thumb(item))}" alt="${escapeHtml(item.alt_text)}" loading="lazy"><p>${escapeHtml(item.filename)}</p><button type="button" data-media-delete="${item.id}">Excluir</button></article>`).join('') : '<p class="admin-empty">Nenhuma imagem enviada.</p>';
}

function renderPickers() {
  $('#cover-picker').innerHTML = state.media.map(item => `<button type="button" data-cover="${item.id}" class="admin-pick ${state.cover === item.id ? 'is-selected' : ''}" aria-label="Definir ${escapeHtml(item.filename)} como capa"><img src="${escapeHtml(thumb(item))}" alt="" loading="lazy"></button>`).join('');
  $('#gallery-media-picker').innerHTML = state.media.filter(item => !state.gallery.includes(item.id)).map(item => `<button type="button" data-gallery-add="${item.id}" class="admin-pick" aria-label="Adicionar ${escapeHtml(item.filename)} à galeria"><img src="${escapeHtml(thumb(item))}" alt="" loading="lazy"><span>+ Adicionar</span></button>`).join('');
  $('#gallery-picker').innerHTML = state.gallery.map((id, index) => {
    const item = state.media.find(row => row.id === id);
    return item ? `<div class="admin-gallery-item"><img src="${escapeHtml(thumb(item))}" alt="" loading="lazy"><div><span>${index + 1}</span><button type="button" data-gallery-up="${id}" aria-label="Mover foto para a esquerda">←</button><button type="button" data-gallery-down="${id}" aria-label="Mover foto para a direita">→</button><button type="button" data-gallery-remove="${id}" aria-label="Remover foto da galeria">×</button></div></div>` : '';
  }).join('');
}

function edit(row = null) {
  state.editing = row?.id || 'new';
  state.cover = row?.cover_media_id || null;
  state.gallery = [...(row?.gallery_media_ids || [])];
  form.reset();
  form.elements.id.value = row?.id || '';
  form.elements.kind.value = row?.kind || state.tab;
  for (const name of ['title','slug','subtitle','category','author','story_date','excerpt','body']) {
    form.elements[name].value = row?.[name] || (name === 'story_date' ? new Date().toISOString().slice(0, 10) : '');
  }
  if (!row && state.tab === 'event') form.elements.category.value = 'EVENTOS';
  form.elements.allow_downloads.checked = Boolean(row?.allow_downloads);
  $('#editor-title').textContent = row ? 'Editar conteúdo' : state.tab === 'event' ? 'Novo evento' : 'Nova publicação';
  $('#stories-panel').hidden = true;
  $('#media-panel').hidden = true;
  $('#editor-panel').hidden = false;
  renderPickers();
  $('#editor-panel').scrollIntoView({ behavior:'smooth' });
}

function closeEditor() {
  state.editing = null;
  $('#editor-panel').hidden = true;
  $('#stories-panel').hidden = state.tab === 'media';
  $('#media-panel').hidden = state.tab !== 'media';
}

async function save(status) {
  if (busy || !form.reportValidity()) return;
  const fields = Object.fromEntries(new FormData(form));
  if (status === 'published' && !state.cover) { notify('Selecione uma imagem de capa antes de publicar.', true); return; }
  const payload = {
    kind:fields.kind, title:fields.title.trim(), slug:fields.slug.trim(), subtitle:fields.subtitle.trim() || null,
    category:fields.kind === 'event' ? 'EVENTOS' : fields.category,
    author:fields.author.trim() || null, story_date:fields.story_date,
    excerpt:fields.excerpt.trim() || null, body:fields.body.trim() || null,
    cover_media_id:state.cover, gallery_media_ids:state.gallery,
    allow_downloads:form.elements.allow_downloads.checked, status
  };
  busy = true; notify('Salvando conteúdo…');
  try {
    const query = fields.id ? db.from('fashion_stories').update(payload).eq('id', fields.id) : db.from('fashion_stories').insert(payload);
    const { error } = await query;
    if (error) throw error;
    closeEditor(); await load(); notify(status === 'published' ? 'Conteúdo publicado. A página individual será atualizada automaticamente em alguns minutos.' : 'Rascunho salvo.');
  } catch (error) { notify(error.message || 'Não foi possível salvar.', true); }
  finally { busy = false; }
}

async function imageDimensions(file) {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width:bitmap.width, height:bitmap.height };
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .82));
  return { ...dimensions, blob };
}

async function upload(files) {
  if (busy || !files.length) return;
  busy = true;
  let done = 0;
  try {
    for (const file of files) {
      $('#upload-progress').textContent = `Enviando ${done + 1} de ${files.length}: ${file.name}`;
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error(`${file.name}: use JPEG, PNG ou WebP de até 20 MB.`);
      const info = await imageDimensions(file);
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const id = crypto.randomUUID();
      const path = `${id}.${ext}`;
      const thumbnailPath = `${id}-thumb.jpg`;
      const bucket = db.storage.from('fashion-media');
      let result = await bucket.upload(path, file, { contentType:file.type, upsert:false });
      if (result.error) throw result.error;
      result = await bucket.upload(thumbnailPath, info.blob, { contentType:'image/jpeg', upsert:false });
      if (result.error) { await bucket.remove([path]); throw result.error; }
      const inserted = await db.from('fashion_media').insert({ path, thumbnail_path:thumbnailPath, filename:file.name, alt_text:file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), width:info.width, height:info.height, bytes:file.size }).select('id').single();
      if (inserted.error) { await bucket.remove([path, thumbnailPath]); throw inserted.error; }
      if (state.editing) { state.gallery.push(inserted.data.id); if (!state.cover) state.cover = inserted.data.id; }
      done++;
    }
    await load();
    notify(`${done} ${done === 1 ? 'imagem enviada' : 'imagens enviadas'} com sucesso.`);
  } catch (error) { notify(error.message || 'Falha ao enviar imagens.', true); }
  finally { busy = false; $('#upload-progress').textContent = ''; }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const email = $('#login-email').value.trim().toLowerCase();
  if (email !== ADMIN_EMAIL) { notify('E-mail não autorizado.', true); return; }
  const { error } = await db.auth.signInWithOtp({ email, options:{ shouldCreateUser:true } });
  notify(error ? error.message : 'Enviamos um link de acesso. Abra-o neste navegador.', Boolean(error));
});
$('#logout-button').addEventListener('click', async () => { await db.auth.signOut(); closeEditor(); await verify(); notify('Sessão encerrada.'); });
$('#new-story').addEventListener('click', () => edit());
$('#close-editor').addEventListener('click', closeEditor);
form.elements.title.addEventListener('input', () => { if (!form.elements.id.value) form.elements.slug.value = slugify(form.elements.title.value); });
form.addEventListener('submit', event => { event.preventDefault(); save('published'); });
$('#save-draft').addEventListener('click', () => save('draft'));
$('#image-upload').addEventListener('change', event => { upload([...event.target.files]); event.target.value = ''; });
$('#library-upload').addEventListener('change', event => { upload([...event.target.files]); event.target.value = ''; });
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  state.tab = button.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(tab => tab.classList.toggle('is-active', tab === button));
  closeEditor(); renderList();
}));
$('#story-list').addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button || busy) return;
  const id = button.dataset.edit || button.dataset.toggle || button.dataset.delete;
  const row = state.stories.find(item => item.id === id); if (!row) return;
  if (button.dataset.edit) { edit(row); return; }
  if (button.dataset.delete && !confirm(`Excluir “${row.title}”?`)) return;
  if (button.dataset.toggle && row.status === 'draft' && !row.cover_media_id) { notify('Defina uma capa antes de publicar.', true); return; }
  busy = true;
  const query = button.dataset.delete ? db.from('fashion_stories').delete().eq('id', id) : db.from('fashion_stories').update({ status:row.status === 'published' ? 'draft' : 'published' }).eq('id', id);
  const { error } = await query;
  if (error) notify(error.message, true); else { await load(); notify(button.dataset.delete ? 'Conteúdo excluído.' : 'Status atualizado.'); }
  busy = false;
});
$('#editor-panel').addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  const id = button.dataset.cover || button.dataset.galleryAdd || button.dataset.galleryRemove || button.dataset.galleryUp || button.dataset.galleryDown;
  if (!id) return;
  if (button.dataset.cover) state.cover = id;
  if (button.dataset.galleryAdd) state.gallery.push(id);
  if (button.dataset.galleryRemove) state.gallery = state.gallery.filter(item => item !== id);
  if (button.dataset.galleryUp || button.dataset.galleryDown) { const at = state.gallery.indexOf(id); const to = at + (button.dataset.galleryUp ? -1 : 1); if (to >= 0 && to < state.gallery.length) [state.gallery[at],state.gallery[to]] = [state.gallery[to],state.gallery[at]]; }
  renderPickers();
});
$('#media-library').addEventListener('click', async event => {
  const id = event.target.closest('[data-media-delete]')?.dataset.mediaDelete; if (!id || busy) return;
  const item = state.media.find(row => row.id === id); if (!item) return;
  if (state.stories.some(row => row.cover_media_id === id || row.gallery_media_ids.includes(id))) { notify('Esta imagem está em uso. Retire-a das publicações antes de excluir.', true); return; }
  if (!confirm(`Excluir “${item.filename}”?`)) return;
  busy = true;
  const { error } = await db.from('fashion_media').delete().eq('id', id);
  if (error) notify(error.message, true);
  else { await db.storage.from('fashion-media').remove([item.path, item.thumbnail_path].filter(Boolean)); await load(); notify('Imagem excluída.'); }
  busy = false;
});

verify().catch(error => { $('#login-panel').hidden = false; notify(error.message || 'Não foi possível abrir o painel.', true); });

