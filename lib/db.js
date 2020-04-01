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

const getFullPath = function getFullPath(record) {
  return `${record.root}${record.path}${record.filename}`
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
  diskFiles.files = files;
  return files;
};

/**
 *
 */
class Database {
  constructor(lrcat) {
    this.lrcat = lrcat;
    this.setReadOnly();
  }

  close() {
    this.db.close();
  }

  setReadWrite() {
    if (this.db) this.db.close();
    this.db = new sqlite3.Database(this.lrcat, sqlite3.SQLITE_OPEN_READWRITE);
  }

  setReadOnly() {
    if (this.db) this.db.close();
    this.db = new sqlite3.Database(this.lrcat, sqlite3.OPEN_READONLY);
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

  async getTablesWith(colName) {
    // Then, get all tables that have `image` columns, so that we can issue
    // a DELETE for all image=id_local values that we have in our recordSet:
    const tables = await this.queryAll(`select * from sqlite_master where type='table'`);
    const tableNames =  await new Promise( (resolve) => {
      let tableNames = [];
      tables.forEach(async (table, index) => {
        let pragma = await this.queryAll(`PRAGMA table_info(${table.name})`);
        let colNames = pragma.map(f => f.name);
        if (colNames.includes(colName)) tableNames.push(table.name);
        if (index === tables.length - 1) resolve(tableNames);
      });
    });
    return tableNames;
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
    return data.map(e => getFullPath(e));
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
                i.id_local as id,
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
    return data.map(e => `${e.root}${e.path}${e.filename}`); // also backresolvec
  }

  /**
   * Get all orphans relative to this catalogue.
   * That is: all files that are on disk in directories
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

  /**
   * Get all missing files in this catalogue.
   * That is: all files that are in the catalogue
   * and cannot be found on disk.
   *
   * FIXME: this does not work for files in a dir tree yet.
   */
  async getMissing() {
    const catalogue = await this.getAllFiles();
    const disk = await getDiskFiles(catalogue);
    const orphans = catalogue.filter(file => disk.indexOf(file) === -1);
    return orphans;
  }

  /**
   * ...
   */
  async getImageRecordsFromFilenames(fileList) {
    const nameSet = `('${ fileList.map(f => path.parse(f).name).join("','") }')`;
    const query = `
            SELECT
                i.id_local as id,
                f.id_local as fid,
                absolutePath as path,
                pathFromRoot as root,
                originalFilename as filename
            FROM
                Adobe_images as i,
                AgLibraryFile as f,
                AgLibraryFolder as d,
                AgLibraryRootFolder as r
            WHERE
                f.basename IN ${nameSet}
            AND
                i.rootFile = f.id_local
            AND
                f.folder = d.id_local
            AND
                d.rootFolder = r.id_local
            ORDER BY
                root, path, filename
    `;
    return await this.queryAll(query);
  }

  /**
   * Perform the actual removale of missing files
   * from the catalogue.
   */
  async removeDeletedFiles(fileList) {
    const tableNames = await this.getTablesWith('image');

    const imageIds = [];
    const imageRecords = await this.getImageRecordsFromFilenames(fileList);
    imageRecords.forEach(e => (fileList.includes(getFullPath(e))) ? imageIds.push(e.id) : false);
    const idSet = `(${ imageIds.join(',') })`;
    const fileRecordIdSet = `(${imageRecords.map(e => e.fid).join(',')})`;

    // We may have just removed whatever image lightroom had "selected", in which case
    // we change the selection to the first image in the catalog.
    const cursor = await this.query(`SELECT value FROM Adobe_variablesTable WHERE id_local=115`);
    const firstImageId = await this.query(`SELECT id_local FROM Adobe_images ORDER BY id_local LIMIT 1`);

    // get a lock on the database file
    this.setReadWrite();

    // perform the full delete operation as transactions:
    console.log("Begin sync transaction");
    await new Promise((resolve, reject) => {
      this.db.exec("BEGIN", (err, _) => {
        if (err) { console.error(err); return reject(); }

        // Run deletions for every table that has an `image` column:
        const deletions = tableNames.map(name =>`DELETE FROM ${name} WHERE image IN ${idSet}`);
        deletions.forEach(q => this.query(q));

        // Then remember to delete the file records in both the Adobe_images table,
        // where the same colum is `id_local`, not `image`, and the AgLibraryFile table,
        // which has its own `id_local` that is resolved via the Adobe_images `rootFile`
        // that we filtered for when creating the fileRecordIdSet, above.
        this.query(`DELETE FROM Adobe_images WHERE id_local IN ${idSet}`);
        this.query(`DELETE FROM AgLibraryFile WHERE id_local IN ${fileRecordIdSet}`);

        // If one of the images that's getting deleted is the currently selected image,
        // update the Lightroom variables table to point to the first image in the catalog.
        if (imageIds.includes(cursor)) {
          this.query(`UPDATE Adobe_variablesTable SET value='${firstImageId}' WHERE id_local=58`); // Adobe_selectedImages
          this.query(`UPDATE Adobe_variablesTable SET value=${firstImageId} WHERE id_local=115`); // Adobe_activeImage
        }

        // FIXME: TODO: recompute the `imageCount` for all collections?

        console.log("Commiting sync operations");
        this.db.exec(`COMMIT`, (err, _) => {
          if (err) { console.error(err); return reject(); }
          resolve();
        });
      });
    });

    // release the lock on the database file
    this.setReadOnly();
  }
}

module.exports = new Database(lrcat);
