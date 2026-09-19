document.querySelector('[data-share="native"]')?.addEventListener('click', async () => {
  if (navigator.share) { try { await navigator.share({ title:document.title, url:location.href }); } catch {} }
  else { await navigator.clipboard.writeText(location.href); alert('Link copiado.'); }
});
document.querySelector('[data-share="copy"]')?.addEventListener('click', async event => {
  await navigator.clipboard.writeText(location.href);
  event.currentTarget.textContent = 'Link copiado ✓';
  setTimeout(() => { event.currentTarget.textContent = 'Copiar link ↗'; }, 2400);
});

