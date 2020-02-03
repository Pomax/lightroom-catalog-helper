const fs = require("fs-extra");
const path = require("path");
const sqlite3 = require("sqlite3");

const c = process.argv.indexOf("-c");
if (c === -1) {
  console.error("missing: -c some/path/to/a/file.lrcat");
  process.exit(1);
}

const lrcat = process.argv[c + 1];
if (!lrcat) {
  console.error("missing: -c argument");
  process.exit(1);
}

const diskFiles = {
  files: false
};

const getDiskFiles = async allFiles => {
  if (diskFiles.files) return diskFiles.files;

  // build a list of directories based on allFiles
  let dirs = {};
  allFiles
    .map(v => v.replace(path.basename(v), ""))
    .forEach(v => (dirs[v] = true));
  dirs = Object.keys(dirs);

  const files = [];
  const dead = [];
  dirs.forEach(dir => {
    try {
      const dirContent = fs.readdirSync(dir);
      const filtered = dirContent.filter(file => file.indexOf(`.`) > -1);
      const resolved = filtered.map(file => `${dir}${file}`);
      files.push(...resolved);
    } catch (e) {
      dead.push(dir);
    }
  });
  console.log(`dead directories:`, dead);
  diskFiles.files = files;
  return files;
};

/**
 *
 */
class Database {
  constructor(lrcat) {
    this.db = new sqlite3.Database(lrcat, sqlite3.OPEN_READONLY);
    this.lrcat = lrcat;
  }

  getCatalogueName() {
    return this.lrcat;
  }

  invalidateCache() {
    diskFiles.files = false;
  }

  /**
   *  ...
   */
  async query(query) {
    return await new Promise(resolve => {
      this.db.get(query, (err, row) => {
        resolve(row);
      });
    });
  }

  /**
   *  ...
   */
  async queryAll(query) {
    return await new Promise(resolve => {
      this.db.all(query, (err, rows) => {
        resolve(rows);
      });
    });
  }

  /**
   *  ...
   */
  async getKeywords() {
    const query = `
            SELECT
                name,
                COUNT(i.id_local) as count
            FROM
                AgLibraryKeyword as k,
                AgLibraryKeywordImage as i
            WHERE
                name IS NOT null
            AND
                k.id_local = i.tag
            GROUP BY lc_name
            ORDER BY name
        `;
    const data = await this.queryAll(query);
    return data;
  }

  /**
   *  ...
   */
  async getTagged(keyword) {
    const query = `
            SELECT
                absolutePath as root,
                pathFromRoot as path,
                originalFilename as filename
            FROM
                Adobe_images as i,
                AgLibraryFile as f,
                AgLibraryFolder as d,
                AgLibraryRootFolder as r,
                AgLibraryKeyword as k,
                AgLibraryKeywordImage as t
            WHERE
                k.name = "${keyword}"
            AND
                k.id_local = t.tag
            AND
                i.id_local = t.image
            AND
                i.rootFile = f.id_local
            AND
                f.folder = d.id_local
            AND
                d.rootFolder = r.id_local
            ORDER BY
                root, path, filename
        `;
    const data = await this.queryAll(query);
    return data.map(e => `${e.root}${e.path}${e.filename}`);
  }

  /**
   *  ...
   */
  async getUntagged() {
    const query = `
            SELECT
                f.id_local as id,
                absolutePath as root,
                pathFromRoot as path,
                originalFilename as filename
            FROM
                Adobe_images as i,
                AgLibraryFile as f,
                AgLibraryFolder as d,
                AgLibraryRootFolder as r
            WHERE
                i.rootFile = f.id_local
            AND
                f.folder = d.id_local
            AND
                d.rootFolder = r.id_local
            AND
                i.id_local NOT IN (
                    SELECT DISTINCT(image) as id_local
                    FROM AgLibraryKeywordImage
                )
            ORDER BY
              root, path, filename
        `;
    const data = await this.queryAll(query);
    return data.map(e => `${e.root}${e.path}${e.filename}`);
  }

  /**
   *  ...
   */
  async getCollections() {
    const query = `
            SELECT
                name,
                COUNT(i.id_local) as count
            FROM
                AgLibraryCollection as c,
                AgLibraryCollectionImage as i
            WHERE
                name IS NOT null
            AND
                c.id_local = i.collection
            GROUP BY name
            ORDER BY name
        `;
    const data = await this.queryAll(query);
    return data.map(e => e.name);
  }

  /**
   *  ...
   */
  async getCollection(collection) {
    const query = `
            SELECT
                absolutePath as root,
                pathFromRoot as path,
                originalFilename as filename
            FROM
                Adobe_images as i,
                AgLibraryFile as f,
                AgLibraryFolder as d,
                AgLibraryRootFolder as r,
                AgLibraryCollection as k,
                AgLibraryCollectionImage as t
            WHERE
                k.name = "${collection}"
            AND
                k.id_local = t.collection
            AND
                i.id_local = t.image
            AND
                i.rootFile = f.id_local
            AND
                f.folder = d.id_local
            AND
                d.rootFolder = r.id_local
            ORDER BY
                root, path, filename
        `;
    const data = await this.queryAll(query);
    return data.map(e => `${e.root}${e.path}${e.filename}`);
  }

  /**
   * Get all files known to this catalogue
   *
   * FIXME: this does not work for files in a dir tree yet.
   */
  async getAllFiles() {
    const query = `
            SELECT
                absolutePath as root,
                pathFromRoot as path,
                originalFilename as filename
            FROM
                Adobe_images as i,
                AgLibraryFile as f,
                AgLibraryFolder as d,
                AgLibraryRootFolder as r
            WHERE
                i.rootFile = f.id_local
            AND
                f.folder = d.id_local
            AND
                d.rootFolder = r.id_local
            ORDER BY
                root, path, filename
        `;
    const data = await this.queryAll(query);
    return data.map(e => `${e.root}${e.path}${e.filename}`);
  }

  /**
   * Get all orphans relative to this catalogue.
   * That is all files that are on disk in directories
   * that are known to the catalogue, but are not
   * found in the catalogue itself.
   *
   * FIXME: this does not work for files in a dir tree yet.
   */
  async getOrphans() {
    const catalogue = await this.getAllFiles();
    const disk = await getDiskFiles(catalogue);
    const orphans = disk.filter(file => catalogue.indexOf(file) === -1);
    return orphans;
  }
}

module.exports = new Database(lrcat);
