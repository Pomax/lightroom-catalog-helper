# An Adobe Lightroom Classic catalog helper

Even worked in Adobe Lightroom Classic and wanted to see a list of orphaned images (they're in your filesystem, but they're not in your catalog for wahtever reason) without syncing folders? Or generate a .txt file with full-path filenames of all images tagged with a specific keyword?

If you have, you probably discovered that Lightroom is really, really bad at things that should be really, really easy so in order to make those things easy, this helper exists. The Lightroom catalog file is actually a [sqlite v3](https://sqlite.org) database file, and everything that Lightroom can do, you can _technically_ do by hand as long as you know how to write SQL statements.

For some things, like retouch operations, figuring out the SQL statements required is an otherworldly amount of work, but for things like "finding all images for a specific keyword" or "checking for orphans", the SQL statements are surprisingly simple, and run in milliseconds. Even when Lightroom would take a minute or more to run the same operation (if it can run it at all).

Turns out: sometimes the best way to use Lightroom is to bypass Lightroom.

## How to use this helper

This is a browser-based helper utility that uses [node.js](https://nodejs.org), which I would **strongly recommend** installing using [nvm-sh](https://github.com/nvm-sh/nvm) on Linux/MacOS, or [nvm-windows](https://github.com/coreybutler/nvm-windows#install-nvm-windows) on Windows. Do not use the website's own installer, or a community PPA, or even `brew`.

With Node.js installed, [clone this repo](https://help.github.com/en/github/creating-cloning-and-archiving-repositories/cloning-a-repository) (or fork it to your own account, and then clone that instead) or [downloading and unpack it](https://github.com/Pomax/lightroom-catalog-helper/archive/master.zip), then run the helper from its directory by using

```
lightroom-catalog-helper> npm start -- -p 8080 -c "the/path/for/your/catalog.lrcat"
```

The main part in this command is `npm start`, with `--` indicating that we're going to pass some runtime flags, followed by (in the above standard call example) the runtime flags for port number and catalog filepath.

**note**: this might take a bit longer the first time you do so, because it will check that all dependencies are installed, and install them—*locally*, not globally—prior to running the utility.

### runtime flags

The following runtime flags are supported:

flag | description
-|-
`-p` | The port to use for the server part of the helper
`-c` | The path to your catalog file
`-ns` | Do not automatically open "your default browser"

Note that you want to use `/` as path delimiter for the path to your catalog file. Even on Windows. (Windows has suported `/` path delimiting literally since it was a DOS application).

This means that if your catalog is **`C:\Users\You\Documents\my-catalog.lrcat`**, you specify it as **`C:/Users/You/Documents/my-catalog.lrcat`** instead.

## Supported tasks

- List all keywords known to your catalog (as pull-down list)
- View all images for a specific keyword (as image gallery, randomised slideshow, or filename list)
- View all untagged images (as image gallery, randomised slideshow, or filename list)

- List all collections known to your catalog (as pull-down list)
- View all images for a specific collection (as image gallery, randomised slideshow, or filename list)

### Orphan management

The following orphaned image (images found on disk, but not in catalog) operations are supported:

- view orphaned images (as image gallery, randomised slideshow, or filename list)
- archive orphans, moving orphans into a directory called **`out-of-catalog`**)
- delete orphans, with a confirmation warning to stop you from accidentally running this.

Note that by default, the browser will open a page that has orphan management turned off, because in order for orphan management to work, the helper needs to do a file system scan to find all filenames, then remove all filenames that exist in the catalog from that set. Depending on how many files your catalog is for, how fast your drives are, and how fast your cpu is, this can a bit of time to build.

## Unsupported features

- catalogues with directory trees: https://github.com/Pomax/lightroom-catalog-helper/issues/1
- catalogues with multiple root directories: https://github.com/Pomax/lightroom-catalog-helper/issues/3

:warning:&nbsp;NOTE:warning:

I will be happy to implement these features, but I don't personally need them and so working on them will be time lost that could have been spent on other work. As such, you can sponsor this work, or if you don't want to spend money, but you do know how to program and are willing to spend effort instead, I'll be more than happy to discuss the work in an issue and review PRs

## Supported image formats

- This helper utility supports `png` and `jpg` images without any issue.
- `TIFF` images are supported via a jpg conversion pass, using [sharp](https://github.com/lovell/sharp).
- RAW files supported through [dcraw.js](https://github.com/zfedoran/dcraw.js) (which converts RAW to TIFF). RAW conversions are cached into a directory called **`temp`**, which can be safely deleted if you want to save some space - as long as you remember that it _will_ get rebuilt and filled back up with previews/conversion intermediaries whenever you use this tool.
