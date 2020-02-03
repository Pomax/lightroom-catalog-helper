const nunjucks = require("nunjucks");
const path = require("path");
const opts = { autoescape: false, noCache: true };
const env = nunjucks.configure(path.join(process.cwd(), "templates"), opts);
const db = require("./db");
const fs = require("fs-extra");
const dcraw = require("dcraw");
const sharp = require("sharp");
var crypto = require("crypto");

const extMap = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png"
};

/**
 *
 */
function serveTempFile(res, tempfile) {
  res.set("Content-Type", extMap[".jpg"]);
  const buffer = fs.readFileSync(tempfile);
  res.set("Content-Length", buffer.length);
  res.end(buffer);
}

/**
 *
 */
function generateTempFile(filename) {
  var b64 = Buffer.from(filename).toString("base64");
  var hash = crypto
    .createHash("md5")
    .update(b64)
    .digest("hex");
  return `./temp/${hash}.jpg`;
}

/**
 *
 */
async function convertFromRAW(res, filename) {
  const tempfile = generateTempFile(filename);
  const tiffFilename = `${tempfile}.tiff`;
  const tempFilePath = path.join(__dirname, `..`, tempfile);

  if (fs.existsSync(tempFilePath)) {
    return serveTempFile(res, tempfile);
  }

  if (fs.existsSync(filename)) {
    try {
      const buffer = fs.readFileSync(filename);

      if (!fs.existsSync(tiffFilename)) {
        const tiffbuffer = dcraw(buffer, { extractThumbnail: true });
        fs.writeFileSync(tiffFilename, tiffbuffer);
      }
    } catch (e) {
      console.error(`error for: ${filename}`);
      console.error(e);
      res.status(500).end(`error loading ${filename}`);
    }

    await convertFromTiff(res, tiffFilename, tempfile);

    if (fs.existsSync(tiffFilename)) {
      fs.unlinkSync(tiffFilename);
    }
  } else {
    console.error(`file does not exist: ${filename}`);
    res.status(500).end(`error loading ${filename}`);
  }
}

/**
 *
 */
async function convertFromTiff(res, filename, tempfile, buffer) {
  tempfile = tempfile || generateTempFile(filename);

  if (fs.existsSync(tempfile)) {
    return serveTempFile(res, tempfile);
  }

  if (!buffer && !fs.existsSync(filename)) {
    console.error(`file does not exist: ${filename}`);
    return res.status(500).end(`error loading ${filename}`);
  }

  try {
    buffer = buffer || fs.readFileSync(filename);

    sharp(buffer)
      .resize(1200)
      .toFile(tempfile, (err, info) => {
        if (err) {
          console.error(err);
          return res.status(500).end(`error loading ${filename}`);
        }
        serveTempFile(res, tempfile);
      });
  } catch (e) {
    console.error(e);
    res.status(500).end(`error loading ${filename}`);
  }
}

