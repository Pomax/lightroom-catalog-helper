function loadRandomImage(reverse) {
  if (reverse) {
    files.unshift(files.pop());
    files.unshift(files.pop());
  }

  // get first image in the list
  const src = files[0];
  document.body.style.backgroundImage = `url("/image/${encodeURIComponent(
    src
  )}")`;

  files.push(files.shift());

  // schedule next update
  setTimeout(loadRandomImage, SLIDESHOW_INTERVAL);
}

// forward/back key handling
document.addEventListener("keydown", evt => {
  if (evt.keyCode == 37) loadRandomImage(true);
  if (evt.keyCode == 39) loadRandomImage();
});

// full screen requires user interaction, unfortunately
(function setupStart() {
  const start = evt => {
    document.body.textContent = '';
    document.documentElement
      .requestFullscreen()
      .then(() => console.log("yes"))
      .catch(e => console.error(e));
    loadRandomImage();
    document.removeEventListener("click", start);
    document.removeEventListener("keydown", start);
  };
  document.addEventListener("click", start);
  document.addEventListener("keydown", start);
})();
