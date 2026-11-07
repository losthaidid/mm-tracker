/* Keep the original living window in its sidebar home. Atmosphere owns the
   scene, weather, clock, visitors and settings; docking never saves account data. */
(function (root) {
  'use strict';
  function install(a) {
    function mount() {
      const sidebar = document.getElementById('hubSidebar');
      if (!a.ready() || !sidebar) {
        delete document.body.dataset.hubWorld;
        return;
      }
      const card = document.getElementById('hubAtmosphereCard');
      if (!card) return;
      const note = sidebar.querySelector('.hub-side-note');
      if (card.parentElement !== sidebar || (note && card.nextElementSibling !== note))
        sidebar.insertBefore(card, note);
      document.body.dataset.hubWorld = 'sidebar';
    }
    return { mount };
  }
  root.WorkHubWorldWindow = { install };
})(window);