const routes = {
  /**
   * Main page
   */
  ",index.html": async (req, res) => {
    const keywords = await db.getKeywords();
    const collections = await db.getCollections();
    const files = await db.getAllFiles();

    res.render("index.html", {
      lrcat: db.getCatalogueName(),
      keywords,
      collections,
      files,
      orphans: req.query.orphans ? await db.getOrphans() : undefined
    });
  },

  /**
   * image subroute
   */
  "image/:filename": async (req, res) => {
    let filename = req.params.filename;
    if (!filename) res.status(400).end("bad request");
    filename = decodeURIComponent(filename);
    let ext = path.extname(filename).toLowerCase();

    if (ext === ".tif" || ext === ".tiff") {
      return convertFromTiff(res, filename);
    } else if (ext === ".mov" || ext === ".mp4") {
      res.status(400).end("movies not currently supported");
    } else if (!extMap[ext]) {
      return convertFromRAW(res, filename);
    }

    res.set("Content-Type", extMap[ext] || "application/octet-stream");
    try {
      let data = fs.readFileSync(filename);
      // dcraw(buf, { verbose: true, identify: true });
      res.set("Content-Length", data.length);
      res.end(data);
    } catch (err) {
      res.status(500).end(`error loading ${filename}`);
    }
  },

  /**
   * View all iamges tied to a specific keyword.
   */
  "keywords/:keyword/(:type/)?": async (req, res) => {
    let keyword = req.params.keyword;
    if (!keyword) res.status(400).end("bad request");
    let files = await db.getTagged(keyword);
    if (listOrSlideshow(req, res, files)) return;
    let images = files.map(f => encodeURIComponent(f));
    res.render("list-page.html", {
      count: files.length,
      keyword,
      images
    });
  },

  /**
   * View all untagged images.
   */
  "untagged/(:type/)?": async (req, res) => {
    let files = await db.getUntagged();
    if (listOrSlideshow(req, res, files)) return;
    let images = files.map(f => encodeURIComponent(f));
    res.render("list-page.html", {
      count: files.length,
      images
    });
  },

  /**
   * View all iamges tied to a specific collection.
   */
  "collections(/:collection)/(:type/)?": async (req, res) => {
    let collection = req.params.collection;
    if (!collection) res.status(400).end("bad request");
    let files = await db.getCollection(collection);
    if (listOrSlideshow(req, res, files)) return;
    let images = files.map(f => encodeURIComponent(f));
    res.render("list-page.html", {
      count: files.length,
      collection,
      images
    });
  },

  /**
   * Move orphaned images to out-of-catalog dir
   */
  "orphaned/archive": async (req, res) => {
    let files = await db.getOrphans();
    db.invalidateCache();
    files.forEach(file => {
      let l = file.lastIndexOf(`/`);
      let dir = file.substring(0, l) + `/out-of-catalog`;
      fs.mkdirpSync(dir);
      let to = dir + file.substring(l);
      console.log(`Moving: ${file} => ${to}`);
      fs.moveSync(file, to);
    });
    console.log(`Archive operation complete.`);
    res.redirect(`/`);
  },

  /**
   * Delete orphaned images from disk
   */
  "orphaned/delete": async (req, res) => {
    let files = await db.getOrphans();
    db.invalidateCache();
    files.forEach(file => fs.unlinkSync(file));
    res.redirect(`/`);
  },

  /**
   * View all orphaned images
   */
  "orphaned/(:type/)?": async (req, res) => {
    let files = await db.getOrphans();
    if (listOrSlideshow(req, res, files)) return;
    let images = files.map(f => encodeURIComponent(f));
    res.render("list-page.html", {
      count: files.length,
      images,
      orphaned: true
    });
  }
};

function listOrSlideshow(req, res, files) {
  return asPlainList(req, res, files) || asSlideshow(req, res, files) || false;
}

function asPlainList(req, res, files) {
  if (!req.params.type || req.params.type !== "list") return;
  res.set("Content-Type", "text/plain");
  res.render("list-page.txt", {
    data: files.join("\n")
  });
  return true;
}

function asSlideshow(req, res, files) {
  if (!req.params.type || req.params.type !== "slideshow") return;
  res.set("Content-Type", "text/html");
  let source = files.slice();
  let shuffled = [];
  while (source.length) {
    let e = source.splice((Math.random() * source.length) | 0, 1)[0];
    if (e) { shuffled.push(e); }
  }
  res.render("slideshow.html", {
    timeout: req.query.timeout || 90000,
    files: shuffled
  });
  return true;
}

module.exports = app => {
  env.express(app);
  const clearCache = (req, res, next) => {
    for (let i = 0; i < env.loaders.length; i += 1) {
      env.loaders[i].cache = {};
    }
    next();
  };

  Object.keys(routes).forEach(route => {
    const routeFn = routes[route];
    route.split(`,`).forEach(route => {
      app.get(`/${route}`, clearCache, routeFn);
    });
  });
};
