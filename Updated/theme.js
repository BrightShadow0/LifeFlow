(function (global) {
  'use strict';
  const THEMES = ['dark', 'light', 'forest', 'paper'];
  const COLOR_THEMES = ['sapphire', 'emerald', 'platinum', 'amethyst', 'ruby'];

  function createThemeController(options) {
    const {
      profileState, getCurrentUser, getTasks, systemTheme, renderApp, showToast,
      applyWorkspaceAppearance, backdropGroups, defaultBackdropForTheme, getSession
    } = options || {};
    if (!profileState || typeof profileState.getState !== 'function') {
      throw new TypeError('LifeFlow theme controller requires a profile StateManager.');
    }

    const profile = () => profileState.getState().profile || {};
    const currentUserWithPreferences = () => {
      const user = getCurrentUser();
      return user ? { ...user, ...profile() } : user;
    };
    function updatePreferences(patch) {
      const next = { ...profile(), ...patch };
      profileState.setState({ profile: next });
      profileState.flush();
      return next;
    }
    function effectiveTheme(user = currentUserWithPreferences()) {
      const settings = profile();
      if (settings.autoTheme) return systemTheme();
      const selected = settings.theme ?? user?.theme;
      return THEMES.includes(selected) ? selected : 'dark';
    }
    function applyTheme(theme) {
      const user = currentUserWithPreferences();
      const settings = profile();
      const actual = settings.autoTheme ? systemTheme() : (THEMES.includes(theme) ? theme : 'dark');
      const root = document.documentElement;
      root.setAttribute('data-theme', actual);
      root.setAttribute('data-mouse-light', actual === 'light' ? 'off' : 'on');
      if (actual === 'light') {
        const app = document.getElementById('app');
        if (app) {
          app.style.setProperty('--lf-pointer-x', '50%');
          app.style.setProperty('--lf-pointer-y', '35%');
          app.style.setProperty('--lf-depth-x', '0px');
          app.style.setProperty('--lf-depth-y', '0px');
        }
      }
      let color = settings.colorTheme ?? user?.colorTheme ?? 'platinum';
      if (color === 'gold') color = 'sapphire';
      if (color === 'amethyst' && user && !['Premium', 'Team Admin'].includes(user.tier)) color = 'sapphire';
      const actualColor = COLOR_THEMES.includes(color) ? color : 'platinum';
      root.setAttribute('data-color-theme', actualColor);
      const workspace = document.getElementById('app');
      if (workspace) {
        workspace.setAttribute('data-theme', actual);
        workspace.setAttribute('data-color-theme', actualColor);
      }
      root.style.setProperty('--lf-theme-transition', '1');
      return actual;
    }
    function themeLabel(theme) {
      return ({ dark: 'Nighttime', light: 'Daytime', forest: 'Quiet Forest', paper: 'Warm Paper' })[theme] || 'Nighttime';
    }
    function ambientSettings(user = currentUserWithPreferences()) {
      return Object.assign({ ambientMode: true, ambientIntensity: 'medium' }, profile().ambient || user?.ambient || {});
    }
    function applyAmbientEnvironment() {
      const user = currentUserWithPreferences();
      if (!user) return;
      const settings = ambientSettings(user);
      const tasks = getTasks() || [];
      const active = tasks.filter(task => !task.done).length;
      const overdue = tasks.filter(task => task.due && new Date(task.due) < new Date() && !task.done).length;
      const now = new Date();
      const hour = now.getHours() + now.getMinutes() / 60;
      const timeState = hour < 7 ? 'dawn' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
      const load = Math.min(1, (active / 12) + (overdue / 8));
      const level = overdue >= 3 || active >= 8 ? 'high' : overdue >= 1 || active >= 4 ? 'medium' : 'calm';
      const intensityLevel = settings.ambientIntensity === 'low' ? 'low' : settings.ambientIntensity === 'high' ? 'high' : 'medium';
      const intensity = settings.ambientMode ? ({ low: 0.45, medium: 0.75, high: 1 })[intensityLevel] : 0;
      const root = document.documentElement;
      root.setAttribute('data-ambient', settings.ambientMode ? 'on' : 'off');
      root.setAttribute('data-load', level);
      root.setAttribute('data-time', timeState);
      root.style.setProperty('--lf-load', String(load));
      root.style.setProperty('--lf-ambient-intensity', String(intensity));
    }
    function setTheme(theme) {
      const next = THEMES.includes(theme) ? theme : 'dark';
      const appVisible = !document.getElementById('app')?.classList.contains('lifeflow-stage-hidden');
      const main = document.getElementById('main');
      const scrollState = {
        x: window.scrollX || window.pageXOffset || 0,
        y: window.scrollY || window.pageYOffset || document.scrollingElement?.scrollTop || 0,
        mainTop: main?.scrollTop || 0,
        mainLeft: main?.scrollLeft || 0
      };
      updatePreferences({ theme: next, autoTheme: false });
      applyTheme(next);
      applyWorkspaceAppearance(currentUserWithPreferences());
      const currentLabel = document.getElementById('currentThemeLabel');
      if (currentLabel) currentLabel.innerHTML = 'Currently using <b>' + themeLabel(effectiveTheme()) + '</b>';
      document.querySelectorAll('.theme-preview').forEach(button => {
        const selected = button.classList.contains('theme-preview-' + next);
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
        const check = button.querySelector('.theme-check');
        if (check) check.textContent = selected ? '✓' : '○';
      });
      const autoToggle = document.querySelector('.theme-sync-row input[type="checkbox"]');
      if (autoToggle) autoToggle.checked = false;
      if (appVisible) {
        requestAnimationFrame(() => {
          window.scrollTo(scrollState.x, scrollState.y);
          const currentMain = document.getElementById('main');
          if (currentMain) {
            currentMain.scrollTop = scrollState.mainTop;
            currentMain.scrollLeft = scrollState.mainLeft;
          }
        });
      }
    }
    function setAutoThemeSync(enabled) {
      if (!getCurrentUser()) return;
      updatePreferences({ autoTheme: !!enabled, ...(enabled ? { theme: systemTheme() } : {}) });
      renderApp();
    }
    function setColorTheme(theme) {
      const user = getCurrentUser();
      if (theme === 'amethyst' && user && !['Premium', 'Team Admin'].includes(user.tier)) {
        showToast('Amethyst is available to Premium and Team Admin accounts.');
        return;
      }
      const next = COLOR_THEMES.includes(theme) ? theme : 'sapphire';
      const settings = profile();
      const activeTheme = settings.autoTheme ? systemTheme() : (settings.theme || user?.theme || 'dark');
      const patch = { colorTheme: next };
      if (activeTheme === 'dark') {
        const validBackdrops = (backdropGroups[next] || backdropGroups.sapphire).map(option => option[0]);
        if (!validBackdrops.includes(settings.workspaceBackdrop ?? user?.workspaceBackdrop)) {
          patch.workspaceBackdrop = defaultBackdropForTheme(next);
        }
      }
      updatePreferences(patch);
      applyTheme(activeTheme);
      applyWorkspaceAppearance(currentUserWithPreferences());
      renderApp();
    }
    function initWorkspaceAtmosphereInteraction() {
      if (document.documentElement.dataset.atmosphereInteractionReady === 'true') return;
      const app = document.getElementById('app');
      if (!app) return;
      document.documentElement.dataset.atmosphereInteractionReady = 'true';
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      const finePointer = window.matchMedia?.('(pointer: fine)');
      const resetPointer = () => {
        app.style.setProperty('--lf-pointer-x', '50%');
        app.style.setProperty('--lf-pointer-y', '35%');
        app.style.setProperty('--lf-depth-x', '0px');
        app.style.setProperty('--lf-depth-y', '0px');
      };
      const updatePointer = event => {
        if (!getSession() || reduced?.matches || !finePointer?.matches ||
            document.documentElement.dataset.interactiveAtmosphere === 'off' ||
            document.documentElement.dataset.theme === 'light') {
          resetPointer();
          return;
        }
        const x = Math.max(0, Math.min(1, event.clientX / window.innerWidth));
        const y = Math.max(0, Math.min(1, event.clientY / window.innerHeight));
        app.style.setProperty('--lf-pointer-x', (x * 100).toFixed(1) + '%');
        app.style.setProperty('--lf-pointer-y', (y * 100).toFixed(1) + '%');
        app.style.setProperty('--lf-depth-x', ((x - 0.5) * 10).toFixed(2) + 'px');
        app.style.setProperty('--lf-depth-y', ((y - 0.5) * 8).toFixed(2) + 'px');
      };
      window.addEventListener('pointermove', updatePointer, { passive: true });
      window.addEventListener('blur', resetPointer);
      reduced?.addEventListener?.('change', () => { if (reduced.matches) resetPointer(); });
    }

    profileState.subscribe('profile', () => {
      const app = document.getElementById('app');
      if (!app || app.classList.contains('lifeflow-stage-hidden')) return;
      const user = currentUserWithPreferences();
      applyTheme(effectiveTheme(user));
      applyWorkspaceAppearance(user);
      applyAmbientEnvironment();
    });
    return {
      profile, updatePreferences, effectiveTheme, applyTheme, themeLabel,
      ambientSettings, applyAmbientEnvironment, setTheme, setAutoThemeSync,
      setColorTheme, initWorkspaceAtmosphereInteraction
    };
  }
  global.LifeFlowThemeModule = { createThemeController };
})(window);
