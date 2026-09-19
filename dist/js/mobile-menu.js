const header = document.querySelector('.site-header');
const nav = header?.querySelector('nav');

if (header && nav) {
  const mobile = window.matchMedia('(max-width: 767px)');
  nav.id ||= 'site-navigation';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'mobile-menu-button';
  toggle.setAttribute('aria-controls', nav.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Abrir menu');
  toggle.innerHTML = '<span class="mobile-menu-icon" aria-hidden="true"></span><span>Menu</span>';
  header.insertBefore(toggle, nav);

  const close = (focusButton = false) => {
    header.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
    if (focusButton) toggle.focus();
  };

  toggle.addEventListener('click', () => {
    const opening = !header.classList.contains('menu-open');
    header.classList.toggle('menu-open', opening);
    toggle.setAttribute('aria-expanded', String(opening));
    toggle.setAttribute('aria-label', opening ? 'Fechar menu' : 'Abrir menu');
    if (opening) nav.querySelector('a,button')?.focus();
  });

  nav.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.classList.contains('menu-open')) close(true);
  });
  mobile.addEventListener('change', () => close());

  const filters = document.querySelector('.journal-filters');
  if (filters) {
    const group = document.createElement('div');
    group.className = 'mobile-menu-filters';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Filtrar publicações do Journal');

    const title = document.createElement('p');
    title.className = 'mobile-menu-filters-title';
    title.textContent = 'No Journal';
    group.append(title);

    for (const original of filters.querySelectorAll('[data-filter]')) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'mobile-menu-filter';
      option.textContent = original.textContent;
      const sync = () => {
        const active = original.getAttribute('aria-pressed') === 'true';
        option.classList.toggle('is-active', active);
        option.setAttribute('aria-pressed', String(active));
      };
      sync();
      new MutationObserver(sync).observe(original, { attributes: true, attributeFilter: ['aria-pressed'] });
      option.addEventListener('click', () => {
        original.click();
        close();
      });
      group.append(option);
    }
    nav.append(group);
  }

  document.documentElement.classList.add('has-mobile-menu');
}

