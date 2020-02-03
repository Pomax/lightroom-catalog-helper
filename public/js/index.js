const keywords = document.querySelector(`select.keywords`);
if (keywords) {
  keywords.addEventListener(`change`, evt => {
    const value = evt.target.value;
    if (value) {
      window.location = `/keywords/${value}`;
    }
  });
}

const collections = document.querySelector(`select.collections`);
if (collections) {
  collections.addEventListener(`change`, evt => {
    const value = evt.target.value;
    if (value) {
      window.location = `/collections/${value}`;
    }
  });
}

const loadOrphans = document.querySelector(`#orphans button.load`);
if (loadOrphans) {
  loadOrphans.addEventListener(`click`, evt => {
    window.location += "?orphans=true";
  });
}
