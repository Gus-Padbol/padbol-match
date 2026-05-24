(function () {
  try {
    var s = localStorage.getItem('padbol_theme') || localStorage.getItem('theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var t = s === 'dark' || s === 'light' ? s : prefersDark ? 'dark' : 'light';
    document.documentElement.classList.add(t === 'dark' ? 'theme-dark' : 'theme-light');
    if (t === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0F172A' : '#F8F9FA');
  } catch (e) {
    document.documentElement.classList.add('theme-light');
    document.documentElement.classList.remove('dark');
  }
})();
