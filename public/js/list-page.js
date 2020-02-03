const loadList = [];
let loading = false;

/**
 * ...
 */
function done(src) {
  if (loading === src) {
    loading = false;
    load();
  }
}

/**
 * Image loading swaps the href in data-src into the
 * real src attribute, with onload/onerror handling.
 *
 * Note that we do this based on an "elements to load"
 * queue, so that we can load multiple images in
 * parallel, rather than one by one.
 */
function load(entry) {
  if (entry) loadList.push(entry);

  if (loading) return;

  if (loadList.length === 0) return;

  entry = loadList.shift();
  const { box, img } = entry;
  const href = img.dataset.src;

  loading = href;

  box.classList.add("loading");

  img.onload = () => {
    box.classList.remove("loading");
    box.classList.add("loaded");
    done(href);
  };

  img.onerror = () => {
    box.classList.remove("loading");
    box.classList.add("error");
    done(href);
  };

  img.src = href;
}

/**
 * Attempt to load an image by swapping src for data-src.
 * This is based on the Observer pattern, and will fail when
 * the browser is mid-scroll, or the observed image is no
 * longer anywhere in the viewport.
 */
function loadImage(observer, entry) {
  const box = entry.target;
  const img = box.querySelector("img");
  const href = img.dataset.src;

  if (scrollLock) {
    return (unlockQueue[href] = () => loadImage(observer, entry));
  }

  if (entry.isIntersecting && !img.src && href && !scrollLock) {
    observer.unobserve(box);
    load({ box, img });
  }
}

/**
 * Scoll event lock and buffer, so that functions can decide not
 * to run during scroll, while being able to queue up any
 * fuctions that need to kick in once scrolling halts.
 */
let scrollLock = false;
let unlockQueue = {};
let scrollReset = (() => {
  let timeout = false;
  return () => {
    if (timeout) clearTimeout(timeout);
    scrollLock = true;
    timeout = setTimeout(() => {
      scrollLock = false;
      Object.keys(unlockQueue).forEach(href => unlockQueue[href]());
      unlockQueue = {};
    }, 100);
  };
})();

/**
 * Observe all image links (observing the links, not the images in them)
 * for viewport interesction.
 */
let observer = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    loadImage(observer, entry);
  });
});

document.querySelectorAll("#images a").forEach(box => observer.observe(box));
window.addEventListener("scroll", () => scrollReset());
