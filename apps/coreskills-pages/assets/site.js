(() => {
  const root = document.documentElement;
  const body = document.body;
  const stored = localStorage.getItem('oneorigin-theme');
  if (stored === 'light' || stored === 'dark') body.dataset.theme = stored;

  const themeButton = document.querySelector('[data-theme-toggle]');
  themeButton?.addEventListener('click', () => {
    const next = body.dataset.theme === 'light' ? 'dark' : 'light';
    body.dataset.theme = next;
    localStorage.setItem('oneorigin-theme', next);
    themeButton.setAttribute('aria-label', `Switch to ${next === 'light' ? 'dark' : 'light'} theme`);
  });

  const navToggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  navToggle?.addEventListener('click', () => {
    const open = nav?.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(Boolean(open)));
  });
  nav?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      navToggle?.setAttribute('aria-expanded', 'false');
    });
  });

  const progress = document.querySelector('[data-progress]');
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
  };
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealables = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px' },
    );
    revealables.forEach((el) => observer.observe(el));
  }

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const block = button.closest('.code');
      const code = block?.querySelector('code') ?? block?.querySelector('pre');
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.textContent = 'Copied';
      } catch {
        button.textContent = 'Select text';
      }
      window.setTimeout(() => (button.textContent = 'Copy'), 1600);
    });
  });

  if ('IntersectionObserver' in window) {
    const links = [...document.querySelectorAll('.docs-sidebar a[href^="#"]')];
    const sections = links
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);
    const navObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        links.forEach((link) => {
          if (link.getAttribute('href') === `#${visible.target.id}`) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      },
      { rootMargin: '-80px 0px -65% 0px', threshold: 0 },
    );
    sections.forEach((section) => navObserver.observe(section));
  }

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
  root.dataset.ready = 'true';
})();
