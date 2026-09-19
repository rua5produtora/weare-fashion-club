import { readFile, writeFile, mkdir, readdir, unlink, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const base = resolve('dist');
const local = await readFile('.env.local', 'utf8').catch(() => '');
const values = Object.fromEntries(local.split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
const supabase = process.env.SUPABASE_URL || values.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || values.SUPABASE_PUBLISHABLE_KEY;
const site = (process.env.SITE_URL || 'https://rua5produtora.github.io/weare-fashion-club/').replace(/\/?$/, '/');
if (!supabase || !key) throw new Error('SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY são obrigatórios.');
await mkdir(join(base, 'js'), { recursive: true });
await writeFile(join(base, 'js', 'config.js'), `export const SUPABASE_URL = ${JSON.stringify(supabase)};\nexport const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(key)};\n`);

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
const image = path => path ? `${supabase}/storage/v1/object/public/fashion-media/${path.split('/').map(encodeURIComponent).join('/')}` : `${site}images/logo.png`;
const safeSlug = slug => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
const date = value => value ? new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(`${value}T12:00:00Z`)) : '';

async function rows(table, query) {
  const url = new URL(`${supabase}/rest/v1/${table}`);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  const response = await fetch(url, { headers: { apikey: key } });
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  return response.json();
}

const stories = await rows('fashion_stories', { select:'*', status:'eq.published', order:'story_date.desc,created_at.desc', limit:'1000' });
const mediaRows = await rows('fashion_media', { select:'*', limit:'5000' });
const media = new Map(mediaRows.map(row => [row.id, row]));
const demoPosts = JSON.parse(await readFile(join(base, 'data', 'demo-posts.json'), 'utf8'));
const directories = [];
for (const story of stories) {
  if (!safeSlug(story.slug) || !['post', 'event'].includes(story.kind)) continue;
  const folder = story.kind === 'event' ? 'events' : 'journal';
  const directory = join(base, folder, story.slug);
  const relative = `${folder}/${story.slug}`;
  directories.push(relative);
  const canonical = new URL(`${relative}/`, site).href;
  const cover = media.get(story.cover_media_id);
  const coverUrl = image(cover?.path);
  const gallery = [...new Set(story.gallery_media_ids || [])].map(id => media.get(id)).filter(Boolean);
  const body = String(story.body || '').split(/\n\s*\n/).filter(Boolean).map(block => `<p>${esc(block).replace(/\n/g, '<br>')}</p>`).join('');
  const related = stories.filter(row => row.id !== story.id && row.kind === story.kind).slice(0, 3).map(row => `<a href="../../${row.kind === 'event' ? 'events' : 'journal'}/${esc(row.slug)}/">${esc(row.title)} <span>↗</span></a>`).join('');
  const title = esc(story.title);
  const description = esc((story.excerpt || story.subtitle || story.body || story.title).replace(/\s+/g, ' ').slice(0, 180));
  const jsonLd = JSON.stringify({ '@context':'https://schema.org', '@type':story.kind === 'event' ? 'ImageGallery' : 'BlogPosting', headline:story.title, description:description, datePublished:story.published_at || story.story_date, dateModified:story.updated_at, image:coverUrl, url:canonical, author:{ '@type':'Organization', name:story.author || 'Weare Fashion Club' } }).replace(/</g, '\\u003c');
  const galleryHtml = gallery.length ? `<section class="story-gallery" aria-labelledby="gallery-heading"><div class="section-head"><h2 id="gallery-heading">Galeria<span>.</span></h2><p>${gallery.length} imagens</p></div><div class="story-gallery-grid">${gallery.map((item, i) => `<button type="button" class="gallery-tile" data-gallery-index="${i}" aria-label="Abrir fotografia ${i + 1} de ${gallery.length}"><img src="${esc(image(item.thumbnail_path || item.path))}" alt="${esc(item.alt_text || `${story.title}, fotografia ${i + 1}`)}" loading="lazy" decoding="async"></button>`).join('')}</div></section>` : '';
  const galleryData = JSON.stringify(gallery.map(item => ({ src:image(item.path), alt:item.alt_text || story.title, filename:item.filename }))).replace(/</g, '\\u003c');
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#141414"><title>${title} — Weare Fashion Club</title><meta name="description" content="${description}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="article"><meta property="og:site_name" content="Weare Fashion Club"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="${esc(coverUrl)}"><meta property="og:url" content="${esc(canonical)}"><meta name="twitter:card" content="summary_large_image"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Italiana&display=swap" rel="stylesheet"><link rel="stylesheet" href="../../site.css"><script type="application/ld+json">${jsonLd}</script></head>
<body class="journal-page story-page"><a class="skip" href="#conteudo">Ir para o conteúdo</a><header class="site-header"><a class="brand" href="../../" aria-label="Weare Fashion Club, início"><img src="../../images/logo.png" alt=""><span>weare<br>fashionclub</span></a><nav aria-label="Navegação principal"><a class="nav-events" href="../../eventos/">Eventos</a><a class="nav-journal" href="../../journal/">Journal</a><a href="../../#sobre">O clube</a><a href="../../#editorial">Editorial</a><a href="../../#contato">Contato</a><a class="nav-instagram" href="https://www.instagram.com/wearefashionclub/" target="_blank" rel="noopener noreferrer">Instagram</a></nav></header>
<main id="conteudo"><article class="story-article"><div class="story-heading"><a class="story-back" href="../../${folder}/">← ${story.kind === 'event' ? 'Todos os eventos' : 'Voltar ao Journal'}</a><p class="section-label">${esc(story.kind === 'event' ? 'Eventos' : story.category)}</p><h1>${title}</h1>${story.subtitle ? `<p class="story-subtitle">${esc(story.subtitle)}</p>` : ''}<div class="story-byline"><time datetime="${esc(story.story_date)}">${esc(date(story.story_date))}</time>${story.author ? `<span>Por ${esc(story.author)}</span>` : ''}</div></div>${cover ? `<figure class="story-cover"><img src="${esc(coverUrl)}" alt="${esc(cover.alt_text || story.title)}" fetchpriority="high"></figure>` : ''}<div class="story-content">${story.excerpt ? `<p class="story-lede">${esc(story.excerpt)}</p>` : ''}${body}</div>${galleryHtml}<div class="story-actions"><button type="button" data-share="native">Compartilhar ↗</button><a href="https://wa.me/?text=${encodeURIComponent(`${story.title} ${canonical}`)}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a><button type="button" data-share="copy">Copiar link ↗</button></div>${related ? `<aside class="story-related"><p class="section-label">Continue no clube</p><h2>Mais histórias<span>.</span></h2>${related}</aside>` : ''}</article></main><footer><span>© Weare Fashion Club</span><a href="../../journal/">Journal ↑</a></footer>
<dialog class="gallery-lightbox" aria-label="Fotografia em tela cheia"><div class="lightbox-bar"><span class="lightbox-counter"></span><div><a class="lightbox-download" href="#" download ${story.allow_downloads ? '' : 'hidden'}>Baixar ↓</a><button type="button" class="lightbox-close" aria-label="Fechar">×</button></div></div><button type="button" class="lightbox-prev" aria-label="Fotografia anterior">←</button><img class="lightbox-image" alt=""><button type="button" class="lightbox-next" aria-label="Próxima fotografia">→</button></dialog><script type="application/json" id="gallery-data">${galleryData}</script><script type="module" src="../../js/story.js"></script></body></html>`;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'index.html'), html);
  await writeFile(join(directory, '.fashion-generated'), 'Generated by scripts/build-site.mjs\n');
}

for (const demo of demoPosts) {
  if (!safeSlug(demo.slug) || !/^[a-z0-9-]+\.(?:jpg|png|webp)$/.test(demo.cover_image)) throw new Error('Publicação ilustrativa inválida.');
  const relative = `journal/${demo.slug}`;
  if (directories.includes(relative)) continue;
  const directory = join(base, relative);
  const canonical = new URL(`${relative}/`, site).href;
  const photo = new URL(`images/${demo.cover_image}`, site).href;
  const body = String(demo.body || '').split(/\n\s*\n/).filter(Boolean).map(block => `<p>${esc(block)}</p>`).join('');
  const related = demoPosts.filter(row => row.slug !== demo.slug).slice(0, 3).map(row => `<a href="../${esc(row.slug)}/">${esc(row.title)} <span>↗</span></a>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#141414"><meta name="robots" content="noindex,follow"><title>${esc(demo.title)} — Weare Fashion Club</title><meta name="description" content="Publicação ilustrativa do Journal Weare Fashion Club."><meta property="og:title" content="${esc(demo.title)}"><meta property="og:description" content="Publicação ilustrativa do Journal Weare Fashion Club."><meta property="og:image" content="${esc(photo)}"><meta property="og:url" content="${esc(canonical)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Italiana&display=swap" rel="stylesheet"><link rel="stylesheet" href="../../site.css"></head><body class="journal-page story-page"><a class="skip" href="#conteudo">Ir para o conteúdo</a><header class="site-header"><a class="brand" href="../../" aria-label="Weare Fashion Club, início"><img src="../../images/logo.png" alt=""><span>weare<br>fashionclub</span></a><nav aria-label="Navegação principal"><a class="nav-events" href="../../eventos/">Eventos</a><a class="nav-journal" href="../../journal/">Journal</a><a href="../../#sobre">O clube</a><a href="../../#editorial">Editorial</a><a href="../../#contato">Contato</a><a class="nav-instagram" href="https://www.instagram.com/wearefashionclub/" target="_blank" rel="noopener noreferrer">Instagram</a></nav></header><main id="conteudo"><article class="story-article"><div class="story-heading"><a class="story-back" href="../">← Voltar ao Journal</a><p class="section-label">${esc(demo.category)} · Exemplo</p><h1>${esc(demo.title)}</h1><p class="story-subtitle">${esc(demo.subtitle)}</p><div class="story-byline"><span>Conteúdo de demonstração</span></div></div><figure class="story-cover"><img src="../../images/${esc(demo.cover_image)}" alt="${esc(demo.image_alt)}" fetchpriority="high"></figure><div class="story-content"><p class="story-lede">Publicação ilustrativa para apresentar o visual do Journal.</p>${body}</div><div class="story-actions"><button type="button" data-share="native">Compartilhar ↗</button><a href="https://wa.me/?text=${encodeURIComponent(`${demo.title} ${canonical}`)}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a><button type="button" data-share="copy">Copiar link ↗</button></div><aside class="story-related"><p class="section-label">Continue no clube</p><h2>Mais histórias<span>.</span></h2>${related}</aside></article></main><footer><span>© Weare Fashion Club</span><a href="../">Journal ↑</a></footer><script type="module" src="../../js/demo-story.js"></script></body></html>`;
  await mkdir(directory, { recursive:true });
  await writeFile(join(directory, 'index.html'), html);
}

const manifestPath = join(base, '.generated-stories.json');
const previous = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '[]'));
for (const relative of previous) {
  if (directories.includes(relative) || !/^(journal|events)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(relative)) continue;
  if (demoPosts.some(post => relative === `journal/${post.slug}`)) continue;
  const directory = resolve(base, relative);
  if (!directory.startsWith(base + '\\') && !directory.startsWith(base + '/')) continue;
  const files = await readdir(directory).catch(() => []);
  if (files.sort().join(',') !== '.fashion-generated,index.html') continue;
  await unlink(join(directory, 'index.html'));
  await unlink(join(directory, '.fashion-generated'));
  await rmdir(directory);
}
await writeFile(manifestPath, JSON.stringify(directories, null, 2));
const sitemapPages = ['', 'eventos/', 'journal/', 'events/', ...directories.map(path => `${path}/`)];
await writeFile(join(base, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapPages.map(path => `<url><loc>${esc(new URL(path, site).href)}</loc></url>`).join('')}</urlset>\n`);
await writeFile(join(base, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${new URL('sitemap.xml', site).href}\n`);
console.log(`Built ${directories.length} published story pages.`);

