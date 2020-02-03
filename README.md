# An Adobe Lightroom Classic catalog helper

Even worked in Adobe Lightroom Classic and wanted to see a list of orphaned images (they're in your filesystem, but they're not in your catalog for wahtever reason) without syncing folders? Or generate a .txt file with full-path filenames of all images tagged with a specific keyword?

If you have, you probably discovered that Lightroom is really, really bad at things that should be really, really easy so in order to make those things easy, this helper exists. The Lightroom catalog file is actually a [sqlite v3](https://sqlite.org) database file, and everything that Lightroom can do, you can _technically_ do by hand as long as you know how to write SQL statements. For some things, like retouch operations, figuring out the SQL statements required are an otherworldly amount of work, but for things like "finding all images for a specific keyword" or "checking for orphans", the SQL statements are surprisingly simple, and run in milliseconds. Even when Lightroom would take a minute or more to run the same operation (if it can run it at all).

Turns out: sometimes the best way to use Lightroom is to bypass Lightroom.

## How to use this helper

This is a browser-based helper utility that uses [node.js](https://nodejs.org), and can be invoked as:

```
node index.js -p 8080 -c "the/path/for/your/catalog.lrcat"
```

With the following supported flags:

flag | description
-|-
`-p` | The port to use for the server part of the helper
`-c` | The path to your catalog file
`-ns` | Do not automatically open "your default browser"

Note that you want `/` for the path to your catalog file. Even on Windows, just use `/` (Windows has suported `/` path delimiting literally since it was a DOS application). This means that if your catalog is **`C:\Users\You\Documents\my-catalog.lrcat`**, you specify it as **`C:/Users/You/Documents/my-catalog.lrcat`** instead.

## Supported tasks

- List all keywords know to your catalog (as pull-down list)
- View all images for a specific keyword (as image gallery, randomised slideshow, or filename list)
- View all untagged images (as image gallery, randomised slideshow, or filename list)

### Orphan management

The following orphaned image (images found on disk, but not in catalog) operations are supported:

- view orphaned images (as image gallery, randomised slideshow, or filename list)
- archive orphans, moving orphans into a directory called **`out-of-catalog`**)
- delete orphans, with a confirmation warning to stop you from accidentally running this.

Note that by default, the browser will open a page that has orphan management turned off, because in order for orphan management to work, the helper needs to do a file system scan to find all filenames, then remove all filenames that exist in the catalog from that set. Depending on how many files your catalog is for, how fast your drives are, and how fast your cpu is, this can a bit of time to build.