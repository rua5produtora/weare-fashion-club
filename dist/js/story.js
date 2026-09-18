const gallery = JSON.parse(document.getElementById('gallery-data')?.textContent || '[]');
const dialog = document.querySelector('.gallery-lightbox');
const preview = dialog.querySelector('.lightbox-image');
const counter = dialog.querySelector('.lightbox-counter');
const download = dialog.querySelector('.lightbox-download');
let position = 0;
let touchStart = 0;

function show(index) {
  if (!gallery.length) return;
  position = (index + gallery.length) % gallery.length;
  const item = gallery[position];
  preview.src = item.src;
  preview.alt = item.alt;
  counter.textContent = `${position + 1} / ${gallery.length}`;
  download.href = item.src;
  download.download = item.filename || `fashion-club-${position + 1}.jpg`;
}
document.querySelectorAll('[data-gallery-index]').forEach(button => button.addEventListener('click', () => {
  show(Number(button.dataset.galleryIndex));
  dialog.showModal();
}));
dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
dialog.querySelector('.lightbox-prev').addEventListener('click', () => show(position - 1));
dialog.querySelector('.lightbox-next').addEventListener('click', () => show(position + 1));
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') show(position - 1);
  if (event.key === 'ArrowRight') show(position + 1);
});
dialog.addEventListener('touchstart', event => { touchStart = event.changedTouches[0].clientX; }, { passive:true });
dialog.addEventListener('touchend', event => {
  const distance = event.changedTouches[0].clientX - touchStart;
  if (Math.abs(distance) > 45) show(position + (distance < 0 ? 1 : -1));
}, { passive:true });
document.querySelector('[data-share="native"]')?.addEventListener('click', async () => {
  if (navigator.share) { try { await navigator.share({ title:document.title, url:location.href }); } catch {} }
  else { await navigator.clipboard.writeText(location.href); alert('Link copiado.'); }
});
document.querySelector('[data-share="copy"]')?.addEventListener('click', async () => {
  await navigator.clipboard.writeText(location.href);
  const button = document.querySelector('[data-share="copy"]');
  button.textContent = 'Link copiado ✓';
  setTimeout(() => { button.textContent = 'Copiar link ↗'; }, 2400);
});

